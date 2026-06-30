// api/library-files.js
// 규제(Regulation/Compliance) · Best Practice 산출물 파일 라이브러리
// Storage: library-files 버킷 / DB: library_files 테이블
// 직접 업로드(서명 URL → 클라이언트가 Supabase로 직접 PUT) 방식으로 Vercel 4.5MB 한도를 우회.
//
// kind: 'regulation' | 'best_practice'  (라이브러리 종류 구분)
//
// 흐름:
//  1) POST { action:'sign-upload', kind, category, file_name } → { storage_path, upload_url }
//  2) 클라이언트가 upload_url 로 파일 직접 PUT
//  3) POST { action:'commit', kind, category, file_name, storage_path, file_type, file_size } → 메타 기록

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ANON_KEY;
const BUCKET = 'library-files';

const KINDS = ['regulation', 'best_practice'];

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

// ASCII 전용 Storage 경로 (한글 원본명은 DB에만 보존)
function makeStoragePath(kind, file_name) {
  const dot = file_name.lastIndexOf('.');
  const ext = dot > -1 ? file_name.slice(dot).toLowerCase().replace(/[^.\w]/g, '') : '';
  const rand = Math.random().toString(36).slice(2, 10);
  return `${kind}/${Date.now()}_${rand}${ext}`;
}

export default async function handler(req, res) {
  try {
    // ── 목록: GET ?kind=... ────────────────────────────────────
    if (req.method === 'GET' && !req.query.path) {
      const { kind } = req.query;
      const filter = kind ? `&kind=eq.${kind}` : '';
      const data = await db(`/library_files?order=created_at.asc${filter}`);
      return res.status(200).json(data);
    }

    // ── 다운로드용 서명 URL: GET ?path=...&name=... ──────────────
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
      const dl = req.query.name ? `&download=${encodeURIComponent(req.query.name)}` : '';
      return res.status(200).json({ url: `${SUPABASE_URL}/storage/v1${data.signedURL}${dl}` });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { action } = body;

      // ── (1) 직접 업로드용 서명 URL 발급 ─────────────────────────
      if (action === 'sign-upload') {
        const { kind, category, file_name } = body;
        if (!kind || !category || !file_name) {
          return res.status(400).json({ error: 'kind, category, file_name이 필요합니다.' });
        }
        if (!KINDS.includes(kind)) {
          return res.status(400).json({ error: `kind는 다음 중 하나여야 합니다: ${KINDS.join(', ')}` });
        }
        const storagePath = makeStoragePath(kind, file_name);
        // 주의: 본문 없이 application/json 보내면 Supabase가 거부 → Content-Type 헤더 제외
        const r = await fetch(
          `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${storagePath}`,
          {
            method: 'POST',
            headers: {
              'apikey': SERVICE_KEY,
              'Authorization': `Bearer ${SERVICE_KEY}`,
            },
          }
        );
        const rawText = await r.text();
        let data = {};
        try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* keep rawText */ }
        if (!r.ok) {
          const msg = data.message || data.error || rawText || `발급 실패 (status ${r.status})`;
          return res.status(400).json({ error: `업로드 URL 발급 실패: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}` });
        }
        const signedPath = data.url || data.signedUrl || data.signedURL;
        if (!signedPath) {
          return res.status(400).json({ error: `업로드 URL 발급 실패: 예상치 못한 응답 ${rawText.slice(0, 200)}` });
        }
        const fullUrl = signedPath.startsWith('http')
          ? signedPath
          : `${SUPABASE_URL}/storage/v1${signedPath.startsWith('/') ? '' : '/'}${signedPath}`;
        return res.status(200).json({ storage_path: storagePath, upload_url: fullUrl, token: data.token || null });
      }

      // ── (2) 메타데이터 기록 ─────────────────────────────────────
      if (action === 'commit') {
        const { kind, category, file_name, storage_path, file_type, file_size } = body;
        if (!kind || !category || !file_name || !storage_path) {
          return res.status(400).json({ error: 'kind, category, file_name, storage_path이 필요합니다.' });
        }
        if (!KINDS.includes(kind)) {
          return res.status(400).json({ error: `kind는 다음 중 하나여야 합니다: ${KINDS.join(', ')}` });
        }
        const row = await db('/library_files', 'POST', {
          kind,
          category,
          file_name,
          file_url: storage_path,
          file_type: file_type || null,
          file_size: file_size || null,
        });
        return res.status(200).json(Array.isArray(row) ? row[0] : row);
      }

      return res.status(400).json({ error: 'action은 sign-upload 또는 commit이어야 합니다.' });
    }

    // ── 삭제: DELETE ?id=...&path=... ───────────────────────────
    if (req.method === 'DELETE') {
      const { id, path } = req.query;
      if (path) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
          method: 'DELETE',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
        });
      }
      if (id) {
        await db(`/library_files?id=eq.${id}`, 'DELETE');
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
