// ─────────────────────────────────────────────────────────────
// server/routes/trips.js — 내 여행 (저장한 코스)
//
// 로그인 사용자가 저장한 여행 동선 목록. 조회·저장·이름 바꾸기·삭제.
// ─────────────────────────────────────────────────────────────

import express from 'express'
import { requireAuth } from '../authMiddleware.js'
import {
  createSavedCourse,
  deleteSavedCourse,
  listSavedCourses,
  renameSavedCourse,
} from '../savedCourseStore.js'

export const router = express.Router()

// "내 여행" — 로그인 사용자가 저장한 여행 동선 목록.
router.get('/api/trips', requireAuth, async (req, res) => {
  try {
    const trips = await listSavedCourses(req.userId)
    return res.json({ trips })
  } catch (error) {
    return res.status(500).json({ message: error.message || '저장한 여행을 불러오지 못했어요.' })
  }
})

// 지금 보고 있는 코스를 "내 여행"에 저장한다.
router.post('/api/trips', requireAuth, async (req, res) => {
  const { title, city, dayCount, payload } = req.body || {}
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ message: '여행 이름이 필요해요.' })
  }
  if (typeof city !== 'string' || !city.trim()) {
    return res.status(400).json({ message: '여행지 정보가 필요해요.' })
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.days)) {
    return res.status(400).json({ message: '저장할 일정 정보가 올바르지 않아요.' })
  }

  try {
    const trip = await createSavedCourse(req.userId, { title: title.trim(), city: city.trim(), dayCount, payload })
    return res.status(201).json({ trip })
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || '여행을 저장하지 못했어요.' })
  }
})

// 저장한 여행 이름 바꾸기.
router.patch('/api/trips/:id', requireAuth, async (req, res) => {
  const { title } = req.body || {}
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ message: '새 이름이 필요해요.' })
  }
  try {
    const ok = await renameSavedCourse(req.userId, req.params.id, title.trim())
    if (!ok) return res.status(404).json({ message: '해당 여행을 찾지 못했어요.' })
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error.message || '이름을 바꾸지 못했어요.' })
  }
})

// 저장한 여행 삭제.
router.delete('/api/trips/:id', requireAuth, async (req, res) => {
  try {
    const ok = await deleteSavedCourse(req.userId, req.params.id)
    if (!ok) return res.status(404).json({ message: '해당 여행을 찾지 못했어요.' })
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error.message || '여행을 삭제하지 못했어요.' })
  }
})
