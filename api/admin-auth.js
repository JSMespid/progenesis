const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action, email, password, token } = req.body;

  // 로그인
  if (action === 'login') {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (data.error) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    return res.status(200).json({ token: data.access_token, user: data.user });
  }

  // 토큰 검증
  if (action === 'verify') {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_KEY },
    });
    const data = await r.json();
    if (data.error) return res.status(401).json({ error: '인증이 만료되었습니다.' });
    return res.status(200).json({ user: data });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
