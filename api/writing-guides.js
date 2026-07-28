// api/writing-guides.js
// 작성 가이드(전역 라이브러리) CRUD — 방법론 작성가이드·글로벌 표준(PMBOK·CMMI 등)·글로벌 규제 등
// AI 산출물 작성 시 프롬프트에 주입할 요약(summary)과 원문(content)을 writing_guides 테이블에 보관.
// 모든 프로젝트 공용(전역)이며, 향후 모든 AI 작성 기능이 공통으로 사용한다.
//
// 사전 조건 (Supabase SQL Editor에서 1회 실행):
//   create table if not exists writing_guides (
//     id uuid primary key default gen_random_uuid(),
//     name text not null,
//     category text not null default '기타',
//     summary text not null default '',
//     content text not null default '',
//     is_active boolean not null default true,
//     created_at timestamptz not null default now()
//   );
//   alter table writing_guides disable row level security;

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ANON_KEY;

// REST 헬퍼 — 204 No Content 방어를 위해 json() 대신 text() 사용
async function db(path, method = 'GET', body = null) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : null,
  });
  const t = await r.text();
  if (!r.ok) {
    // 테이블 미생성(PGRST205): 사전 조건 SQL 미실행 상태 — 조치 방법을 그대로 안내
    if (t.includes('PGRST205') || t.includes('writing_guides')) {
      throw new Error("writing_guides 테이블이 아직 생성되지 않았습니다. Supabase 대시보드 → SQL Editor에서 다음 SQL을 1회 실행한 뒤 다시 시도하세요: create table if not exists writing_guides (id uuid primary key default gen_random_uuid(), name text not null, category text not null default '기타', summary text not null default '', content text not null default '', is_active boolean not null default true, created_at timestamptz not null default now()); alter table writing_guides disable row level security;");
    }
    throw new Error(`supabase ${r.status}: ${t.slice(0, 200)}`);
  }
  try { return t ? JSON.parse(t) : []; } catch { return []; }
}

export default async function handler(req, res) {
  try {
    // ── 목록: 프롬프트 주입에 필요한 요약까지만 (원문 content는 용량 절감을 위해 제외) ──
    if (req.method === 'GET') {
      const data = await db('/writing_guides?order=created_at.asc&select=id,name,category,summary,is_active,created_at');
      return res.status(200).json(data);
    }

    // ── 등록: { name, category, summary, content } ──
    if (req.method === 'POST') {
      const { name, category, summary, content } = req.body || {};
      if (!name || !String(name).trim()) return res.status(400).json({ error: '가이드 이름이 필요합니다.' });
      const row = {
        name: String(name).trim().slice(0, 120),
        category: String(category || '기타').slice(0, 40),
        summary: String(summary || '').slice(0, 4000),
        content: String(content || '').slice(0, 50000),
      };
      const created = await db('/writing_guides', 'POST', row);
      return res.status(200).json(Array.isArray(created) ? created[0] : created);
    }

    // ── 수정: { id, name?, category?, summary?, is_active? } ──
    if (req.method === 'PATCH') {
      const { id, ...rest } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });
      const allowed = {};
      ['name', 'category', 'summary', 'is_active'].forEach(k => { if (rest[k] !== undefined) allowed[k] = rest[k]; });
      if (!Object.keys(allowed).length) return res.status(400).json({ error: '수정할 항목이 없습니다.' });
      await db(`/writing_guides?id=eq.${id}`, 'PATCH', allowed);
      return res.status(200).json({ ok: true });
    }

    // ── 삭제: ?id=... ──
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });
      await db(`/writing_guides?id=eq.${id}`, 'DELETE');
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
