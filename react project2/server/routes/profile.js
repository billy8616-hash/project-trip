// ─────────────────────────────────────────────────────────────
// server/routes/profile.js — 프로필 (이름·생년월일·성별·휴대폰)
//
// 이메일 가입 직후(프로필 완성), 소셜 로그인 첫 진입(프로필 완성)에서 공통으로 쓴다.
// ─────────────────────────────────────────────────────────────

import express from 'express'
import { requireAuth } from '../authMiddleware.js'
import { deleteAuthUser, deleteUserRecords } from '../accountStore.js'
import { deleteUserPhotos } from '../communityStorage.js'
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

// 회원 탈퇴 — 프로필·저장한 여행·내 글/후기/추천·올린 사진·로그인 계정을 전부 지운다 (되돌릴 수 없다).
// 실수로 한 번 호출돼도 지워지지 않도록 본문에 { confirm: true } 를 명시해야 한다.
// 중간에 실패하면 계정이 남아 있으므로 같은 요청을 다시 보내면 이어서 지운다 (server/accountStore.js).
router.delete('/api/profile', requireAuth, async (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ message: '탈퇴를 확인하는 값(confirm: true)이 필요해요.' })
  }
  try {
    await deleteUserRecords(req.userId)
    await deleteUserPhotos(req.userId)
    await deleteAuthUser(req.userId)
    return res.json({ ok: true })
  } catch (error) {
    // 내부 오류 문구(DB·Supabase)는 사용자에게 보내지 않는다.
    console.error('[account-delete]', error)
    return res.status(500).json({
      message: '탈퇴를 끝내지 못했어요. 잠시 후 같은 버튼을 다시 눌러 주세요. 이미 지워진 정보는 다시 지워지지 않고 남은 것만 이어서 처리돼요.',
    })
  }
})
