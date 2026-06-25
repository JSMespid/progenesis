const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function supabase(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': method === 'POST' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : null,
  });
  return res.json();
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const data = await supabase('/ossp?order=created_at.desc');
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { label, description, phases } = req.body || {};
      if (!label || !Array.isArray(phases) || phases.length === 0) {
        return res.status(400).json({ error: '이름과 1개 이상의 단계가 필요합니다.' });
      }
      const data = await supabase('/ossp', 'POST', {
        label,
        description: description || '',
        phases,
      });
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await supabase(`/ossp?id=eq.${id}`, 'DELETE');
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
