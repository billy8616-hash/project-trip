// ─────────────────────────────────────────────────────────────
// server/routes/community.js — 커뮤니티 (코스 공유·후기·추천)
//
// 읽기(목록/상세)는 비로그인도 가능. 쓰기(공유·후기·추천)는 로그인 필요.
// ─────────────────────────────────────────────────────────────

import express from 'express'
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

export const router = express.Router()

// 공유된 코스 목록. ?city=제주 &sort=recent|likes|rating
router.get('/api/community', optionalAuth, async (req, res) => {
  const { city = '', sort = 'recent', limit = '60' } = req.query || {}
  try {
    const { posts, total } = await listPosts({
      city: String(city).trim(),
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

// 내 코스를 커뮤니티에 공유하기.
router.post('/api/community', requireAuth, async (req, res) => {
  const { title, city, dayCount, summary, body, rating, payload } = req.body || {}
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
      title: title.trim(), city: city.trim(), dayCount, summary, body, rating, payload,
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
