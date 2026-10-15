// api/review.js
// 검토 AI(교차검토) 프록시 — ASPICE V-모델 산출물의 "2단 AI 의견"을 생성 AI와 다른 모델로 받는다.
//
// 설계
//  · 검토 AI는 교체 가능: OpenAI 호환(Chat Completions) 어댑터 1개로 Gemini·OpenAI·사내 LLM(vLLM·Ollama 등)을 모두 연결,
//    Anthropic은 별도 어댑터(생성 AI와 같은 계열이므로 화면에 '독립성 낮음' 경고).
//  · 기본값: Google Gemini (OpenAI 호환 엔드포인트).
//  · 설정은 app_settings.review 에 저장 { provider, model, baseUrl, apiKeys:{gemini,openai,custom,anthropic} }.
//    키는 서버에만 보관하고 화면에는 마스킹만 내려보낸다. 설정이 없으면 환경변수로 폴백.
//      GEMINI_API_KEY / OPENAI_API_KEY / REVIEW_API_KEY(사내 서버) / ANTHROPIC_API_KEY, REVIEW_PROVIDER, REVIEW_MODEL
//  · 검토 의견의 형식 검증·근거 인용 대조(환각 필터)는 클라이언트 규칙 엔진(aspiceEngineering.js)이 수행한다.
//
// 엔드포인트
//  GET  ?action=config                → 현재 검토 AI 설정(마스킹)            [로그인 사용자]
//  PUT  { provider, model, baseUrl, apiKey|null }  → 설정 저장                 [admin]
//  POST { action:'verify', ... }      → 연결 검증 + 사용 가능 모델 목록         [admin]
//  POST { action:'review', system, prompt, maxTokens } → 검토 호출            [admin·pm·qa]

import { getSetting, putSetting, maskKey, requireRole, audit, errorResponse } from './_auth.js';

const PROVIDERS = {
  gemini:    { label: 'Google Gemini', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', env: 'GEMINI_API_KEY', defModel: 'gemini-2.5-flash' },
  openai:    { label: 'OpenAI (GPT 계열)', kind: 'openai', baseUrl: 'https://api.openai.com/v1', env: 'OPENAI_API_KEY', defModel: '' },
  custom:    { label: 'OpenAI 호환 서버 (사내 LLM 등)', kind: 'openai', baseUrl: '', env: 'REVIEW_API_KEY', defModel: '' },
  anthropic: { label: 'Anthropic Claude', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', env: 'ANTHROPIC_API_KEY', defModel: 'claude-haiku-4-5-20251001' },
  none:      { label: '사용 안 함 (규칙 검사·사람 판정만)', kind: 'none', baseUrl: '', env: '', defModel: '' },
};
const REVIEW_ROLES = ['admin', 'pm', 'qa'];
const TIMEOUT_MS = 9000;   // Vercel 함수 제한(약 10초) 안에서 깔끔한 오류를 돌려주기 위함

let _cache = { at: 0, cfg: null };
async function loadCfg(force = false) {
  if (!force && _cache.cfg && Date.now() - _cache.at < 60 * 1000) return _cache.cfg;
  let s = null;
  try { s = await getSetting('review', null); } catch { s = null; }
  _cache = { at: Date.now(), cfg: s || {} };
  return _cache.cfg;
}

// 저장 설정 + 환경변수 → 실제 호출에 쓸 값
async function resolve(cfgIn, override = {}) {
  const cfg = { ...(cfgIn || {}) };
  const provider = override.provider || cfg.provider || process.env.REVIEW_PROVIDER || 'gemini';
  const P = PROVIDERS[provider] || PROVIDERS.gemini;
  const keys = cfg.apiKeys || {};
  let apiKey = override.apiKey || keys[provider] || (P.env ? process.env[P.env] : '') || '';
  let keySource = override.apiKey ? 'input' : keys[provider] ? 'db' : (P.env && process.env[P.env]) ? 'env' : 'none';
  if (provider === 'anthropic' && !apiKey) {   // 생성 AI와 같은 키를 재사용
    try { const ai = await getSetting('ai', null); if (ai?.apiKey) { apiKey = ai.apiKey; keySource = 'db(ai)'; } } catch { /* 무시 */ }
  }
  const baseUrl = String(override.baseUrl || (provider === 'custom' ? cfg.baseUrl : '') || P.baseUrl || '').replace(/\/+$/, '');
  const model = override.model || cfg.model || process.env.REVIEW_MODEL || P.defModel || '';
  return { provider, P, apiKey, keySource, baseUrl, model };
}

function publicView(r) {
  return {
    provider: r.provider, label: r.P.label, kind: r.P.kind, model: r.model,
    baseUrl: r.provider === 'custom' ? r.baseUrl : '',
    hasKey: !!r.apiKey, keySource: r.keySource, keyMasked: maskKey(r.apiKey),
    sameAsGenerator: r.P.kind === 'anthropic',
    providers: Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label, kind: p.kind })),
  };
}

