// api/_auth.js
// 설정·사용자 관리 공용 모듈. Vercel은 `_` 접두어 파일을 엔드포인트로 라우팅하지 않으므로
// 다른 api/*.js에서 import 전용 모듈로 안전하게 사용할 수 있다. (api/_seed_assets.js와 동일 방식)
//
// 제공 기능
//   db()                  : Supabase REST 호출 (204 빈 본문 방어 + 테이블 미생성 안내)
//   hashPw/verifyPw       : PBKDF2-SHA256 비밀번호 해시·검증 (평문 저장 금지)
//   signToken/verifyToken : HMAC-SHA256 서명 세션 토큰 (서버 무상태 검증, async)
//   getAuth/requireRole   : 요청 인증 및 역할 검사 (async)
//   audit()               : 설정 변경 감사 로그 기록
//
// ── 세션 시크릿 설계 (전원 로그아웃 방지) ──────────────────────────────
// 서명 키를 SUPABASE_SERVICE_KEY 같은 "교체될 수 있는" 환경변수에 의존시키면
// 그 값을 바꾸는 순간 발급된 모든 토큰의 서명이 깨져 전원이 로그아웃된다. 이를 막기 위해:
//   1) 시크릿을 DB(app_settings.session_secret)에 1회 생성·고정
//      → 환경변수·서비스키를 교체해도 세션 유지
//   2) 검증은 "현재 시크릿 + 이전 시크릿들 + 레거시 환경변수 키"를 모두 시도
//      → 시크릿을 의도적으로 교체(rotate)해도 기존 토큰이 즉시 무효화되지 않음
//   3) 만료(TTL 30일) 이후에도 유예기간(60일) 안이면 refresh로 재발급 가능
//      → 오래 접속하지 않아도 재로그인을 요구하지 않음

import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ANON_KEY;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 토큰 유효 30일
export const SESSION_GRACE_MS = 60 * 24 * 60 * 60 * 1000; // 만료 후 60일까지 refresh 허용

export const ROLES = ['admin', 'pm', 'qa', 'viewer'];

export const SETUP_SQL = `
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  login_id text not null unique,
  pw_hash text not null,
  name text not null default '',
  email text not null default '',
  role text not null default 'qa',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);
alter table app_users disable row level security;

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table app_settings disable row level security;

create table if not exists app_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null default '',
  action text not null,
  target text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);
alter table app_audit_logs disable row level security;
`.trim();

// ── Supabase REST 헬퍼 ────────────────────────────────────────────────
export async function db(path, method = 'GET', body = null, prefer = null) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  };
  if (prefer) headers['Prefer'] = prefer;
  else if (method === 'POST' || method === 'PATCH') headers['Prefer'] = 'return=representation';

  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method, headers, body: body ? JSON.stringify(body) : null,
  });
  const text = await r.text();                       // 204 No Content 방어
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; } }

  if (!r.ok) {
    const raw = text || '';
    // 테이블 미생성(PGRST205): 사전 조건 SQL 미실행 상태 — 조치 방법을 그대로 안내
    if (raw.includes('PGRST205') || /relation .*(app_users|app_settings|app_audit_logs)/.test(raw)) {
      const e = new Error('SETUP_REQUIRED');
      e.status = 428;                                // 428 Precondition Required
      e.setupSql = SETUP_SQL;
      throw e;
    }
    const msg = (data && (data.message || data.error || data.hint)) || `Supabase ${r.status}`;
    const e = new Error(msg);
    e.status = r.status;
    e.detail = data;
    throw e;
  }
  return data;
}

// ── 설정 값 조회/저장 (서버 내부용) ───────────────────────────────────
export async function getSetting(key, fallback = null) {
  try {
    const rows = await db(`/app_settings?key=eq.${encodeURIComponent(key)}&select=value`);
    return (Array.isArray(rows) && rows[0]) ? rows[0].value : fallback;
  } catch { return fallback; }
}

export async function putSetting(key, value) {
  return db('/app_settings', 'POST', { key, value, updated_at: new Date().toISOString() },
    'resolution=merge-duplicates,return=representation');
}

// ── 세션 시크릿 관리 ──────────────────────────────────────────────────
// _secrets.current : 새 토큰 서명에 사용
// _secrets.all     : 검증 시 순차 시도 (이전 시크릿·레거시 환경변수 키 포함)
let _secrets = { at: 0, current: null, all: [] };
const SECRET_CACHE_TTL = 60 * 1000;

// 예전 버전이 서명에 사용했던 키들 — 이미 발급된 토큰이 무효화되지 않도록 검증에도 포함
function legacySecrets() {
  return [process.env.APP_SESSION_SECRET, process.env.SUPABASE_SERVICE_KEY, process.env.APP_LOGIN_PW]
    .filter(Boolean);
}

async function loadSecrets() {
  if (_secrets.current && Date.now() - _secrets.at < SECRET_CACHE_TTL) return _secrets;

  const envSecret = process.env.APP_SESSION_SECRET || null;
  let current = null;
  const all = [];

  try {
    const row = await getSetting('session_secret', null);
    if (row && row.current) {
      current = row.current;
      all.push(row.current, ...(Array.isArray(row.previous) ? row.previous : []));
    } else {
      // 최초 1회: 시크릿을 생성해 DB에 고정. 이후 환경변수가 바뀌어도 세션이 유지된다.
      current = envSecret || crypto.randomBytes(32).toString('hex');
      await putSetting('session_secret', {
        current, previous: legacySecrets(), createdAt: new Date().toISOString(),
      });
      all.push(current);
    }
  } catch {
    // DB를 쓸 수 없는 상황(테이블 미생성 등) — 환경변수 체인으로 동작해 기능 중단을 막는다
    current = envSecret || process.env.SUPABASE_SERVICE_KEY || process.env.APP_LOGIN_PW || 'progenesis-fallback-secret';
    all.push(current);
  }

  legacySecrets().forEach(s => { if (!all.includes(s)) all.push(s); });
  _secrets = { at: Date.now(), current, all: [...new Set(all.filter(Boolean))] };
  return _secrets;
}

