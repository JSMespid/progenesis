const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  // 서명된 임시 URL 발급
  if (req.method === 'GET') {
    const { path } = req.query;
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/ossp-files/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token || SUPABASE_KEY}` },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    const data = await r.json();
    return res.status(200).json({ url: `${SUPABASE_URL}/storage/v1${data.signedURL}` });
  }

  // 파일 삭제
  if (req.method === 'DELETE') {
    const { path } = req.query;
    await fetch(`${SUPABASE_URL}/storage/v1/object/ossp-files/${path}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
    });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
