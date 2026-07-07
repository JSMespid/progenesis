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
      const data = await supabase('/projects', 'POST', req.body, 'return=representation');
      return res.status(200).json(data);
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
