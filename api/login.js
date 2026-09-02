// api/login.js
// 로그인 — 등록 사용자(app_users) 우선 확인, 없으면 환경변수 관리자 계정으로 폴백.
//
// action:
//   (없음)    : { id, pw }로 로그인 → { ok, token, user }
//   'verify'  : { token } 유효성 확인
//   'refresh' : { token } 세션 연장. 만료 후에도 유예기간(60일) 안이면 재발급하므로
//               오래 접속하지 않았다는 이유로 로그아웃되지 않는다. 재발급 시 DB에서
//               역할·활성 상태를 다시 읽어 반영한다(관리자의 역할 변경이 즉시 적용).
//
// 폴백을 유지하는 이유: 설정 화면에서 사용자를 등록하기 전(최초 구축 시점)이나
// 관리자 계정이 모두 비활성화된 상황에서도 시스템에 진입할 수 있어야 하기 때문.
//
// 필요한 Vercel 환경변수:
//   APP_LOGIN_ID        = 부트스트랩 관리자 아이디
//   APP_LOGIN_PW        = 부트스트랩 관리자 비밀번호
//   APP_SESSION_SECRET  = (선택) 서명 키. 미설정 시 DB(app_settings.session_secret)에
//                         자동 생성·고정되므로 환경변수를 바꿔도 세션이 끊기지 않는다.

import { db, verifyPw, signToken, verifyToken } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, token, id, pw } = req.body || {};

  // ── 세션 검증 ───────────────────────────────────────────────────
  if (action === 'verify') {
    const p = await verifyToken(token);
    if (!p) return res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해 주세요.' });
    return res.status(200).json({ ok: true, user: p });
  }

  // ── 세션 연장 (앱 기동 시 자동 호출) ────────────────────────────
  if (action === 'refresh') {
    const p = await verifyToken(token, { allowExpired: true });
    if (!p) return res.status(401).json({ error: '세션을 연장할 수 없습니다. 다시 로그인해 주세요.', code: 'UNAUTHENTICATED' });

    let user = { uid: p.uid, login_id: p.login_id, name: p.name, role: p.role, source: p.source || 'db' };

    // 등록 사용자면 최신 역할·활성 상태를 반영 (비활성화된 계정은 연장 거부)
    if (p.uid && p.uid !== 'env') {
      try {
        const rows = await db(`/app_users?id=eq.${encodeURIComponent(p.uid)}&select=id,login_id,name,role,is_active`);
        const u = Array.isArray(rows) ? rows[0] : null;
        if (u) {
          if (!u.is_active) return res.status(403).json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' });
          user = { uid: u.id, login_id: u.login_id, name: u.name || u.login_id, role: u.role || 'qa', source: 'db' };
        }
        // 조회 결과가 없어도(테이블 미생성 등) 기존 payload로 연장 — 사용자를 잠그지 않는다
      } catch { /* DB 일시 장애 시에도 세션을 끊지 않음 */ }
    }
    return res.status(200).json({ ok: true, token: await signToken(user), user });
  }

  if (!id || !pw) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });
  }
  const lid = String(id).trim();

  // ── 1) 등록 사용자 확인 ─────────────────────────────────────────
  try {
    const rows = await db(`/app_users?login_id=eq.${encodeURIComponent(lid)}&select=id,login_id,pw_hash,name,role,is_active`);
    const u = Array.isArray(rows) ? rows[0] : null;
    if (u) {
      if (!u.is_active) {
        return res.status(403).json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' });
      }
      if (!verifyPw(pw, u.pw_hash)) {
        return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      }
      // 최종 로그인 시각 기록 (실패해도 로그인은 진행)
      try {
        await db(`/app_users?id=eq.${u.id}`, 'PATCH', { last_login_at: new Date().toISOString() }, 'return=minimal');
      } catch { /* noop */ }

      const user = { uid: u.id, login_id: u.login_id, name: u.name || u.login_id, role: u.role || 'qa', source: 'db' };
      return res.status(200).json({ ok: true, token: await signToken(user), user });
    }
  } catch (e) {
    // app_users 테이블 미생성(SETUP_REQUIRED) 등은 무시하고 환경변수 폴백으로 진행
    if (e.message !== 'SETUP_REQUIRED') console.error('login: app_users 조회 실패 —', e.message);
  }

  // ── 2) 환경변수 부트스트랩 관리자 ───────────────────────────────
  const ENV_ID = process.env.APP_LOGIN_ID;
  const ENV_PW = process.env.APP_LOGIN_PW;
  if (ENV_ID && ENV_PW && lid === ENV_ID && String(pw) === ENV_PW) {
    const user = { uid: 'env', login_id: ENV_ID, name: '시스템 관리자', role: 'admin', source: 'env' };
    return res.status(200).json({ ok: true, token: await signToken(user), user });
  }

  if (!ENV_ID || !ENV_PW) {
    return res.status(500).json({
      error: '등록된 사용자가 없고 부트스트랩 환경변수(APP_LOGIN_ID, APP_LOGIN_PW)도 설정되지 않았습니다.',
    });
  }

  return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
}
