import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { hashPassword, publicUser, readUsers, verifyPassword, writeUsers } from './authStore.js'

const app = express()
const port = Number(process.env.PORT || 4000)
// 로컬 개발에서 브라우저가 localhost 로 접속하든 127.0.0.1 로 접속하든 허용되도록
// 콤마로 구분된 여러 오리진을 받는다.
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const jwtSecret = process.env.JWT_SECRET || 'change-this-secret-before-production'
const cookieName = 'auth_token'

app.use(express.json())
app.use(cors({
  origin: clientOrigins,
  credentials: true,
}))

function base64Url(input) {
  return Buffer.from(input).toString('base64url')
}

function signToken(payload) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64Url(JSON.stringify(payload))
  const signature = createHmac('sha256', jwtSecret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

function verifyToken(token) {
  const [header, body, signature] = token.split('.')
  if (!header || !body || !signature) return null

  const expected = createHmac('sha256', jwtSecret).update(`${header}.${body}`).digest('base64url')
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  }
}

function getCookie(req, name) {
  const cookies = req.headers.cookie?.split(';') ?? []
  const cookie = cookies.map((value) => value.trim()).find((value) => value.startsWith(`${name}=`))
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null
}

function validateCredentials(email, password) {
  if (!email || !password) return '이메일과 비밀번호를 입력해주세요.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '올바른 이메일 형식이 아니에요.'
  if (password.length < 6) return '비밀번호는 6자 이상이어야 해요.'
  return null
}

const ALLOWED_GENDERS = ['male', 'female', 'other']

// 회원가입 폼 전체(이름/생년월일/성별/휴대폰 + 이메일/비밀번호)를 서버에서도 재검증한다.
function validateSignup({ name, birthdate, gender, phone, email, password, passwordConfirm }) {
  if (name.length < 2 || name.length > 20) return '이름은 2~20자로 입력해주세요.'

  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    return '생년월일을 YYYY-MM-DD 형식으로 입력해주세요.'
  }
  const birth = new Date(`${birthdate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return '올바른 생년월일이 아니에요.'
  const now = new Date()
  if (birth > now) return '생년월일은 미래일 수 없어요.'
  const ageInYears = (now - birth) / (1000 * 60 * 60 * 24 * 365.25)
  if (ageInYears > 120) return '생년월일을 다시 확인해주세요.'

  if (gender && !ALLOWED_GENDERS.includes(gender)) return '성별 값이 올바르지 않아요.'

  if (phone && !/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(phone)) {
    return '휴대폰 번호 형식이 올바르지 않아요. (예: 010-1234-5678)'
  }

  const credentialsError = validateCredentials(email, password)
  if (credentialsError) return credentialsError

  if (password !== passwordConfirm) return '비밀번호가 서로 일치하지 않아요.'

  return null
}

app.post('/api/auth/signup', async (req, res) => {
  const name = String(req.body.name || '').trim()
  const birthdate = String(req.body.birthdate || '').trim()
  const gender = String(req.body.gender || '').trim()
  const phone = String(req.body.phone || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const passwordConfirm = String(req.body.passwordConfirm || '')

  const validationError = validateSignup({
    name,
    birthdate,
    gender,
    phone,
    email,
    password,
    passwordConfirm,
  })
  if (validationError) return res.status(400).json({ message: validationError })

  const users = await readUsers()
  if (users.some((user) => user.email === email)) {
    return res.status(409).json({ message: '이미 가입된 이메일이에요.' })
  }

  const user = {
    id: randomUUID(),
    email,
    name,
    birthdate,
    gender: gender || null,
    phone: phone || null,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  await writeUsers(users)

  const token = signToken({
    sub: user.id,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  })
  res.cookie(cookieName, token, cookieOptions())
  return res.status(201).json({ user: publicUser(user) })
})

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const validationError = validateCredentials(email, password)
  if (validationError) return res.status(400).json({ message: validationError })

  const users = await readUsers()
  const user = users.find((item) => item.email === email)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ message: '이메일 또는 비밀번호가 맞지 않아요.' })
  }

  const token = signToken({
    sub: user.id,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  })
  res.cookie(cookieName, token, cookieOptions())
  return res.json({ user: publicUser(user) })
})

app.get('/api/auth/me', async (req, res) => {
  const token = getCookie(req, cookieName)
  const payload = token ? verifyToken(token) : null
  if (!payload) return res.status(401).json({ user: null })

  const users = await readUsers()
  const user = users.find((item) => item.id === payload.sub)
  if (!user) return res.status(401).json({ user: null })

  return res.json({ user: publicUser(user) })
})

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(cookieName, { sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  return res.json({ ok: true })
})

app.listen(port, () => {
  console.log(`Auth API server running on http://127.0.0.1:${port}`)
})
