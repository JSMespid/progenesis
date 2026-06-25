// api/ossp-files.js
// OSSP 자산 파일 업로드/목록/서명URL/삭제 (Supabase Storage: ossp-files 버킷)
// 기존 admin-files.js를 건드리지 않는 독립 엔드포인트입니다.

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ANON_KEY;
const BUCKET = 'ossp-files';

const CATEGORIES = [
  '개요서','절차서','산출물템플릿','기법',
  '체크리스트','테일러링가이드','산출물흐름도','교육교재',
];

// REST 헬퍼 (메타데이터 테이블 조작은 service key 사용 → RLS 무관)
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
    // ── 목록: GET ?ossp_id=... (특정 OSSP의 파일들) ────────────────
    if (req.method === 'GET' && !req.query.path) {
      const { ossp_id } = req.query;
      const filter = ossp_id ? `&ossp_id=eq.${ossp_id}` : '';
      const data = await db(`/ossp_files?order=created_at.asc${filter}`);
      return res.status(200).json(data);
    }

    // ── 서명 URL 발급: GET ?path=... (비공개 버킷 다운로드용) ──────
    if (req.method === 'GET' && req.query.path) {
      const r = await fetch(
        `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${req.query.path}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ expiresIn: 3600 }),
        }
      );
      const data = await r.json();
      if (data.error || !data.signedURL) {
        return res.status(400).json({ error: data.error || '서명 URL 발급 실패' });
      }
      return res.status(200).json({ url: `${SUPABASE_URL}/storage/v1${data.signedURL}` });
    }

    // ── 업로드: POST { ossp_id, category, file_name, file_type, data_base64 } ──
    if (req.method === 'POST') {
      const { ossp_id, category, file_name, file_type, data_base64 } = req.body || {};
      if (!ossp_id || !category || !file_name || !data_base64) {
        return res.status(400).json({ error: 'ossp_id, category, file_name, 파일 데이터가 필요합니다.' });
      }
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `category는 다음 중 하나여야 합니다: ${CATEGORIES.join(', ')}` });
      }

      // base64 → 바이너리
      const buffer = Buffer.from(data_base64, 'base64');
      // 충돌 방지용 경로: ossp_id/타임스탬프_파일명
      const safeName = file_name.replace(/[^\w.\-가-힣]/g, '_');
      const storagePath = `${ossp_id}/${Date.now()}_${safeName}`;

      // Storage 업로드
      const up = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
        {
          method: 'POST',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': file_type || 'application/octet-stream',
          },
          body: buffer,
        }
      );
      if (!up.ok) {
        const errText = await up.text();
        return res.status(400).json({ error: `Storage 업로드 실패: ${errText}` });
      }

      // 메타데이터 기록 (file_url에는 storage 경로를 저장 → 다운로드 시 서명URL 발급)
      const row = await db('/ossp_files', 'POST', {
        ossp_id,
        category,
        file_name,
        file_url: storagePath,
        file_type: file_type || null,
        file_size: buffer.length,
      });
      return res.status(200).json(Array.isArray(row) ? row[0] : row);
    }

    // ── 삭제: DELETE ?id=...&path=... (메타+스토리지 둘 다 제거) ──────
    if (req.method === 'DELETE') {
      const { id, path } = req.query;
      if (path) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
          method: 'DELETE',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
        });
      }
      if (id) {
        await db(`/ossp_files?id=eq.${id}`, 'DELETE');
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
