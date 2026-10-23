import { requireRole, audit, READ_ROLES, WRITE_ROLES, MANAGE_ROLES } from './_auth.js';
import { deleteBlob, validBlobPath } from './project-blobs.js';
const SUPABASE_URL = process.env.SUPABASE_URL;
// RLS 활성화 대응: 서버 전용 service_role 키 사용 (RLS 우회는 서버에서만, requireRole로 접근 통제)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Supabase REST 호출 공통 헬퍼
// - 204 No Content 등 빈 본문을 안전하게 처리 (기존 res.json() 호출이 빈 본문에서 예외 → DELETE 500의 원인)
// - Supabase가 에러를 반환하면 상태코드·메시지를 그대로 전달해 원인 파악 가능하게 함
async function supabase(path, method = 'GET', body = null, prefer = null) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  };
  if (prefer) headers['Prefer'] = prefer;

  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const text = await res.text();                     // 빈 본문(204) 대비: json() 대신 text()로 읽기
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch (_) { data = { raw: text.slice(0, 300) }; }
  }

  if (!res.ok) {
    const msg = (data && (data.message || data.error || data.hint)) || `Supabase ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

// ── 팀 공유 편집: 편집 잠금(한 번에 한 사람) ─────────────────────────
// 잠금은 app_settings 테이블에 key='projlock:<프로젝트 id>'로 보관한다 (DB 스키마 변경 없음).
// value = { by: login_id, name, at, until } — until이 지나면 자동 해제로 본다 (편집 화면이 60초마다 연장).
// 잠금은 '사용자 안내'이고, 데이터 보호의 최종 장치는 PATCH의 버전(rev) 확인이다.
const LOCK_TTL_MS = 3 * 60 * 1000;
const lockKey = id => `projlock:${id}`;
const nowIso = () => new Date().toISOString();
const q = v => `"${String(v).replace(/["\\]/g, '')}"`;   // PostgREST 논리식 안의 값 인용
async function getLock(id) {
  const rows = await supabase(`/app_settings?key=eq.${encodeURIComponent(lockKey(id))}&select=value`);
  const v = Array.isArray(rows) && rows[0] ? rows[0].value : null;
  return v && v.until && v.until > nowIso() ? v : null;   // 만료된 잠금은 없는 것으로
}
async function acquireLock(id, sess, force) {
  const me = String(sess.login_id || '');
  const val = { by: me, name: String(sess.name || me), at: nowIso(), until: new Date(Date.now() + LOCK_TTL_MS).toISOString() };
  const key = lockKey(id);
  if (force) {
    await supabase('/app_settings?on_conflict=key', 'POST', { key, value: val, updated_at: nowIso() }, 'resolution=merge-duplicates,return=minimal');
    return { ok: true, lock: val };
  }
  // 1) 잠금이 없으면 새로 만든다 (키 중복이면 실패 → 2로)
  try {
    await supabase('/app_settings', 'POST', { key, value: val, updated_at: nowIso() }, 'return=minimal');
    return { ok: true, lock: val };
  } catch (_) { /* 이미 있음 */ }
  // 2) 만료됐거나 내 잠금이면 조건부로 갱신 (원자적: 조건이 맞는 행만 바뀐다)
  const cond = encodeURIComponent(`(value->>until.lt.${q(nowIso())},value->>by.eq.${q(me)})`);
  const upd = await supabase(`/app_settings?key=eq.${encodeURIComponent(key)}&or=${cond}`, 'PATCH', { value: val, updated_at: nowIso() }, 'return=representation');
  if (Array.isArray(upd) && upd.length) return { ok: true, lock: val };
  return { ok: false, holder: await getLock(id) };
}
async function releaseLock(id, sess) {
  const me = String(sess.login_id || '');
  await supabase(`/app_settings?key=eq.${encodeURIComponent(lockKey(id))}&value->>by=eq.${encodeURIComponent(me)}`, 'DELETE', null, 'return=minimal');
}
// 저장 가능한 열만 받는다 (id·created_at 등은 클라이언트가 바꾸지 못함)
const PROJECT_FIELDS = ['name', 'client', 'type', 'start_date', 'end_date', 'pm', 'status', 'ossp', 'pdp', 'wbs', 'deliverables'];
const savedByOf = sess => ({ id: String(sess.login_id || ''), name: String(sess.name || sess.login_id || ''), at: nowIso() });

