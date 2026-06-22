export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인하세요.',
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    // 응답 본문을 먼저 텍스트로 받아 빈/비정상 응답을 방어
    const text = await response.text();

    if (!response.ok) {
      // Anthropic이 에러를 준 경우, 상태코드와 본문을 그대로 전달해 원인 파악 가능
      let detail;
      try { detail = JSON.parse(text); } catch { detail = { raw: text }; }
      return res.status(response.status).json({
        error: 'Anthropic API 오류',
        status: response.status,
        detail,
      });
    }

    // 정상 응답
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: 'Anthropic 응답을 파싱할 수 없습니다.',
        raw: text.slice(0, 500),
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
