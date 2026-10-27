// ─────────────────────────────────────────────────────────────
// server/routes/courseDraft.js — 작업 중인 코스 (기기 간 이어보기)
//
// 로그인 사용자가 코스 화면에서 편집 중인 상태를 서버에 올려 두고, 다른 기기에서
// 불러온다. 사용자당 하나라 id 없이 /api/course-draft 하나로 조회·저장·삭제한다.
// ─────────────────────────────────────────────────────────────

import express from 'express'
import { requireAuth } from '../authMiddleware.js'
import { deleteCourseDraft, getCourseDraft, upsertCourseDraft } from '../courseDraftStore.js'

export const router = express.Router()

// 내 작업 중인 코스. 없으면 draft: null.
router.get('/api/course-draft', requireAuth, async (req, res) => {
  try {
    const draft = await getCourseDraft(req.userId)
    return res.json({ draft })
  } catch (error) {
    return res.status(500).json({ message: error.message || '작업 중인 코스를 불러오지 못했어요.' })
  }
})

// 지금 편집 중인 코스로 덮어쓴다.
router.put('/api/course-draft', requireAuth, async (req, res) => {
  const { dayCount, payload } = req.body || {}
  try {
    const draft = await upsertCourseDraft(req.userId, { dayCount, payload })
    return res.json({ draft })
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || '작업 중인 코스를 저장하지 못했어요.' })
  }
})

// "이어서 보기"를 닫았을 때 — 더는 다른 기기에 띄우지 않는다.
router.delete('/api/course-draft', requireAuth, async (req, res) => {
  try {
    await deleteCourseDraft(req.userId)
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error.message || '작업 중인 코스를 지우지 못했어요.' })
  }
})