export default async function handler(req, res) {
  // ── 세션 검증 (전 엔드포인트 공통): 조회는 로그인한 모든 역할, 변경은 admin·pm·qa ──
  //    실패 시 requireRole이 401/403을 직접 응답하고 null을 반환한다.
  const sess = await requireRole(req, res, req.method === 'GET' ? READ_ROLES : WRITE_ROLES);
  if (!sess) return;
  const isLockCall = req.method === 'POST' && req.body && (req.body.action === 'lock' || req.body.action === 'unlock');
  if (!isLockCall && (req.method === 'DELETE' || req.method === 'POST' || req.method === 'PATCH')) audit(sess.login_id, `projects.${req.method.toLowerCase()}`, String((req.query && req.query.id) || (req.body && req.body.id) || ''));
  try {
    if (req.method === 'GET') {
      const data = await supabase('/projects?order=created_at.desc');
      try {
        const locks = await supabase('/app_settings?key=like.projlock:*&select=key,value');
        const now = nowIso();
        const byId = {};
        (Array.isArray(locks) ? locks : []).forEach(l => { if (l.value && l.value.until > now) byId[String(l.key).slice(9)] = { by: l.value.by, name: l.value.name, at: l.value.at }; });
        (Array.isArray(data) ? data : []).forEach(p => { if (byId[p.id]) p._lock = byId[p.id]; });
      } catch (_) { /* 잠금 조회 실패는 목록에 영향 없음 */ }
      return res.status(200).json(data);
    }

    if (req.method === 'POST' && req.body && (req.body.action === 'lock' || req.body.action === 'unlock')) {
      const id = String(req.body.id || '');
      if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });
      if (req.body.action === 'unlock') { await releaseLock(id, sess); return res.status(200).json({ ok: true }); }
      const r = await acquireLock(id, sess, !!req.body.force);
      if (!r.ok) return res.status(423).json({ ok: false, holder: r.holder, error: `${(r.holder && r.holder.name) || '다른 팀원'}님이 편집 중입니다.` });
      if (req.body.force) audit(sess.login_id, 'projects.lock.force', id);
      return res.status(200).json(r);
    }

    if (req.method === 'POST') {
      // 버전(rev)·저장자 — 팀 공유 편집의 충돌 확인 기준 (tailoring JSON 안 — 스키마 변경 없음)
      if (req.body && typeof req.body === 'object') req.body.tailoring = { ...(req.body.tailoring || {}), rev: 1, savedBy: savedByOf(sess) };
      // ── 중복 생성 방지(멱등 처리) ──────────────────────────────────
      // 위저드 "완료" 버튼 연타나 네트워크 재시도로 같은 프로젝트가 여러 건 저장되는 것을 막는다.
      // 최근 90초 안에 이름·고객사가 동일한 행이 이미 있으면 새로 만들지 않고 그 행을 그대로 돌려준다.
      // (필터 이스케이프 이슈를 피하려고 최근 목록을 받아 JS에서 비교한다 — 프로젝트명에 괄호·점이 흔함)
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const client = String(body.client || '').trim();
      if (name) {
        try {
          const recent = await supabase('/projects?order=created_at.desc&limit=20');
          const since = Date.now() - 90 * 1000;
          const dup = (Array.isArray(recent) ? recent : []).find(p =>
            String(p.name || '').trim() === name &&
            String(p.client || '').trim() === client &&
            new Date(p.created_at).getTime() >= since);
          if (dup) {
            // 200으로 응답해 클라이언트 흐름은 정상 진행시키되, 새 행은 만들지 않는다
            return res.status(200).json([dup]);
          }
        } catch (_) { /* 조회 실패 시에는 그냥 생성 진행 (저장 실패보다 중복이 낫다) */ }
      }

      const created = await supabase('/projects', 'POST', req.body, 'return=representation');
      const row = Array.isArray(created) ? created[0] : created;

      // ── 사후 확인(경쟁 조건 대비) ────────────────────────────────
      // 사전 검사는 "조회 후 삽입" 사이에 다른 요청이 끼어들면 통과한다(연타 시 동시 요청).
      // 삽입 직후 같은 키의 행이 여러 건이면, 가장 먼저 만들어진 1건만 남기고
      // "이번 요청이 만든 행"만 되돌린다. 남의 행은 건드리지 않으므로 동시 요청이
      // 몇 개든 각자 자기 몫만 회수해 결과가 1건으로 수렴한다.
      if (name && row && row.id) {
        try {
          const recent = await supabase('/projects?order=created_at.desc&limit=30');
          const since = Date.now() - 90 * 1000;
          const same = (Array.isArray(recent) ? recent : [])
            .filter(p => String(p.name || '').trim() === name &&
                         String(p.client || '').trim() === client &&
                         new Date(p.created_at).getTime() >= since)
            // created_at이 동률일 수 있으므로 id로 결정적 정렬 → 모든 요청이 같은 '최초 행'을 고른다
            .sort((a, b) => (new Date(a.created_at) - new Date(b.created_at)) || String(a.id).localeCompare(String(b.id)));
          const first = same[0];
          if (first && String(first.id) !== String(row.id)) {
            await supabase(`/projects?id=eq.${encodeURIComponent(row.id)}`, 'DELETE', null, 'return=minimal');
            return res.status(200).json([first]);   // 먼저 저장된 행을 결과로 돌려준다
          }
        } catch (_) { /* 회수 실패 시에는 생성된 행을 그대로 반환 */ }
      }

      return res.status(200).json(created);
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const id = String(body.id || '');
      const rec = body.record;
      if (!id || !rec || typeof rec !== 'object') return res.status(400).json({ error: 'id와 record가 필요합니다.' });
      // 1) 편집 잠금: 다른 사람이 잡고 있으면 저장하지 않는다
      const lock = await getLock(id);
      if (lock && lock.by !== String(sess.login_id || '')) return res.status(423).json({ error: `${lock.name || lock.by}님이 편집 중이라 저장하지 않았습니다.`, holder: lock });
      // 2) 버전 확인: 내가 마지막으로 받은 버전과 서버 버전이 같아야 저장 (다른 팀원의 저장을 덮어쓰지 않음)
      const cur = await supabase(`/projects?id=eq.${encodeURIComponent(id)}&select=id,rev:tailoring->>rev,blob:tailoring->requirementsBlob->>path,savedBy:tailoring->savedBy`);
      if (!Array.isArray(cur) || !cur.length) return res.status(404).json({ error: '프로젝트가 없습니다 (다른 팀원이 삭제했을 수 있습니다).' });
      const curRev = cur[0].rev == null ? null : Number(cur[0].rev);
      const expect = body.expectRev == null ? null : Number(body.expectRev);
      const conflict = () => res.status(409).json({ error: '다른 팀원이 먼저 저장했습니다.', currentRev: curRev, savedBy: cur[0].savedBy || null });
      if (curRev !== expect) return conflict();
      const newRev = (curRev || 0) + 1;
      const patch = {};
      PROJECT_FIELDS.forEach(k => { if (k in rec) patch[k] = rec[k]; });
      patch.tailoring = { ...(rec.tailoring || {}), rev: newRev, savedBy: savedByOf(sess) };
      const revFilter = curRev == null ? 'tailoring->>rev=is.null' : `tailoring->>rev=eq.${curRev}`;
      const upd = await supabase(`/projects?id=eq.${encodeURIComponent(id)}&${revFilter}`, 'PATCH', patch, 'return=representation');
      if (!Array.isArray(upd) || !upd.length) return conflict();   // 확인 직후 다른 저장이 끼어든 경우
      // 3) 이전 V-모델 파일 정리 (새 경로로 바뀐 경우, 다른 행이 참조하지 않을 때만)
      const oldPath = cur[0].blob, newPath = patch.tailoring.requirementsBlob && patch.tailoring.requirementsBlob.path;
      if (oldPath && oldPath !== newPath && validBlobPath(oldPath)) {
        try {
          const refs = await supabase(`/projects?select=id&tailoring->requirementsBlob->>path=eq.${encodeURIComponent(oldPath)}`);
          if (!Array.isArray(refs) || refs.length === 0) await deleteBlob(oldPath);
        } catch (_) { /* 정리 실패는 저장 결과에 영향 없음 */ }
      }
      return res.status(200).json(upd[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });
      // 이 행이 Storage에 분리 보관한 V-모델 데이터 경로 (삭제 성공 후 정리) — 수정 저장 시 새 행은 새 경로를 쓰므로 안전
      let blobPath = null;
      try {
        const cur = await supabase(`/projects?id=eq.${encodeURIComponent(id)}&select=blob:tailoring->requirementsBlob->>path`);
        blobPath = Array.isArray(cur) && cur[0] ? cur[0].blob : null;
      } catch (_) { /* 조회 실패해도 삭제는 진행 */ }
      // return=representation: 삭제된 행을 돌려받아 실제 삭제 건수를 확인
      // (0건이면 해당 id가 없거나 RLS/권한으로 삭제되지 않은 것)
      const deleted = await supabase(`/projects?id=eq.${encodeURIComponent(id)}`, 'DELETE', null, 'return=representation');
      const count = Array.isArray(deleted) ? deleted.length : 0;
      if (count === 0) {
        return res.status(404).json({ error: '삭제된 행이 없습니다. (id 불일치 또는 권한/RLS 확인 필요)', id });
      }
      if (blobPath && validBlobPath(blobPath)) {
        // 같은 경로를 참조하는 다른 행이 없을 때만 지운다 (방어적 확인)
        try {
          const refs = await supabase(`/projects?select=id&tailoring->requirementsBlob->>path=eq.${encodeURIComponent(blobPath)}`);
          if (!Array.isArray(refs) || refs.length === 0) await deleteBlob(blobPath);
        } catch (_) { /* 정리 실패는 삭제 결과에 영향 없음 */ }
      }
      try { await supabase(`/app_settings?key=eq.${encodeURIComponent(lockKey(id))}`, 'DELETE', null, 'return=minimal'); } catch (_) {}
      return res.status(200).json({ success: true, deleted: count });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message, detail: error.detail || null });
  }
}
