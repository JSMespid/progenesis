// api/project-blobs.js
// 프로젝트의 큰 요구사항·V-모델 데이터(gzip JSON) 저장소 — Supabase Storage 'project-data' 버킷 (비공개)
//
// 배경: SWE.3 소스코드·HWE.2 회로 설계까지 담은 V-모델은 수 MB~수십 MB라
//   ① 브라우저 localStorage(약 5MB)에 들어가지 않고 ② /api/projects POST 본문이 Vercel 함수 한도(4.5MB, 모든 플랜 공통)를 넘는다.
//   그래서 브라우저가 압축본을 서명 URL로 Storage에 직접 PUT하고(Vercel 우회), projects 행에는 경로만 남긴다.
//   DB 스키마 변경 없음. 버킷이 없으면 처음 업로드할 때 자동으로 만든다(비공개).
//
// 흐름:
//  1) POST { action:'sign-upload' }      → { storage_path, upload_url }   (쓰기 역할: admin·pm·qa)
//  2) 브라우저가 upload_url 로 gzip 바이트 직접 PUT
//  3) GET  ?path=vmodel/...              → { url } 1시간 유효 다운로드 서명 URL   (조회 역할 전체)
//  4) DELETE ?path=vmodel/...            → 객체 삭제                       (쓰기 역할)
//     (프로젝트 삭제 시 정리는 api/projects.js DELETE가 직접 한다)

import { requireRole, audit, READ_ROLES, WRITE_ROLES } from './_auth.js';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
export const PROJECT_BUCKET = 'project-data';

const authHeaders = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` });

// 경로 검증: 이 엔드포인트가 만든 형식(vmodel/<날짜>/<시각>_<난수>.json.gz)만 허용 — 다른 객체 접근·경로 조작 차단
export function validBlobPath(p) {
  return typeof p === 'string' && /^vmodel\/\d{8}\/\d{13}_[a-z0-9]{8,12}\.json\.gz$/.test(p);
}

function makePath() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `vmodel/${ymd}/${Date.now()}_${rand}.json.gz`;
}

async function ensureBucket() {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: PROJECT_BUCKET, name: PROJECT_BUCKET, public: false }),
  });
  if (r.ok) return true;
  const t = await r.text().catch(() => '');
  if (/already exists|Duplicate|409/i.test(t) || r.status === 409) return true;   // 동시에 만든 경우
  throw new Error(`저장소 버킷 생성 실패 (${r.status}) ${t.slice(0, 160)}`);
}

async function signUpload(path) {
  // 주의: 본문 없이 Content-Type: application/json 을 보내면 Supabase가 거부 → Content-Type 제외 (library-files.js와 동일)
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${PROJECT_BUCKET}/${path}`, { method: 'POST', headers: authHeaders() });
  const raw = await r.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* raw 유지 */ }
  return { ok: r.ok, status: r.status, data, raw };
}

export async function deleteBlob(path) {
  if (!validBlobPath(path)) return false;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${PROJECT_BUCKET}/${path}`, { method: 'DELETE', headers: authHeaders() });
  return r.ok;
}

export default async function handler(req, res) {
  const sess = await requireRole(req, res, req.method === 'GET' ? READ_ROLES : WRITE_ROLES);
  if (!sess) return;
  try {
    // ── 다운로드용 서명 URL ──
    if (req.method === 'GET') {
      const path = String((req.query && req.query.path) || '');
      if (!validBlobPath(path)) return res.status(400).json({ error: '잘못된 경로입니다.' });
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${PROJECT_BUCKET}/${path}`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 3600 }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.signedURL) return res.status(404).json({ error: data.error || data.message || 'V-모델 데이터 파일을 찾지 못했습니다.' });
      return res.status(200).json({ url: `${SUPABASE_URL}/storage/v1${data.signedURL}` });
    }

    // ── 업로드용 서명 URL ──
    if (req.method === 'POST') {
      const body = req.body || {};
      if (body.action !== 'sign-upload') return res.status(400).json({ error: "action은 'sign-upload'여야 합니다." });
      const path = makePath();
      let s = await signUpload(path);
      if (!s.ok && /bucket not found|not found/i.test(String(s.data.message || s.data.error || s.raw))) {
        await ensureBucket();          // 첫 사용: 비공개 버킷 자동 생성 후 재시도
        s = await signUpload(path);
      }
      if (!s.ok) {
        const msg = s.data.message || s.data.error || s.raw || `status ${s.status}`;
        return res.status(400).json({ error: `업로드 URL 발급 실패: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}` });
      }
      const signed = s.data.url || s.data.signedUrl || s.data.signedURL;
      if (!signed) return res.status(400).json({ error: `업로드 URL 발급 실패: 예상치 못한 응답 ${String(s.raw).slice(0, 200)}` });
      const full = signed.startsWith('http') ? signed : `${SUPABASE_URL}/storage/v1${signed.startsWith('/') ? '' : '/'}${signed}`;
      audit(sess.login_id, 'project-blobs.sign-upload', path);
      return res.status(200).json({ storage_path: path, upload_url: full });
    }

    // ── 삭제 ──
    if (req.method === 'DELETE') {
      const path = String((req.query && req.query.path) || '');
      if (!validBlobPath(path)) return res.status(400).json({ error: '잘못된 경로입니다.' });
      audit(sess.login_id, 'project-blobs.delete', path);
      const ok = await deleteBlob(path);
      return res.status(ok ? 200 : 404).json({ success: ok });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
