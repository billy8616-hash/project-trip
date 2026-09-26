// ─────────────────────────────────────────────────────────────
// server/routes/profile.js — 프로필 (이름·생년월일·성별·휴대폰)
//
// 이메일 가입 직후(프로필 완성), 소셜 로그인 첫 진입(프로필 완성)에서 공통으로 쓴다.
// ─────────────────────────────────────────────────────────────

import express from 'express'
import { requireAuth } from '../authMiddleware.js'
import { getProfile, publicProfile, upsertProfile, validateProfile } from '../profileStore.js'

export const router = express.Router()

router.get('/api/profile', requireAuth, async (req, res) => {
  const profile = await getProfile(req.userId)
  return res.json({ profile: publicProfile(req.authUser, profile) })
})

router.put('/api/profile', requireAuth, async (req, res) => {
  const name = String(req.body.name || '').trim()
  const birthdate = String(req.body.birthdate || '').trim()
  const gender = String(req.body.gender || '').trim()
  const phone = String(req.body.phone || '').trim()

  const validationError = validateProfile({ name, birthdate, gender, phone })
  if (validationError) return res.status(400).json({ message: validationError })

  const profile = await upsertProfile(req.userId, {
    name,
    birthdate: birthdate || null,
    gender: gender || null,
    phone: phone || null,
  })
  return res.json({ profile: publicProfile(req.authUser, profile) })
})
