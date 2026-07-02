// api/ossp.js
// OSSP 마스터 CRUD — 기존 스키마(ossp + ossp_phases)에 맞춤
// ossp: id, name, version, description, is_active, methodology_id, created_at
// ossp_phases: id, ossp_id, code, name, order_num, created_at

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ANON_KEY;

// 기본 제공 방법론 — ossp 테이블에 is_builtin=true로 1회 자동 시딩됨.
// (사전 조건: ossp 테이블에 is_builtin boolean 컬럼 필요 — 아래 SQL 1회 실행)
//   alter table ossp add column if not exists is_builtin boolean not null default false;
const BUILTIN_OSSP = [
  { name: 'Waterfall',   description: '전통적 순차 개발',   phases: ['요구분석','설계','구현','테스트','배포','유지보수'] },
  { name: 'Agile/Scrum', description: '반복·점진적 개발',   phases: ['스프린트 계획','백로그 관리','개발','리뷰','회고','릴리즈'] },
  { name: 'DevOps',      description: '지속적 통합·배포',   phases: ['계획','코딩','빌드','테스트','배포','운영','모니터링'] },
];

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
      let osspList = await db('/ossp?order=created_at.asc');

      // 기본 제공 방법론이 없으면 1회 자동 시딩 (is_builtin 컬럼이 있어야 성공)
      const list = Array.isArray(osspList) ? osspList : [];
      const hasBuiltin = list.some(o => o && o.is_builtin === true);
      if (!hasBuiltin) {
        let seeded = false;
        for (const b of BUILTIN_OSSP) {
          // 동일 이름의 기본 행이 이미 있으면 건너뜀 (중복 시딩 방지)
          if (list.some(o => o && o.name === b.name && o.is_builtin)) continue;
          const created = await db('/ossp', 'POST', {
            name: b.name, version: '', description: b.description,
            is_active: true, is_builtin: true,
          });
          const row = Array.isArray(created) ? created[0] : created;
          if (row && row.id) {
            seeded = true;
            await db('/ossp_phases', 'POST', b.phases.map((nm, i) => ({
              ossp_id: row.id, code: `P${i + 1}`, name: nm, order_num: i + 1,
            })));
          }
        }
        if (seeded) osspList = await db('/ossp?order=created_at.asc');
      }

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

    // 삭제: ?id=...  (기본 제공 방법론은 삭제 불가)
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });
      const rows = await db(`/ossp?id=eq.${id}&select=id,is_builtin`);
      if (Array.isArray(rows) && rows[0] && rows[0].is_builtin === true) {
        return res.status(400).json({ error: '기본 제공 방법론은 삭제할 수 없습니다.' });
      }
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
