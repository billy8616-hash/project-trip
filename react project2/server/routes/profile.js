// ─────────────────────────────────────────────────────────────
// server/routes/profile.js — 프로필 (이름·생년월일·성별·휴대폰)
//
// 이메일 가입 직후(프로필 완성), 소셜 로그인 첫 진입(프로필 완성)에서 공통으로 쓴다.
// ─────────────────────────────────────────────────────────────

import express from 'express'
import { publicMessage, publicStatus } from '../httpError.js'
import { requireAuth } from '../authMiddleware.js'
import { getProfile, publicProfile, upsertProfile, validateProfile } from '../profileStore.js'

export const router = express.Router()

router.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const profile = await getProfile(req.userId)
    return res.json({ profile: publicProfile(req.authUser, profile) })
  } catch (error) {
    return res.status(publicStatus(error)).json({ message: publicMessage(error, '프로필을 불러오지 못했어요.') })
  }
})

router.put('/api/profile', requireAuth, async (req, res) => {
  const body = req.body || {}
  const name = String(body.name || '').trim()
  const birthdate = String(body.birthdate || '').trim()
  const gender = String(body.gender || '').trim()
  const phone = String(body.phone || '').trim()

  const validationError = validateProfile({ name, birthdate, gender, phone })
  if (validationError) return res.status(400).json({ message: validationError })

  try {
    const profile = await upsertProfile(req.userId, {
      name,
      birthdate: birthdate || null,
      gender: gender || null,
      phone: phone || null,
    })
    return res.json({ profile: publicProfile(req.authUser, profile) })
  } catch (error) {
    return res.status(publicStatus(error)).json({ message: publicMessage(error, '프로필을 저장하지 못했어요.') })
  }
})