// 시크릿 교체 — 기존 시크릿을 previous로 옮겨 이미 발급된 토큰의 검증을 계속 허용한다.
export async function rotateSecret() {
  const s = await loadSecrets();
  const next = crypto.randomBytes(32).toString('hex');
  const previous = [...new Set([s.current, ...s.all])].filter(Boolean).slice(0, 5);
  await putSetting('session_secret', { current: next, previous, rotatedAt: new Date().toISOString() });
  _secrets = { at: 0, current: null, all: [] };
  return true;
}

// ── 비밀번호 해시 (PBKDF2-SHA256) ─────────────────────────────────────
const PBKDF2_ITER = 120000;

export function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.pbkdf2Sync(String(pw), salt, PBKDF2_ITER, 32, 'sha256').toString('hex');
  return `pbkdf2$${PBKDF2_ITER}$${salt}$${h}`;
}

export function verifyPw(pw, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iter = Number(parts[1]) || PBKDF2_ITER;
  const h = crypto.pbkdf2Sync(String(pw), parts[2], iter, 32, 'sha256').toString('hex');
  const a = Buffer.from(h), b = Buffer.from(parts[3]);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// 비밀번호 정책: 8자 이상 + 영문/숫자 각 1자 이상
export function checkPwPolicy(pw) {
  const s = String(pw || '');
  if (s.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
  if (!/[A-Za-z]/.test(s)) return '비밀번호에 영문자를 포함해야 합니다.';
  if (!/[0-9]/.test(s)) return '비밀번호에 숫자를 포함해야 합니다.';
  return null;
}

// ── 세션 토큰 (HMAC 서명, 서버 무상태 검증) ───────────────────────────
function hmac(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

export async function signToken(payload) {
  const { current } = await loadSecrets();
  const body = { ...payload, iat: Date.now(), exp: Date.now() + SESSION_TTL_MS };
  const b = Buffer.from(JSON.stringify(body)).toString('base64url');
  return `${b}.${hmac(b, current)}`;
}

// allowExpired: 만료된 토큰도 서명이 유효하면 payload를 돌려준다 (refresh 전용)
export async function verifyToken(token, { allowExpired = false } = {}) {
  const [b, sig] = String(token || '').split('.');
  if (!b || !sig) return null;
  const { all } = await loadSecrets();
  const y = Buffer.from(sig);
  const matched = all.some(s => {
    const x = Buffer.from(hmac(b, s));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  });
  if (!matched) return null;
  try {
    const p = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    if (!p.exp) return null;
    if (Date.now() > p.exp + SESSION_GRACE_MS) return null;   // 유예기간까지 지난 토큰은 거부
    if (Date.now() > p.exp && !allowExpired) return null;
    return p;
  } catch { return null; }
}

// 요청 헤더(Authorization: Bearer …) 또는 body/query 에서 토큰 추출
export function readToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || '';
  const bearer = h.startsWith('Bearer ') ? h.slice(7) : null;
  return bearer || req.body?.token || req.query?.token || null;
}

export async function getAuth(req, opts) {
  return verifyToken(readToken(req), opts);
}

// 역할 검사. 통과하면 세션을, 실패하면 res에 오류를 쓰고 null 반환.
export async function requireRole(req, res, roles = ['admin']) {
  const sess = await getAuth(req);
  if (!sess) {
    res.status(401).json({ error: '세션이 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.', code: 'UNAUTHENTICATED' });
    return null;
  }
  if (roles.length && !roles.includes(sess.role)) {
    res.status(403).json({ error: '권한이 없습니다. 관리자에게 문의하세요.', code: 'FORBIDDEN' });
    return null;
  }
  return sess;
}

// ── 감사 로그 ─────────────────────────────────────────────────────────
export async function audit(actor, action, target = '', detail = '') {
  try {
    await db('/app_audit_logs', 'POST', {
      actor: String(actor || '').slice(0, 80),
      action: String(action || '').slice(0, 80),
      target: String(target || '').slice(0, 160),
      detail: String(detail || '').slice(0, 1000),
    }, 'return=minimal');
  } catch { /* 감사 로그 실패가 본 기능을 막지 않도록 무시 */ }
}

// API 키 마스킹 — 화면에는 절대 전문을 내려보내지 않는다.
export function maskKey(k) {
  const s = String(k || '');
  if (!s) return '';
  if (s.length <= 12) return s.slice(0, 3) + '••••';
  return `${s.slice(0, 10)}${'•'.repeat(8)}${s.slice(-4)}`;
}

export function errorResponse(res, e) {
  if (e && e.message === 'SETUP_REQUIRED') {
    return res.status(428).json({
      error: '설정 테이블이 아직 생성되지 않았습니다. Supabase 대시보드 → SQL Editor에서 아래 SQL을 1회 실행한 뒤 다시 시도하세요.',
      code: 'SETUP_REQUIRED',
      sql: e.setupSql || SETUP_SQL,
    });
  }
  return res.status((e && e.status) || 500).json({ error: (e && e.message) || '알 수 없는 오류' });
}
