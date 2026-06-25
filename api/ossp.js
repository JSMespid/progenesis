// api/ossp.js
// OSSP 마스터 CRUD — 기존 스키마(ossp + ossp_phases)에 맞춤
// ossp: id, name, version, description, is_active, methodology_id, created_at
// ossp_phases: id, ossp_id, code, name, order_num, created_at

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ANON_KEY;

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
  try { return t ? JSON.parse(t) : []; } catch { return []; }
}

export default async function handler(req, res) {
  try {
    // 목록: OSSP + 각자의 단계(phases)를 합쳐서 반환
    if (req.method === 'GET') {
      const osspList = await db('/ossp?order=created_at.asc');
      const phases = await db('/ossp_phases?order=order_num.asc,created_at.asc');
      const byOssp = {};
      (Array.isArray(phases) ? phases : []).forEach(p => {
        (byOssp[p.ossp_id] = byOssp[p.ossp_id] || []).push(p);
      });
      const merged = (Array.isArray(osspList) ? osspList : []).map(o => ({
        ...o,
        phases: (byOssp[o.id] || []).map(p => p.name),
      }));
      return res.status(200).json(merged);
    }

    // 생성: { name, version, description, phases:[...] }
    if (req.method === 'POST') {
      const { name, version, description, phases } = req.body || {};
      if (!name || !Array.isArray(phases) || phases.length === 0) {
        return res.status(400).json({ error: '이름과 1개 이상의 단계가 필요합니다.' });
      }
      const created = await db('/ossp', 'POST', {
        name,
        version: version || 'V1.0',
        description: description || '',
        is_active: true,
      });
      const row = Array.isArray(created) ? created[0] : created;
      if (!row || !row.id) {
        return res.status(400).json({ error: 'OSSP 생성에 실패했습니다.' });
      }
      const phaseRows = phases.map((nm, i) => ({
        ossp_id: row.id,
        code: `P${i + 1}`,
        name: nm,
        order_num: i + 1,
      }));
      await db('/ossp_phases', 'POST', phaseRows);
      return res.status(200).json(row);
    }

    // 삭제: ?id=...
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });
      await db(`/ossp_files?ossp_id=eq.${id}`, 'DELETE');
      await db(`/ossp_deliverables?ossp_id=eq.${id}`, 'DELETE');
      await db(`/ossp_phases?ossp_id=eq.${id}`, 'DELETE');
      await db(`/ossp?id=eq.${id}`, 'DELETE');
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
