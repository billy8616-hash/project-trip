// ─────────────────────────────────────────────────────────────
// server/communityStorage.js — 커뮤니티 글 첨부 사진 저장 (Supabase Storage)
//
// 서버가 service role 키로 대신 업로드한다. 브라우저가 Supabase Storage에
// 직접 쓰게 하려면 버킷마다 RLS 정책을 따로 신경 써야 하는데, 이미 갖고 있는
// supabaseAdmin(요청 검증용)을 재사용하면 그 설정 없이도 안전하게 처리할 수 있다.
//
// 버킷은 코드에서 처음 쓸 때 없으면 만든다 — Supabase 대시보드에서 미리
// 버킷을 만들어 둘 필요가 없게 하려는 것이다.
// ─────────────────────────────────────────────────────────────

import { assertUserId } from './accountStore.js'
import { getSupabaseAdmin } from './supabaseAdmin.js'

const BUCKET = 'community-photos'
const MAX_FILES = 5
const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

let bucketReady = null

// 버킷이 없으면 만든다. 여러 요청이 동시에 들어와도 한 번만 시도하도록 promise를 캐싱한다.
async function ensureBucket() {
  if (bucketReady) return bucketReady
  bucketReady = (async () => {
    const supabase = getSupabaseAdmin()
    const { data: existing } = await supabase.storage.getBucket(BUCKET)
    if (existing) return
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_FILE_BYTES,
    })
    // 동시 요청이 먼저 만들어 버린 경우("already exists")는 실패로 보지 않는다.
    if (error && !/already exists/i.test(error.message || '')) throw error
  })()
  return bucketReady
}

// multer가 메모리에 올려 둔 파일들(req.files) → 업로드하고 공개 URL 배열을 돌려준다.
export async function uploadCommunityPhotos(files, userId) {
  const picked = (files || []).slice(0, MAX_FILES)
  for (const file of picked) {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      const error = new Error('jpg·png·webp·gif 사진만 올릴 수 있어요.')
      error.status = 400
      throw error
    }
  }

  await ensureBucket()
  const supabase = getSupabaseAdmin()

  const urls = []
  for (const file of picked) {
    const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase().slice(0, 8)
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false })
    if (error) {
      const wrapped = new Error('사진을 저장하지 못했어요.')
      wrapped.status = 500
      throw wrapped
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}

export const communityPhotoLimits = { maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES }

// 이 사용자가 올린 사진을 전부 지운다 (회원 탈퇴). 사진은 `<userId>/` 폴더 아래에 저장돼 있다.
// 한 번에 100개씩 지우고 폴더가 빌 때까지 반복한다. 지운 개수를 돌려준다.
// 버킷이 아직 없으면(사진을 한 번도 안 올린 서비스 초기) 지울 게 없는 것이다.
export async function deleteUserPhotos(userId) {
  assertUserId(userId)
  const bucket = getSupabaseAdmin().storage.from(BUCKET)
  const PAGE = 100
  let removed = 0

  // 폴더 하나에 수천 장이 쌓일 수는 없지만(사용자당 글 30개 × 사진 5장), 무한 반복은 막는다.
  for (let round = 0; round < 50; round += 1) {
    const { data, error } = await bucket.list(userId, { limit: PAGE })
    if (error) {
      if (/not.?found/i.test(error.message || '')) return removed
      throw error
    }
    if (!data || data.length === 0) return removed

    const { error: removeError } = await bucket.remove(data.map((file) => `${userId}/${file.name}`))
    if (removeError) throw removeError
    removed += data.length
    if (data.length < PAGE) return removed
  }
  return removed
}
