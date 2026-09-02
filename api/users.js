// api/users.js
// 사용자 계정 관리 — 등록(ID/PW)·조회·수정·삭제·비밀번호 변경.
// 비밀번호는 PBKDF2-SHA256 해시로만 저장하며, 어떤 응답에도 pw_hash를 포함하지 않는다.
//
// 사전 조건: api/_auth.js의 SETUP_SQL을 Supabase SQL Editor에서 1회 실행.

import {
  db, hashPw, verifyPw, checkPwPolicy, getAuth, requireRole,
  audit, errorResponse, ROLES,
} from './_auth.js';

const SAFE_COLS = 'id,login_id,name,email,role,is_active,last_login_at,created_at';

export default async function handler(req, res) {
  try {
    // ── 목록 조회 (admin 전용) ──────────────────────────────────────
    if (req.method === 'GET') {
      if (!await requireRole(req, res, ['admin'])) return;
      const rows = await db(`/app_users?order=created_at.asc&select=${SAFE_COLS}`);
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    }

    // ── 등록 (admin 전용) ───────────────────────────────────────────
    if (req.method === 'POST') {
      if (!await requireRole(req, res, ['admin'])) return;
      const sess = await getAuth(req);
      const { login_id, pw, name, email, role } = req.body || {};

      const lid = String(login_id || '').trim();
      if (!/^[A-Za-z0-9._-]{3,40}$/.test(lid)) {
        return res.status(400).json({ error: '아이디는 영문·숫자·(._-) 조합 3~40자여야 합니다.' });
      }
      const pwErr = checkPwPolicy(pw);
      if (pwErr) return res.status(400).json({ error: pwErr });
      const r = ROLES.includes(role) ? role : 'qa';

      const dup = await db(`/app_users?login_id=eq.${encodeURIComponent(lid)}&select=id`);
      if (Array.isArray(dup) && dup.length) {
        return res.status(409).json({ error: `이미 사용 중인 아이디입니다: ${lid}` });
      }

      const created = await db('/app_users', 'POST', {
        login_id: lid,
        pw_hash: hashPw(pw),
        name: String(name || '').trim().slice(0, 60),
        email: String(email || '').trim().slice(0, 120),
        role: r,
        is_active: true,
      });
      const row = Array.isArray(created) ? created[0] : created;
      await audit(sess.login_id, 'user.create', lid, `role=${r}`);
      if (row) delete row.pw_hash;
      return res.status(200).json(row || { ok: true });
    }

    // ── 수정 ───────────────────────────────────────────────────────
    //   admin       : 이름·이메일·역할·활성화·비밀번호 초기화 가능
    //   본인(self)  : 자기 비밀번호만 변경 (현재 비밀번호 확인 필요)
    if (req.method === 'PATCH') {
      const sess = await getAuth(req);
      if (!sess) return res.status(401).json({ error: '로그인이 필요합니다.', code: 'UNAUTHENTICATED' });

      const { id, action, currentPw, newPw, name, email, role, is_active } = req.body || {};

      // 본인 비밀번호 변경
      if (action === 'change_own_pw') {
        if (sess.uid === 'env') {
          return res.status(400).json({ error: '환경변수 기반 관리자 계정은 비밀번호를 화면에서 변경할 수 없습니다. Vercel 환경변수(APP_LOGIN_PW)를 수정하세요.' });
        }
        const pwErr = checkPwPolicy(newPw);
        if (pwErr) return res.status(400).json({ error: pwErr });
        const rows = await db(`/app_users?id=eq.${encodeURIComponent(sess.uid)}&select=id,login_id,pw_hash`);
        const me = Array.isArray(rows) ? rows[0] : null;
        if (!me) return res.status(404).json({ error: '계정을 찾을 수 없습니다.' });
        if (!verifyPw(currentPw, me.pw_hash)) {
          return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
        }
        await db(`/app_users?id=eq.${encodeURIComponent(me.id)}`, 'PATCH', { pw_hash: hashPw(newPw) }, 'return=minimal');
        await audit(sess.login_id, 'user.change_own_pw', me.login_id, '');
        return res.status(200).json({ ok: true });
      }

      // 이하 admin 전용
      if (!await requireRole(req, res, ['admin'])) return;
      if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });

      const rows = await db(`/app_users?id=eq.${encodeURIComponent(id)}&select=id,login_id,role,is_active`);
      const target = Array.isArray(rows) ? rows[0] : null;
      if (!target) return res.status(404).json({ error: '대상 사용자를 찾을 수 없습니다.' });

      const patch = {};
      if (name !== undefined) patch.name = String(name).trim().slice(0, 60);
      if (email !== undefined) patch.email = String(email).trim().slice(0, 120);
      if (role !== undefined) {
        if (!ROLES.includes(role)) return res.status(400).json({ error: '알 수 없는 역할입니다.' });
        patch.role = role;
      }
      if (is_active !== undefined) patch.is_active = !!is_active;
      if (newPw !== undefined && newPw !== '') {           // 관리자 비밀번호 초기화
        const pwErr = checkPwPolicy(newPw);
        if (pwErr) return res.status(400).json({ error: pwErr });
        patch.pw_hash = hashPw(newPw);
      }
      if (!Object.keys(patch).length) return res.status(400).json({ error: '수정할 항목이 없습니다.' });

      // 마지막 활성 관리자 보호 — 역할 강등·비활성화로 시스템 잠김 방지
      const losingAdmin = (patch.role !== undefined && patch.role !== 'admin' && target.role === 'admin')
        || (patch.is_active === false && target.role === 'admin');
      if (losingAdmin) {
        const admins = await db('/app_users?role=eq.admin&is_active=eq.true&select=id');
        if (Array.isArray(admins) && admins.length <= 1) {
          return res.status(400).json({ error: '활성 관리자는 최소 1명 이상 유지해야 합니다.' });
        }
      }

      await db(`/app_users?id=eq.${encodeURIComponent(id)}`, 'PATCH', patch, 'return=minimal');
      const changed = Object.keys(patch).map(k => (k === 'pw_hash' ? '비밀번호 초기화' : k)).join(', ');
      await audit(sess.login_id, 'user.update', target.login_id, changed);
      return res.status(200).json({ ok: true });
    }

    // ── 삭제 (admin 전용) ───────────────────────────────────────────
    if (req.method === 'DELETE') {
      if (!await requireRole(req, res, ['admin'])) return;
      const sess = await getAuth(req);
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });

      const rows = await db(`/app_users?id=eq.${encodeURIComponent(id)}&select=id,login_id,role,is_active`);
      const target = Array.isArray(rows) ? rows[0] : null;
      if (!target) return res.status(404).json({ error: '대상 사용자를 찾을 수 없습니다.' });
      if (String(sess.uid) === String(id)) {
        return res.status(400).json({ error: '자기 계정은 삭제할 수 없습니다.' });
      }
      if (target.role === 'admin' && target.is_active) {
        const admins = await db('/app_users?role=eq.admin&is_active=eq.true&select=id');
        if (Array.isArray(admins) && admins.length <= 1) {
          return res.status(400).json({ error: '활성 관리자는 최소 1명 이상 유지해야 합니다.' });
        }
      }

      await db(`/app_users?id=eq.${encodeURIComponent(id)}`, 'DELETE', null, 'return=minimal');
      await audit(sess.login_id, 'user.delete', target.login_id, '');
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return errorResponse(res, e);
  }
}
