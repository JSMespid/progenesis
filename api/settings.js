// api/settings.js
// 애플리케이션 설정 저장소. app_settings 테이블에 key-value(jsonb)로 보관한다.
//
// 설정 키
//   ai            : { apiKey, model, maxTokens }   ← apiKey는 절대 평문으로 응답하지 않음(마스킹만)
//   organization  : { orgName, orgNameEn, dept, clientLogo, companyLogo, docFooter }
//   doc_defaults  : { codePrefix, author, reviewer, approver, distribution }
//   qa_defaults   : { scale, method, processLevel, sdlcFactors, holidays }
//
// 사전 조건: api/_auth.js의 SETUP_SQL을 Supabase SQL Editor에서 1회 실행.

import {
  db, getSetting, putSetting, maskKey, getAuth, requireRole,
  audit, errorResponse, SETUP_SQL,
} from './_auth.js';

const SETTING_KEYS = ['ai', 'organization', 'doc_defaults', 'qa_defaults'];

const DEFAULTS = {
  ai: { model: 'claude-haiku-4-5-20251001', maxTokens: 8000 },
  organization: { orgName: '', orgNameEn: '', dept: '', clientLogo: null, companyLogo: null, docFooter: '' },
  doc_defaults: { codePrefix: '', author: '', reviewer: '', approver: '', distribution: '사내 한정' },
  qa_defaults: {
    scale: '중형', method: 'UML', processLevel: 'L3',
    sdlcFactors: { req_clarity: '보통', req_volatility: '보통', delivery: '단계적', risk: '보통', regulation: '보통', team: '집중' },
    holidays: [],
  },
};

// 로고 dataURL 용량 상한 (jsonb 비대화 방지)
const LOGO_MAX = 400 * 1024;

async function loadAll() {
  const rows = await db('/app_settings?select=key,value,updated_at');
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach(r => { map[r.key] = r.value || {}; });
  const out = {};
  SETTING_KEYS.forEach(k => { out[k] = { ...DEFAULTS[k], ...(map[k] || {}) }; });

  // API 키는 마스킹해서만 노출 + 어디서 오는지(DB/환경변수) 표시
  const dbKey = out.ai.apiKey || '';
  const envKey = process.env.ANTHROPIC_API_KEY || '';
  out.ai = {
    model: out.ai.model || DEFAULTS.ai.model,
    maxTokens: Number(out.ai.maxTokens) || DEFAULTS.ai.maxTokens,
    hasKey: !!(dbKey || envKey),
    keySource: dbKey ? 'db' : (envKey ? 'env' : 'none'),
    keyMasked: maskKey(dbKey || envKey),
    updatedAt: map.ai?.updatedAt || null,
  };
  return out;
}

// Anthropic 키 유효성 확인 — 최소 토큰 호출로 인증만 검증
async function verifyAnthropicKey(apiKey, model) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || DEFAULTS.ai.model,
      max_tokens: 4,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  const text = await r.text();
  if (r.ok) return { ok: true, message: '연결 성공 — 키가 정상 동작합니다.' };
  let detail;
  try { detail = JSON.parse(text); } catch { detail = { raw: text.slice(0, 300) }; }
  const msg = detail?.error?.message || `HTTP ${r.status}`;
  if (r.status === 401) return { ok: false, message: `인증 실패: 키가 올바르지 않습니다. (${msg})` };
  if (r.status === 404) return { ok: false, message: `모델을 찾을 수 없습니다. 모델 ID를 확인하세요. (${msg})` };
  return { ok: false, message: `검증 실패 (HTTP ${r.status}): ${msg}` };
}

