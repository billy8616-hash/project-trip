/* =========================================================================
   server.js — 발길따라 인증 API (Express)
   -------------------------------------------------------------------------
   라우트
     POST /api/signup  { username, password, nickname? }  → 201 { user }
     POST /api/login   { username, password }             → 200 { user } + 세션 쿠키
     GET  /api/me                                         → 200 { user } / 401
     POST /api/logout                                     → 200 { ok:true } + 쿠키 삭제

   - 세션은 httpOnly 쿠키(balgil_session)에 담긴 임의 토큰. JS로 못 읽는다.
   - 회원가입은 계정만 만든다. 로그인은 별도로 해야 한다. (요청 사양 그대로)
   - dist/ 가 있으면 같은 서버에서 프런트엔드도 서빙한다. (배포 시 단일 오리진)
   ========================================================================= */

import express from 'express'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createSession,
  createUser,
  destroySession,
  getSessionUser,
  getUserByUsername,
  publicUser,
  verifyPassword,
} from './authStore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT || 8787)
const COOKIE = 'balgil_session'
const isProd = process.env.NODE_ENV === 'production'

app.use(express.json())

/* 요청 쿠키 파싱 (cookie-parser 없이) */
function getCookie(req, name) {
  const raw = req.headers.cookie || ''
  const hit = raw
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(name + '='))
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7일
  })
}

/* 아이디: 영문/숫자/밑줄 4~20자 */
const USERNAME_RE = /^[A-Za-z0-9_]{4,20}$/

app.post('/api/signup', (req, res) => {
  const username = String(req.body.username || '').trim()
  const password = String(req.body.password || '')
  const nickname = String(req.body.nickname || '').trim() || username

  if (!USERNAME_RE.test(username)) {
    return res
      .status(400)
      .json({ message: '아이디는 영문·숫자·밑줄 4~20자여야 합니다.' })
  }
  if (password.length < 4) {
    return res.status(400).json({ message: '비밀번호는 4자 이상이어야 합니다.' })
  }
  if (nickname.length > 16) {
    return res.status(400).json({ message: '닉네임은 16자 이하여야 합니다.' })
  }
  if (getUserByUsername(username)) {
    return res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
  }

  const user = createUser({ username, nickname, password })
  return res.status(201).json({ user: publicUser(user) })
})

app.post('/api/login', (req, res) => {
  const username = String(req.body.username || '').trim()
  const password = String(req.body.password || '')

  const user = getUserByUsername(username)
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res
      .status(401)
      .json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
  }

  setSessionCookie(res, createSession(user.id))
  return res.json({ user: publicUser(user) })
})

app.get('/api/me', (req, res) => {
  const user = getSessionUser(getCookie(req, COOKIE))
  if (!user) return res.status(401).json({ user: null })
  return res.json({ user: publicUser(user) })
})

app.post('/api/logout', (req, res) => {
  destroySession(getCookie(req, COOKIE))
  res.clearCookie(COOKIE, { path: '/', sameSite: 'lax', secure: isProd })
  return res.json({ ok: true })
})

/* --- 빌드된 프런트엔드 서빙 (있을 때만) ------------------------------- */
const distDir = join(__dirname, '..', 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  // SPA 폴백: /api 가 아닌 GET 요청은 index.html 로
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
    res.sendFile(join(distDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`발길따라 auth 서버: http://localhost:${PORT}`)
})
