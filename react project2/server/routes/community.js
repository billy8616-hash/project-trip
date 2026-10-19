// ─────────────────────────────────────────────────────────────
// server/routes/community.js — 커뮤니티 (코스 공유·후기·추천)
//
// 읽기(목록/상세)는 비로그인도 가능. 쓰기(공유·후기·추천)는 로그인 필요.
// ─────────────────────────────────────────────────────────────

import express from 'express'
import multer from 'multer'
import { optionalAuth, requireAuth } from '../authMiddleware.js'
import {
  createPost,
  deletePost,
  deleteReview,
  getPost,
  listPosts,
  toggleLike,
  upsertReview,
} from '../communityStore.js'
import { communityPhotoLimits, uploadCommunityPhotos } from '../communityStorage.js'

export const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: communityPhotoLimits.maxFileBytes, files: communityPhotoLimits.maxFiles },
})

// 공유된 코스 목록.
// ?city=제주 &theme=sns &q=야경 &days=2 &budget=보통 &transport=도보 &photos=1 &sort=recent|likes|rating
router.get('/api/community', optionalAuth, async (req, res) => {
  const {
    city = '', theme = '', q = '', days = '', budget = '', transport = '', photos = '',
    sort = 'recent', limit = '60',
  } = req.query || {}
  const dayCount = Number.parseInt(days, 10)
  try {
    const { posts, total } = await listPosts({
      city: String(city).trim(),
      theme: String(theme).trim(),
      q: String(q).trim().slice(0, 40),
      days: Number.isFinite(dayCount) && dayCount > 0 ? dayCount : 0,
      budget: String(budget).trim(),
      transport: String(transport).trim(),
      photos: photos === '1' || photos === 'true',
      sort: String(sort),
      viewerId: req.userId,
      limit: Number(limit),
    })
    return res.json({ posts, total })
  } catch (error) {
    return res.status(500).json({ message: error.message || '커뮤니티 글을 불러오지 못했어요.' })
  }
})

// 글 하나 + 동선 + 후기 목록.
router.get('/api/community/:id', optionalAuth, async (req, res) => {
  try {
    const post = await getPost(req.params.id, req.userId)
    if (!post) return res.status(404).json({ message: '글을 찾지 못했어요.' })
    return res.json({ post })
  } catch (error) {
    return res.status(500).json({ message: error.message || '글을 불러오지 못했어요.' })
  }
})

// multer 가 던지는 용량/개수 초과 에러를 JSON 메시지로 바꿔 준다(그냥 두면 기본 에러 페이지가 나간다).
function parsePhotos(req, res, next) {
  upload.array('photos', communityPhotoLimits.maxFiles)(req, res, (err) => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: `사진 한 장은 ${Math.round(communityPhotoLimits.maxFileBytes / (1024 * 1024))}MB 이하여야 해요.` })
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: `사진은 최대 ${communityPhotoLimits.maxFiles}장까지 올릴 수 있어요.` })
    }
    return res.status(400).json({ message: '사진을 처리하지 못했어요.' })
  })
}

// 글쓰기 화면에서 고른 사진들을 먼저 업로드하고 공개 URL을 받는다.
// (사진은 코스 공유(POST /api/community) 전에 따로 올려서, 그 URL을 payload처럼 함께 보낸다.)
router.post('/api/community/upload', requireAuth, parsePhotos, async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: '올릴 사진을 선택해 주세요.' })
  }
  try {
    const urls = await uploadCommunityPhotos(req.files, req.userId)
    return res.status(201).json({ urls })
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || '사진을 올리지 못했어요.' })
  }
})

// 내 코스를 커뮤니티에 공유하기.
router.post('/api/community', requireAuth, async (req, res) => {
  const { title, city, dayCount, summary, body, rating, payload, images } = req.body || {}
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ message: '제목이 필요해요.' })
  }
  if (typeof city !== 'string' || !city.trim()) {
    return res.status(400).json({ message: '여행지 정보가 필요해요.' })
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.days)) {
    return res.status(400).json({ message: '공유할 일정 정보가 올바르지 않아요.' })
  }
  try {
    const post = await createPost(req.userId, req.userName, {
      title: title.trim(), city: city.trim(), dayCount, summary, body, rating, payload, images,
    })
    return res.status(201).json({ post })
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || '공유하지 못했어요.' })
  }
})

// 내가 올린 글 삭제 (후기·추천도 같이 정리된다).
router.delete('/api/community/:id', requireAuth, async (req, res) => {
  try {
    const ok = await deletePost(req.userId, req.params.id)
    if (!ok) return res.status(404).json({ message: '글을 찾지 못했어요.' })
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error.message || '글을 삭제하지 못했어요.' })
  }
})

// 후기 남기기 (한 사람당 하나. 다시 보내면 갱신).
router.post('/api/community/:id/reviews', requireAuth, async (req, res) => {
  const { rating, body } = req.body || {}
  if (typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ message: '후기 내용을 입력해 주세요.' })
  }
  try {
    const review = await upsertReview(req.params.id, req.userId, req.userName, { rating, body })
    if (!review) return res.status(404).json({ message: '글을 찾지 못했어요.' })
    return res.status(201).json({ review })
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || '후기를 남기지 못했어요.' })
  }
})

// 내 후기 삭제.
router.delete('/api/community/:id/reviews', requireAuth, async (req, res) => {
  try {
    const ok = await deleteReview(req.params.id, req.userId)
    if (!ok) return res.status(404).json({ message: '후기를 찾지 못했어요.' })
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error.message || '후기를 지우지 못했어요.' })
  }
})

// 추천 토글.
router.post('/api/community/:id/like', requireAuth, async (req, res) => {
  try {
    const result = await toggleLike(req.params.id, req.userId)
    if (!result) return res.status(404).json({ message: '글을 찾지 못했어요.' })
    return res.json(result)
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || '추천하지 못했어요.' })
  }
})