export default async function handler(req, res) {
  try {
    // ── 조회 ───────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { action } = req.query || {};

      // 설치 안내 SQL은 인증 없이도 조회 가능 (최초 구축 지원)
      if (action === 'setup_sql') {
        return res.status(200).json({ sql: SETUP_SQL });
      }

      // 감사 로그 (admin)
      if (action === 'audit') {
        if (!await requireRole(req, res, ['admin'])) return;
        const limit = Math.min(200, Number(req.query.limit) || 100);
        const rows = await db(`/app_audit_logs?order=created_at.desc&limit=${limit}`);
        return res.status(200).json(Array.isArray(rows) ? rows : []);
      }

      // 시스템 진단 (admin)
      if (action === 'diag') {
        if (!await requireRole(req, res, ['admin'])) return;
        const env = {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
          SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
          ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
          APP_LOGIN_ID: !!process.env.APP_LOGIN_ID,
          APP_SESSION_SECRET: !!process.env.APP_SESSION_SECRET,
        };
        const tables = {};
        for (const t of ['app_users', 'app_settings', 'app_audit_logs', 'projects', 'ossp', 'writing_guides']) {
          try { await db(`/${t}?select=1&limit=1`); tables[t] = 'ok'; }
          catch (e) { tables[t] = (e.message === 'SETUP_REQUIRED') ? 'missing' : 'error'; }
        }
        let userCount = 0, adminCount = 0;
        try {
          const us = await db('/app_users?select=id,role,is_active');
          userCount = us.length;
          adminCount = us.filter(u => u.role === 'admin' && u.is_active).length;
        } catch { /* 테이블 미생성 상태 */ }

        const ai = await getSetting('ai', {});
        return res.status(200).json({
          env, tables, userCount, adminCount,
          aiKeySource: ai?.apiKey ? 'db' : (process.env.ANTHROPIC_API_KEY ? 'env' : 'none'),
          node: process.version,
          checkedAt: new Date().toISOString(),
        });
      }

      // 전체 설정 (로그인한 사용자 누구나 — 조직·문서 기본값 프리필에 필요)
      if (!await requireRole(req, res, [])) return;
      return res.status(200).json(await loadAll());
    }

    // ── 저장 (admin 전용) ───────────────────────────────────────────
    if (req.method === 'PUT') {
      if (!await requireRole(req, res, ['admin'])) return;
      const sess = await getAuth(req);
      const { key, value } = req.body || {};
      if (!SETTING_KEYS.includes(key)) {
        return res.status(400).json({ error: `알 수 없는 설정 키입니다: ${key}` });
      }

      const prev = await getSetting(key, {});
      let next = { ...DEFAULTS[key], ...prev, ...(value || {}) };
      let detail = '';

      if (key === 'ai') {
        const incoming = value || {};
        // apiKey 규칙: undefined/'' → 기존 유지, null → 삭제, 그 외 → 교체
        if (incoming.apiKey === null) { delete next.apiKey; detail = 'API 키 삭제'; }
        else if (typeof incoming.apiKey === 'string' && incoming.apiKey.trim()) {
          const k = incoming.apiKey.trim();
          if (!/^sk-ant-/.test(k)) return res.status(400).json({ error: 'Anthropic API 키 형식이 아닙니다. (sk-ant- 로 시작해야 합니다)' });
          next.apiKey = k;
          detail = 'API 키 변경';
        } else { next.apiKey = prev.apiKey; }
        if (next.apiKey === undefined) delete next.apiKey;

        next.model = String(next.model || DEFAULTS.ai.model).trim().slice(0, 80);
        next.maxTokens = Math.min(64000, Math.max(256, Number(next.maxTokens) || DEFAULTS.ai.maxTokens));
        next.updatedAt = new Date().toISOString();
        detail = [detail, `model=${next.model}`, `maxTokens=${next.maxTokens}`].filter(Boolean).join(', ');
        // 마스킹/조회 전용 필드는 저장하지 않음
        ['hasKey', 'keySource', 'keyMasked'].forEach(f => { delete next[f]; });
      }

      if (key === 'organization') {
        for (const f of ['clientLogo', 'companyLogo']) {
          const v = next[f];
          if (v && typeof v === 'object' && typeof v.dataUrl === 'string' && v.dataUrl.length > LOGO_MAX) {
            return res.status(400).json({ error: `${f === 'clientLogo' ? '고객사' : '우리회사'} 기본 로고가 너무 큽니다. 300KB 이하 PNG/JPG를 사용하세요.` });
          }
        }
        detail = `orgName=${next.orgName || '-'}`;
      }

      if (key === 'qa_defaults') {
        next.holidays = Array.isArray(next.holidays) ? next.holidays.slice(0, 400) : [];
        detail = `scale=${next.scale}, method=${next.method}, level=${next.processLevel}`;
      }

      if (key === 'doc_defaults') detail = `prefix=${next.codePrefix || '-'}`;

      await putSetting(key, next);
      await audit(sess.login_id, 'settings.update', key, detail);
      return res.status(200).json(await loadAll());
    }

    // ── 동작 (admin 전용) ───────────────────────────────────────────
    if (req.method === 'POST') {
      if (!await requireRole(req, res, ['admin'])) return;
      const sess = await getAuth(req);
      const { action, apiKey, model } = req.body || {};

      if (action === 'verify_key') {
        // 입력된 키가 있으면 그 키를, 없으면 저장된 키(DB→env)를 검증
        let k = (typeof apiKey === 'string' && apiKey.trim()) ? apiKey.trim() : '';
        if (!k) {
          const ai = await getSetting('ai', {});
          k = ai?.apiKey || process.env.ANTHROPIC_API_KEY || '';
        }
        if (!k) return res.status(400).json({ ok: false, message: '검증할 API 키가 없습니다. 키를 입력하거나 먼저 저장하세요.' });
        const ai = await getSetting('ai', {});
        const result = await verifyAnthropicKey(k, model || ai?.model || DEFAULTS.ai.model);
        await audit(sess.login_id, 'settings.verify_key', 'anthropic', result.ok ? 'ok' : result.message);
        return res.status(200).json(result);
      }

      return res.status(400).json({ error: `알 수 없는 action: ${action}` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return errorResponse(res, e);
  }
}
