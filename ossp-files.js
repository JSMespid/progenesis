// api/ossp-files.js
// OSSP 자산 파일 업로드/목록/서명URL/삭제 (Supabase Storage: ossp-files 버킷)
// 기존 admin-files.js를 건드리지 않는 독립 엔드포인트입니다.
//
// 업로드 방식:
//  (권장) 직접 업로드 — 클라이언트가 Supabase Storage로 직접 PUT하므로 Vercel 4.5MB 한도를 우회.
//    1) POST { action:'sign-upload', ossp_id, category, file_name }
//         → { storage_path, upload_url, token } 발급
//    2) 클라이언트가 upload_url 로 파일 바이너리를 직접 PUT
//    3) POST { action:'commit', ossp_id, category, file_name, storage_path, file_type, file_size }
//         → ossp_files 메타데이터 기록
//  (구버전 호환) base64 업로드 — POST { ossp_id, category, file_name, file_type, data_base64 }
//    작은 파일에서만 동작. 큰 파일은 413(FUNCTION_PAYLOAD_TOO_LARGE)로 실패.

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

// ASCII 전용 Storage 경로 생성 (한글 원본명은 DB에만 보존)
function makeStoragePath(ossp_id, file_name) {
  const dot = file_name.lastIndexOf('.');
  const ext = dot > -1 ? file_name.slice(dot).toLowerCase().replace(/[^.\w]/g, '') : '';
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ossp_id}/${Date.now()}_${rand}${ext}`;
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

    // ── 서명 URL 발급: GET ?path=...&name=... (비공개 버킷 다운로드용) ──
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
      // 원본(한글) 파일명으로 다운로드되도록 download 파라미터 부착
      const dl = req.query.name ? `&download=${encodeURIComponent(req.query.name)}` : '';
      return res.status(200).json({ url: `${SUPABASE_URL}/storage/v1${data.signedURL}${dl}` });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { action } = body;

      // ── (1) 직접 업로드용 서명 URL 발급 ─────────────────────────
      //     POST { action:'sign-upload', ossp_id, category, file_name }
      if (action === 'sign-upload') {
        const { ossp_id, category, file_name } = body;
        if (!ossp_id || !category || !file_name) {
          return res.status(400).json({ error: 'ossp_id, category, file_name이 필요합니다.' });
        }
        if (!CATEGORIES.includes(category)) {
          return res.status(400).json({ error: `category는 다음 중 하나여야 합니다: ${CATEGORIES.join(', ')}` });
        }
        const storagePath = makeStoragePath(ossp_id, file_name);
        // Supabase Storage 서명된 업로드 URL 발급
        const r = await fetch(
          `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${storagePath}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SERVICE_KEY,
              'Authorization': `Bearer ${SERVICE_KEY}`,
            },
          }
        );
        const rawText = await r.text();
        let data = {};
        try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* keep rawText */ }

        // 발급 실패: Supabase 원문을 그대로 노출(에러 객체에 message가 없을 수 있음)
        if (!r.ok) {
          const msg = data.message || data.error || rawText || `발급 실패 (status ${r.status})`;
          return res.status(400).json({ error: `업로드 URL 발급 실패: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}` });
        }

        // 응답 필드는 Supabase 버전에 따라 url 또는 signedUrl
        const signedPath = data.url || data.signedUrl || data.signedURL;
        if (!signedPath) {
          return res.status(400).json({ error: `업로드 URL 발급 실패: 예상치 못한 응답 ${rawText.slice(0, 200)}` });
        }
        // signedPath 예: /object/upload/sign/ossp-files/<path>?token=...
        const fullUrl = signedPath.startsWith('http')
          ? signedPath
          : `${SUPABASE_URL}/storage/v1${signedPath.startsWith('/') ? '' : '/'}${signedPath}`;
        return res.status(200).json({
          storage_path: storagePath,
          upload_url: fullUrl,
          token: data.token || null,
        });
      }

      // ── (2) 직접 업로드 완료 후 메타데이터 기록 ──────────────────
      //     POST { action:'commit', ossp_id, category, file_name, storage_path, file_type, file_size }
      if (action === 'commit') {
        const { ossp_id, category, file_name, storage_path, file_type, file_size } = body;
        if (!ossp_id || !category || !file_name || !storage_path) {
          return res.status(400).json({ error: 'ossp_id, category, file_name, storage_path이 필요합니다.' });
        }
        if (!CATEGORIES.includes(category)) {
          return res.status(400).json({ error: `category는 다음 중 하나여야 합니다: ${CATEGORIES.join(', ')}` });
        }
        const row = await db('/ossp_files', 'POST', {
          ossp_id,
          category,
          file_name,
          file_url: storage_path,
          file_type: file_type || null,
          file_size: file_size || null,
        });
        return res.status(200).json(Array.isArray(row) ? row[0] : row);
      }

      // ── (구버전 호환) base64 업로드 ─────────────────────────────
      //     POST { ossp_id, category, file_name, file_type, data_base64 }
      const { ossp_id, category, file_name, file_type, data_base64 } = body;
      if (!ossp_id || !category || !file_name || !data_base64) {
        return res.status(400).json({ error: 'ossp_id, category, file_name, 파일 데이터가 필요합니다.' });
      }
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `category는 다음 중 하나여야 합니다: ${CATEGORIES.join(', ')}` });
      }

      const buffer = Buffer.from(data_base64, 'base64');
      const storagePath = makeStoragePath(ossp_id, file_name);

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