async function fetchT(url, opts) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (e.name === 'AbortError') { const x = new Error('검토 AI 응답 시간 초과 — 한 번에 보내는 요구 수를 줄이거나 더 빠른 모델을 선택하세요.'); x.status = 504; throw x; } throw e; }
  finally { clearTimeout(t); }
}

// OpenAI 호환 Chat Completions (Gemini·OpenAI·사내 LLM 공통)
async function callOpenAICompat(r, system, prompt, maxTokens) {
  const body = {
    model: r.model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: maxTokens,
  };
  const send = b => fetchT(`${r.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${r.apiKey}` },
    body: JSON.stringify(b),
  });
  let resp = await send(body);
  let text = await resp.text();
  // 일부 추론형 모델은 temperature·max_tokens를 거부 → 해당 파라미터를 바꿔 1회 재시도
  if (resp.status === 400 && /temperature|max_tokens/i.test(text)) {
    const b2 = { ...body }; delete b2.temperature;
    if (/max_tokens/i.test(text)) { delete b2.max_tokens; b2.max_completion_tokens = maxTokens; }
    resp = await send(b2); text = await resp.text();
  }
  if (!resp.ok) { const e = new Error(`검토 AI 오류 (HTTP ${resp.status}): ${pickMsg(text)}`); e.status = resp.status === 401 || resp.status === 403 ? 502 : resp.status; throw e; }
  let data; try { data = JSON.parse(text); } catch { throw new Error('검토 AI 응답을 해석할 수 없습니다.'); }
  return { text: data?.choices?.[0]?.message?.content || '', model: data?.model || r.model };
}

