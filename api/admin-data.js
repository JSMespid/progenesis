import { requireRole } from './_auth.js';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(path, method = 'GET', body = null, useService = false) {
  // RLS 활성화 대응: 읽기·쓰기 모두 service_role 키 사용 (anon 키로는 RLS에 막힘)
  const key = SUPABASE_SERVICE_KEY;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method, headers, body: body ? JSON.stringify(body) : null,
  });
  if (r.status === 204) return [];
  const text = await r.text();
  try { return text ? JSON.parse(text) : []; } catch { return []; }
}

// 테이블별 정렬 기준
function getOrderClause(table) {
  const orders = {
    methodologies: 'order_num.asc,created_at.asc',
    ossp: 'created_at.asc',
    ossp_phases: 'order_num.asc,created_at.asc',
    ossp_deliverables: 'created_at.asc',
    ossp_files: 'created_at.asc',
    projects: 'created_at.desc',
  };
  return orders[table] || 'created_at.asc';
}

export default async function handler(req, res) {
  // ── 레거시 /admin 전용 엔드포인트: 관리자 세션만 허용 (프런트에서 더 이상 호출하지 않음 — 제거 예정) ──
  if (!await requireRole(req, res, ['admin'])) return;
  const { table, action, id, data } = req.body || {};

  if (req.method === 'GET') {
    const { table: t, filter } = req.query;
    if (!t) return res.status(400).json({ error: 'table is required' });
    let path = `/${t}?order=${getOrderClause(t)}`;
    if (filter) path += `&${filter}`;
    const result = await supabase(path, 'GET', null, false);
    return res.status(200).json(result);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (action === 'create') {
    const result = await supabase(`/${table}`, 'POST', data, true);
    if (result.error) return res.status(400).json({ error: result.message || result.error });
    return res.status(200).json(result);
  }

  if (action === 'update') {
    const result = await supabase(`/${table}?id=eq.${id}`, 'PATCH', data, true);
    return res.status(200).json(result);
  }

  if (action === 'delete') {
    await supabase(`/${table}?id=eq.${id}`, 'DELETE', null, true);
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
