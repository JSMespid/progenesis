// api/chat.js
// Anthropic Messages API 프록시.
// API 키 우선순위: 설정 화면에서 저장한 키(app_settings.ai.apiKey) → 환경변수 ANTHROPIC_API_KEY.
// 설정 조회는 warm 컨테이너 모듈 스코프에 60초 캐시하여 매 호출 DB 왕복을 피한다.

// ── 인증 (필수) ───────────────────────────────────────────
// 이 엔드포인트는 조직이 등록한 Claude API 키를 소비한다. 인증이 없으면 URL만 아는
// 누구나 POST로 키를 소진시킬 수 있으므로, 반드시 유효한 세션 토큰을 요구한다.
//   · Authorization: Bearer <token> (권장) 또는 body.token
//   · 허용 역할: admin / pm / qa  (viewer는 열람 전용이므로 생성 호출 불가)
//   · 서명 없는 구버전(레거시) 토큰은 검증에 실패하므로 재로그인이 필요하다.
// 주의: readToken()이 body.token도 읽으므로, Anthropic으로 전달하는 payload에서는
//       token 필드를 반드시 제거한다 (외부로 세션 토큰이 새어나가지 않도록).

import { getSetting, requireRole } from './_auth.js';

let _cache = { at: 0, ai: null };
const CACHE_TTL = 60 * 1000;

// AI 생성 호출을 허용할 역할
const AI_ROLES = ['admin', 'pm', 'qa'];

async function loadAiSettings() {
  if (Date.now() - _cache.at < CACHE_TTL && _cache.ai) return _cache.ai;
  let ai = null;
  try { ai = await getSetting('ai', null); } catch { ai = null; }
  _cache = { at: Date.now(), ai: ai || {} };
  return _cache.ai;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 세션 검증: 실패 시 requireRole이 401/403을 직접 응답하고 null 반환 ──
  let sess;
  try {
    sess = await requireRole(req, res, AI_ROLES);
  } catch (e) {
    // 설정 테이블 미생성 등 DB 오류 — 인증 불가이므로 호출을 막는다
    return res.status(503).json({
      error: 'AI 호출 인증에 실패했습니다: ' + ((e && e.message) || '알 수 없는 오류'),
      code: 'AUTH_UNAVAILABLE',
    });
  }
  if (!sess) return;   // 응답은 requireRole이 이미 기록함

  const ai = await loadAiSettings();
  const apiKey = (ai && ai.apiKey) || process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Claude API 키가 없습니다. 설정 → AI 연동에서 API 키를 등록하거나 Vercel 환경변수(ANTHROPIC_API_KEY)를 설정하세요.',
      code: 'NO_API_KEY',
    });
  }

  // 클라이언트가 모델·토큰을 지정하지 않은 경우에만 설정값으로 보완
  const payload = { ...(req.body || {}) };
  delete payload.token;   // 세션 토큰이 Anthropic 요청 본문에 포함되지 않도록 제거
  if (!payload.model && ai?.model) payload.model = ai.model;
  if (!payload.max_tokens && ai?.maxTokens) payload.max_tokens = Number(ai.maxTokens);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    // 응답 본문을 먼저 텍스트로 받아 빈/비정상 응답을 방어
    const text = await response.text();

    if (!response.ok) {
      // Anthropic이 에러를 준 경우, 상태코드와 본문을 그대로 전달해 원인 파악 가능
      let detail;
      try { detail = JSON.parse(text); } catch { detail = { raw: text }; }
      if (response.status === 401) _cache = { at: 0, ai: null };   // 키 교체 직후 캐시 무효화
      return res.status(response.status).json({
        error: 'Anthropic API 오류',
        status: response.status,
        keySource: (ai && ai.apiKey) ? 'settings' : 'env',
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