async function callAnthropic(r, system, prompt, maxTokens) {
  const resp = await fetchT(`${r.baseUrl}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': r.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: r.model, max_tokens: maxTokens, temperature: 0, system, messages: [{ role: 'user', content: prompt }] }),
  });
  const text = await resp.text();
  if (!resp.ok) { const e = new Error(`검토 AI 오류 (HTTP ${resp.status}): ${pickMsg(text)}`); e.status = resp.status === 401 ? 502 : resp.status; throw e; }
  const data = JSON.parse(text);
  return { text: (data.content || []).map(b => b.text || '').join(''), model: data.model || r.model };
}

function pickMsg(text) {
  try { const d = JSON.parse(text); const x = Array.isArray(d) ? d[0] : d; return x?.error?.message || x?.message || String(text).slice(0, 200); }
  catch { return String(text || '').slice(0, 200); }
}

export default async function handler(req, res) {
  try {
    // ── 설정 조회 ──
    if (req.method === 'GET') {
      if (!await requireRole(req, res, [])) return;
      const r = await resolve(await loadCfg());
      return res.status(200).json(publicView(r));
    }

    // ── 설정 저장 (admin) ──
    if (req.method === 'PUT') {
      const sess = await requireRole(req, res, ['admin']);
      if (!sess) return;
      const { provider, model, baseUrl, apiKey } = req.body || {};
      if (provider && !PROVIDERS[provider]) return res.status(400).json({ error: '알 수 없는 검토 AI 종류입니다.' });
      if (provider === 'custom' && baseUrl && !/^https:\/\//i.test(baseUrl)) return res.status(400).json({ error: '사내 서버 주소는 https:// 로 시작해야 합니다.' });
      const cur = await loadCfg(true);
      const next = { ...cur, apiKeys: { ...(cur.apiKeys || {}) } };
      if (provider) next.provider = provider;
      if (model !== undefined) next.model = String(model || '').trim();
      if (baseUrl !== undefined) next.baseUrl = String(baseUrl || '').trim();
      const p = next.provider || 'gemini';
      if (apiKey === null) delete next.apiKeys[p];
      else if (apiKey && String(apiKey).trim()) next.apiKeys[p] = String(apiKey).trim();
      next.updatedAt = new Date().toISOString();
      await putSetting('review', next);
      _cache = { at: 0, cfg: null };
      await audit(sess.login_id, 'review.settings', p, `model=${next.model || '(기본)'}`);
      return res.status(200).json(publicView(await resolve(next)));
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = req.body || {};

    // ── 연결 검증 (admin): 모델 목록 조회 + 최소 호출 ──
    if (body.action === 'verify') {
      if (!await requireRole(req, res, ['admin'])) return;
      const r = await resolve(await loadCfg(true), { provider: body.provider, model: body.model, baseUrl: body.baseUrl, apiKey: body.apiKey });
      if (r.P.kind === 'none') return res.status(200).json({ ok: true, message: '검토 AI를 사용하지 않습니다. 규칙 검사와 사람 판정만 수행합니다.' });
      if (!r.apiKey) return res.status(200).json({ ok: false, message: 'API 키가 없습니다.' });
      if (!r.baseUrl) return res.status(200).json({ ok: false, message: '서버 주소(Base URL)가 없습니다.' });
      let models = [];
      if (r.P.kind === 'openai') {
        try {
          const m = await fetchT(`${r.baseUrl}/models`, { headers: { Authorization: `Bearer ${r.apiKey}` } });
          if (m.ok) { const d = await m.json(); models = (d.data || []).map(x => String(x.id || '').replace(/^models\//, '')).filter(Boolean).slice(0, 60); }
        } catch { /* 목록 미지원 서버는 무시 */ }
      }
      if (!r.model) return res.status(200).json({ ok: false, message: '모델 ID를 입력하세요.', models });
      try {
        const out = r.P.kind === 'anthropic' ? await callAnthropic(r, 'Reply with OK.', 'ping', 8) : await callOpenAICompat(r, 'Reply with OK.', 'ping', 8);
        return res.status(200).json({ ok: true, message: `연결 성공 — ${r.P.label} · ${out.model}`, models });
      } catch (e) { return res.status(200).json({ ok: false, message: e.message, models }); }
    }

    // ── 검토 호출 ──
    if (body.action === 'review') {
      const sess = await requireRole(req, res, REVIEW_ROLES);
      if (!sess) return;
      const r = await resolve(await loadCfg());
      if (r.P.kind === 'none') return res.status(409).json({ error: '검토 AI가 \'사용 안 함\'으로 설정되어 있습니다.', code: 'REVIEW_DISABLED' });
      if (!r.apiKey) return res.status(500).json({ error: `검토 AI(${r.P.label}) API 키가 없습니다. 설정 → AI 연동 → 검토 AI에서 등록하거나 환경변수 ${r.P.env || ''}를 설정하세요.`, code: 'NO_REVIEW_KEY' });
      if (!r.baseUrl || !r.model) return res.status(500).json({ error: '검토 AI의 서버 주소 또는 모델 ID가 설정되지 않았습니다.' });
      const system = String(body.system || '').slice(0, 4000);
      const prompt = String(body.prompt || '').slice(0, 24000);
      if (!prompt) return res.status(400).json({ error: '검토 내용이 비어 있습니다.' });
      const maxTokens = Math.min(Math.max(Number(body.maxTokens) || 2500, 256), 6000);
      const out = r.P.kind === 'anthropic' ? await callAnthropic(r, system, prompt, maxTokens) : await callOpenAICompat(r, system, prompt, maxTokens);
      return res.status(200).json({ text: out.text, provider: r.provider, label: r.P.label, model: out.model, sameAsGenerator: r.P.kind === 'anthropic' });
    }

    return res.status(400).json({ error: '알 수 없는 요청입니다.' });
  } catch (e) {
    return errorResponse(res, e);
  }
}
