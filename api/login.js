// api/login.js
// 간단 게이트 로그인 — 환경변수에 저장된 ID/PW와 대조.
// 주의: 이는 "가림막" 수준의 인증입니다. 실제 사용자별 접근통제가 필요하면
//       Supabase Auth 등 정식 인증으로 전환해야 합니다.
//
// 필요한 Vercel 환경변수:
//   APP_LOGIN_ID   = 로그인 아이디
//   APP_LOGIN_PW   = 로그인 비밀번호
//   APP_LOGIN_TOKEN= (선택) 로그인 성공 시 클라이언트에 줄 토큰 문자열. 없으면 기본값 사용.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ID = process.env.APP_LOGIN_ID;
  const PW = process.env.APP_LOGIN_PW;
  if (!ID || !PW) {
    return res.status(500).json({
      error: '로그인 환경변수(APP_LOGIN_ID, APP_LOGIN_PW)가 설정되지 않았습니다.',
    });
  }

  const { id, pw } = req.body || {};
  if (!id || !pw) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });
  }

  if (id === ID && pw === PW) {
    const token = process.env.APP_LOGIN_TOKEN || 'progenesis-session';
    return res.status(200).json({ ok: true, token });
  }

  return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
}
