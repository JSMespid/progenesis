const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function supabase(path, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${token || SUPABASE_KEY}`,
    'Prefer': method === 'POST' ? 'return=representation' : '',
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method, headers, body: body ? JSON.stringify(body) : null,
  });
  if (r.status === 204) return [];
  return r.json();
}

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { table, action, id, data } = req.body || {};

  // GET 요청
  if (req.method === 'GET') {
    const { table: t, filter } = req.query;
    let path = `/${t}?order=order_num.asc,created_at.asc`;
    if (filter) path += `&${filter}`;
    const result = await supabase(path, 'GET', null, token);
    return res.status(200).json(result);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 생성
  if (action === 'create') {
    const result = await supabase(`/${table}`, 'POST', data, token);
    return res.status(200).json(result);
  }

  // 수정
  if (action === 'update') {
    const result = await supabase(`/${table}?id=eq.${id}`, 'PATCH', data, token);
    return res.status(200).json(result);
  }

  // 삭제
  if (action === 'delete') {
    await supabase(`/${table}?id=eq.${id}`, 'DELETE', null, token);
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
