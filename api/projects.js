const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

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

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const data = await supabase('/projects?order=created_at.desc');
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
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

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });
      // return=representation: 삭제된 행을 돌려받아 실제 삭제 건수를 확인
      // (0건이면 해당 id가 없거나 RLS/권한으로 삭제되지 않은 것)
      const deleted = await supabase(`/projects?id=eq.${encodeURIComponent(id)}`, 'DELETE', null, 'return=representation');
      const count = Array.isArray(deleted) ? deleted.length : 0;
      if (count === 0) {
        return res.status(404).json({ error: '삭제된 행이 없습니다. (id 불일치 또는 권한/RLS 확인 필요)', id });
      }
      return res.status(200).json({ success: true, deleted: count });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message, detail: error.detail || null });
  }
}
