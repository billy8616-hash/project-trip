import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createUser, findUserByEmail, findUserById, hashPassword, publicUser, verifyPassword } from './authStore.js'
import { createRateLimiter } from './rateLimit.js'
import { geocodePlace, searchCafes, searchParkingNear, searchRestaurants } from './kakaoLocal.js'
import {
  createSavedCourse,
  deleteSavedCourse,
  listSavedCourses,
  renameSavedCourse,
} from './savedCourseStore.js'
import { enrichPlaces } from './placeEnrich.js'
import { fetchGoogleHoursMany } from './googlePlaces.js'
import { findCityPool, toPoolPlace, upsertPlaces } from './placeCache.js'
import { getCityTrends } from './naverTrend.js'
import { searchTransitPath } from './odsay.js'
import { fetchPlaceDetailsMany, getCityThumbnails, searchAttractions, searchCultureSpots } from './tourApi.js'
import { fetchTransitAccessMany } from './transit.js'
import { fetchCurrentWeather, fetchForecast } from './weather.js'

// 로컬 개발에서 브라우저가 localhost 로 접속하든 127.0.0.1 로 접속하든 허용되도록
// 콤마로 구분된 여러 오리진을 받는다.
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const isProduction = process.env.NODE_ENV === 'production'

// 개발 편의를 위한 값. 프로덕션에서는 절대 쓰이지 않는다(아래에서 부팅을 막는다).
const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret'

// .env.example 이나 과거 코드에 있던 예시 값들. 프로덕션에서 이게 그대로면 시크릿이 공개된 것과 같다.
const PLACEHOLDER_JWT_SECRETS = new Set([
  DEV_JWT_SECRET,
  'change-this-secret-before-production',
  'replace_this_with_a_long_random_secret',
  'dev_secret_change_before_production',
])

// 토큰 위조를 막는 마지막 방어선이라, 프로덕션에서 시크릿이 없거나 예시 값이면
// 조용히 넘어가지 않고 서버 부팅 자체를 실패시킨다.
function resolveJwtSecret() {
  const secret = (process.env.JWT_SECRET || '').trim()

  if (!isProduction) {
    if (!secret) {
      console.warn('[auth] JWT_SECRET이 없어 개발용 임시 시크릿을 씁니다. 배포 전에 .env에 반드시 설정하세요.')
      return DEV_JWT_SECRET
    }
    return secret
  }

  const hint = 'openssl rand -base64 48 (또는 node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))") 로 생성하세요.'
  if (!secret) {
    throw new Error(`프로덕션에서는 JWT_SECRET 환경변수가 반드시 필요합니다. ${hint}`)
  }
  if (PLACEHOLDER_JWT_SECRETS.has(secret)) {
    throw new Error(`JWT_SECRET이 예시 값 그대로입니다. 실제 시크릿으로 바꾸세요. ${hint}`)
  }
  if (secret.length < 32) {
    throw new Error(`JWT_SECRET이 너무 짧습니다(32자 이상 권장). ${hint}`)
  }
  return secret
}

// 모듈을 불러오는 것만으로는 검사하지 않는다. vite.config.js 가 이 앱을 미들웨어로 쓰려고
// import 하는데, `vite build` 는 NODE_ENV=production 으로 돌아서 여기서 던지면 프런트 빌드까지 막힌다.
// 대신 (1) 토큰을 실제로 다룰 때와 (2) 서버가 기동할 때(server.js 의 assertJwtSecret) 검사한다.
let cachedJwtSecret = null
function getJwtSecret() {
  if (cachedJwtSecret === null) cachedJwtSecret = resolveJwtSecret()
  return cachedJwtSecret
}

// 서버 기동 시점에 미리 불러 실패시키기 위한 진입점 (server.js 에서 호출).
export function assertJwtSecret() {
  return getJwtSecret()
}

const cookieName = 'auth_token'
const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY

function base64Url(input) {
  return Buffer.from(input).toString('base64url')
}

function signToken(payload) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64Url(JSON.stringify(payload))
  const signature = createHmac('sha256', getJwtSecret()).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

function verifyToken(token) {
  const [header, body, signature] = token.split('.')
  if (!header || !body || !signature) return null

  const expected = createHmac('sha256', getJwtSecret()).update(`${header}.${body}`).digest('base64url')
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

export const app = express()

// 프록시(nginx, 클라우드 로드밸런서) 뒤에 두면 req.ip 가 프록시 주소로 잡혀
// 모든 사용자가 한 IP 로 묶인다. 그럴 땐 TRUST_PROXY 를 켜서 X-Forwarded-For 를 신뢰하게 한다.
// 기본값은 끔 — 잘못 켜면 클라이언트가 IP를 위조해 rate limit 을 우회할 수 있다.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY)
}

app.use(express.json())
app.use(cors({
  origin: clientOrigins,
  credentials: true,
}))

// 로그인 방어는 두 겹이다.
// - 계정별: 같은 이메일에 실패가 쌓이면 잠근다 (분산된 IP 에서 오는 비밀번호 추측 차단).
// - IP별: 성공/실패와 무관하게 총 시도를 제한한다. verifyPassword 가 pbkdf2 12만 회라
//   요청만 쏟아부어도 CPU 가 고갈되기 때문에, 계정 잠금과 별개로 필요하다.
const loginAccountLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, blockMs: 15 * 60 * 1000 })
const loginIpLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, blockMs: 5 * 60 * 1000 })
const signupIpLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, blockMs: 60 * 60 * 1000 })

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function tooManyRequests(res, retryAfterSec, message) {
  res.set('Retry-After', String(retryAfterSec))
  const minutes = Math.ceil(retryAfterSec / 60)
  return res.status(429).json({ message: `${message} ${minutes}분 뒤에 다시 시도해주세요.` })
}

app.post('/api/auth/signup', async (req, res) => {
  const ip = clientIp(req)
  const signupLimit = signupIpLimiter.hit(ip)
  if (!signupLimit.allowed) {
    return tooManyRequests(res, signupLimit.retryAfterSec, '가입 시도가 너무 많아요.')
  }

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

  const existingUser = await findUserByEmail(email)
  if (existingUser) {
    return res.status(409).json({ message: '이미 가입된 이메일이에요.' })
  }

  const user = await createUser({
    id: randomUUID(),
    email,
    name,
    birthdate,
    gender: gender || null,
    phone: phone || null,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  })

  const token = signToken({
    sub: user.id,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  })
  res.cookie(cookieName, token, cookieOptions())
  return res.status(201).json({ user: publicUser(user) })
})

app.post('/api/auth/login', async (req, res) => {
  const ip = clientIp(req)

  // 비싼 비밀번호 검증(pbkdf2)에 들어가기 전에 IP 한도부터 막는다.
  const ipLimit = loginIpLimiter.hit(ip)
  if (!ipLimit.allowed) {
    return tooManyRequests(res, ipLimit.retryAfterSec, '로그인 시도가 너무 많아요.')
  }

  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const validationError = validateCredentials(email, password)
  if (validationError) return res.status(400).json({ message: validationError })

  // 이 계정이 실패 누적으로 잠겨 있으면 비밀번호를 확인하지 않고 돌려보낸다.
  const accountLimit = loginAccountLimiter.check(email)
  if (!accountLimit.allowed) {
    return tooManyRequests(res, accountLimit.retryAfterSec, '로그인 실패가 많아 잠시 잠갔어요.')
  }

  const user = await findUserByEmail(email)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    // 실패했을 때만 계정 카운터를 올린다. 정상 로그인은 한도를 소모하지 않는다.
    const failure = loginAccountLimiter.hit(email)
    if (!failure.allowed) {
      return tooManyRequests(res, failure.retryAfterSec, '로그인 실패가 많아 잠시 잠갔어요.')
    }
    return res.status(401).json({ message: '이메일 또는 비밀번호가 맞지 않아요.' })
  }

  // 정상 로그인이 확인됐으니 그동안 쌓인 실패 기록을 지운다.
  loginAccountLimiter.reset(email)

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

  const user = await findUserById(payload.sub)
  if (!user) return res.status(401).json({ user: null })

  return res.json({ user: publicUser(user) })
})

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(cookieName, { sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  return res.json({ ok: true })
})

// 로그인 쿠키를 검증하고 req.userId 를 채운다. 실패하면 401.
async function requireAuth(req, res, next) {
  const token = getCookie(req, cookieName)
  const payload = token ? verifyToken(token) : null
  if (!payload) return res.status(401).json({ message: '로그인이 필요해요.' })
  const user = await findUserById(payload.sub)
  if (!user) return res.status(401).json({ message: '로그인이 필요해요.' })
  req.userId = user.id
  return next()
}

// "내 여행" — 로그인 사용자가 저장한 여행 동선 목록.
app.get('/api/trips', requireAuth, async (req, res) => {
  try {
    const trips = await listSavedCourses(req.userId)
    return res.json({ trips })
  } catch (error) {
    return res.status(500).json({ message: error.message || '저장한 여행을 불러오지 못했어요.' })
  }
})

// 지금 보고 있는 코스를 "내 여행"에 저장한다.
app.post('/api/trips', requireAuth, async (req, res) => {
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
app.patch('/api/trips/:id', requireAuth, async (req, res) => {
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
app.delete('/api/trips/:id', requireAuth, async (req, res) => {
  try {
    const ok = await deleteSavedCourse(req.userId, req.params.id)
    if (!ok) return res.status(404).json({ message: '해당 여행을 찾지 못했어요.' })
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error.message || '여행을 삭제하지 못했어요.' })
  }
})

const COORD_PATTERN = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/
const WAYPOINTS_PATTERN = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?(\|-?\d+(\.\d+)?,-?\d+(\.\d+)?)*$/

// 자동차 모드 지도 경로용: 카카오모빌리티 길찾기(REST API)를 서버에서 대신 호출한다.
// REST 키를 브라우저에 노출하지 않기 위해 프런트는 이 엔드포인트로만 요청한다.
app.get('/api/directions/car', async (req, res) => {
  if (!kakaoRestApiKey) {
    return res.status(503).json({ message: '서버에 KAKAO_REST_API_KEY가 설정되지 않았어요.' })
  }

  const origin = String(req.query.origin || '')
  const destination = String(req.query.destination || '')
  const waypoints = String(req.query.waypoints || '')
  if (!COORD_PATTERN.test(origin) || !COORD_PATTERN.test(destination)) {
    return res.status(400).json({ message: 'origin, destination 좌표(lng,lat)가 필요해요.' })
  }
  if (waypoints && !WAYPOINTS_PATTERN.test(waypoints)) {
    return res.status(400).json({ message: 'waypoints 형식이 올바르지 않아요.' })
  }

  const params = new URLSearchParams({ origin, destination, priority: 'RECOMMEND' })
  if (waypoints) params.set('waypoints', waypoints)

  let response
  try {
    response = await fetch(`https://apis-navi.kakaomobility.com/v1/directions?${params}`, {
      headers: { Authorization: `KakaoAK ${kakaoRestApiKey}` },
    })
  } catch {
    return res.status(502).json({ message: '카카오 길찾기 서버에 연결하지 못했어요.' })
  }

  const data = await response.json().catch(() => null)
  const route = data?.routes?.[0]
  if (!response.ok || !route || route.result_code !== 0) {
    return res.status(502).json({ message: route?.result_msg || data?.msg || '경로를 찾지 못했어요.' })
  }

  const sections = route.sections.map((section) => ({
    duration: section.duration,
    distance: section.distance,
    path: section.roads.flatMap((road) => {
      const points = []
      for (let i = 0; i < road.vertexes.length; i += 2) {
        points.push({ lng: road.vertexes[i], lat: road.vertexes[i + 1] })
      }
      return points
    }),
  }))

  return res.json({ sections, duration: route.summary.duration, distance: route.summary.distance })
})

// 대중교통 모드 지도 경로용: ODsay 대중교통 길찾기를 서버에서 대신 호출한다.
// 자동차와 달리 ODsay 는 경유지를 못 받아서, 구간(정류장 i -> i+1)마다 따로 조회해 합친다.
// 경로가 없는 구간(지방 시골 등)은 sections 에 null 로 담아 프런트가 직선+추정으로 폴백하게 한다.
app.get('/api/directions/transit', async (req, res) => {
  if (!process.env.ODSAY_API_KEY) {
    return res.status(503).json({ message: '서버에 ODSAY_API_KEY가 설정되지 않았어요.' })
  }

  const origin = String(req.query.origin || '')
  const destination = String(req.query.destination || '')
  const waypoints = String(req.query.waypoints || '')
  if (!COORD_PATTERN.test(origin) || !COORD_PATTERN.test(destination)) {
    return res.status(400).json({ message: 'origin, destination 좌표(lng,lat)가 필요해요.' })
  }
  if (waypoints && !WAYPOINTS_PATTERN.test(waypoints)) {
    return res.status(400).json({ message: 'waypoints 형식이 올바르지 않아요.' })
  }

  const toPoint = (text) => {
    const [lng, lat] = text.split(',').map(Number)
    return { lat, lng }
  }
  const points = [origin, ...(waypoints ? waypoints.split('|') : []), destination].map(toPoint)

  try {
    const sections = await Promise.all(
      points.slice(0, -1).map((from, index) => searchTransitPath(from, points[index + 1]).catch(() => null)),
    )
    const totalMinutes = sections.reduce((sum, section) => sum + (section?.totalMinutes || 0), 0)
    return res.json({ sections, totalMinutes })
  } catch (error) {
    console.error('[directions/transit]', error)
    return res.status(502).json({ message: error.message || '대중교통 경로를 가져오지 못했어요.' })
  }
})

// 슬롯별 예상 체류/이동시간 기본값 (규칙 기반 — 실제 이동시간은 카카오맵이 별도로 계산한다).
const SLOT_DEFAULTS = {
  오전: { stay: '1시간', time: '15분' },
  '점심 맛집': { stay: '1시간', time: '10분' },
  '오후 카페': { stay: '50분', time: '12분' },
  저녁: { stay: '40분', time: '15분' },
}

function dedupeById(places) {
  const seen = new Map()
  for (const place of places) {
    if (!seen.has(place.id)) seen.set(place.id, place)
  }
  return [...seen.values()]
}

function cityCenter(places) {
  const withLocation = places.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
  if (withLocation.length === 0) return null
  const sum = withLocation.reduce((acc, place) => ({ lat: acc.lat + place.lat, lng: acc.lng + place.lng }), { lat: 0, lng: 0 })
  return { lat: sum.lat / withLocation.length, lng: sum.lng / withLocation.length }
}

// 외부 API/LLM 을 다 돌려 도시 하나의 장소 풀을 만들고 DB 에 저장한다. -> 저장한 rows
// (prewarm 스크립트에서도 직접 부른다.)
export async function buildCityPoolRows(cityKey) {
  const [attractions, cultureSpots, restaurants, cafes] = await Promise.all([
      searchAttractions(cityKey),
      searchCultureSpots(cityKey),
      searchRestaurants(cityKey),
      searchCafes(cityKey),
    ])

  const rawPlaces = dedupeById([...attractions, ...cultureSpots, ...restaurants, ...cafes])
  if (rawPlaces.length === 0) {
    throw new Error(`${cityKey}에서 장소를 찾지 못했어요.`)
  }

  // 동시에 조회: 추천 텍스트(Gemini) · 관광지 주차·영업시간(TourAPI detailIntro2) ·
  // 음식점·카페 영업시간(Google Places) · 대중교통 접근성(카카오).
  // Gemini(추천문구·테마)는 실패해도 코스는 만들 수 있으므로(규칙 기반 슬롯/카테고리로 대체) 치명적으로 보지 않는다.
  const [enrichment, detailByPlaceId, googleHoursByPlaceId, transitByPlaceId] = await Promise.all([
      enrichPlaces(rawPlaces.map((place) => ({ id: place.id, name: place.name, category: place.category }))).catch(
        (error) => {
          console.warn(`[course-pool] Gemini 보강 건너뜀: ${error.message?.slice(0, 120)}`)
          return new Map()
        },
      ),
      fetchPlaceDetailsMany(rawPlaces.filter((place) => place.source === 'tourapi')),
      fetchGoogleHoursMany(rawPlaces.filter((place) => place.source === 'kakao')),
      fetchTransitAccessMany(rawPlaces),
    ])

    const rows = rawPlaces
      .map((place) => {
        const enriched = enrichment.get(place.id) || { reason: '', caution: '', themes: [], budgetTiers: [] }
        const slots = Array.isArray(place.slots) && place.slots.length > 0 ? place.slots : [place.slot || '오전']
        const defaults = SLOT_DEFAULTS[slots[0]] || SLOT_DEFAULTS['오전']
        const transit = transitByPlaceId.get(place.id) || { transitStation: null, transitDistanceM: null, transitScore: 'none' }
        const detail = detailByPlaceId.get(place.id) || {}
        // 영업시간 출처: 카카오 장소는 Google Places, 관광지·문화시설은 TourAPI detailIntro2.
        const hours = googleHoursByPlaceId.get(place.id) || detail
        return {
          id: place.id,
          source: place.source,
          cityKey,
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          slot: slots[0],
          slots: JSON.stringify(slots),
          category: place.category || '',
          stay: defaults.stay,
          time: defaults.time,
          parking: detail.parking || null,
          openHoursText: hours.openHoursText || null,
          closedDayText: hours.closedDayText || null,
          opensAt: hours.opensAt ?? null,
          closesAt: hours.closesAt ?? null,
          alwaysOpen: hours.alwaysOpen ?? false,
          closedWeekdays: JSON.stringify(hours.closedWeekdays || []),
          feeText: hours.feeText || '',
          costTier: hours.costTier || '',
          transitStation: transit.transitStation,
          transitDistanceM: transit.transitDistanceM,
          transitScore: transit.transitScore,
          reason: enriched.reason || `${place.name}, ${cityKey}에서 들러볼 만한 곳이에요.`,
          caution: enriched.caution || '방문 전 영업시간과 휴무일을 확인해 주세요.',
          themes: JSON.stringify(enriched.themes || []),
          budgetTiers: JSON.stringify(enriched.budgetTiers || []),
        }
      })

  await upsertPlaces(rows)
  return rows
}

// 같은 도시를 동시에 두 번 백그라운드 갱신하지 않도록.
const refreshingCities = new Set()
function refreshCityPoolInBackground(cityKey) {
  if (refreshingCities.has(cityKey)) return
  refreshingCities.add(cityKey)
  buildCityPoolRows(cityKey)
    .catch((error) => console.warn(`[course-pool refresh] ${cityKey}: ${error.message}`))
    .finally(() => refreshingCities.delete(cityKey))
}

function cityPoolResponse(cityKey, rows) {
  return {
    title: `${cityKey} 코스`,
    subtitle: `${cityKey}의 장소를 모아 만든 하루`,
    center: cityCenter(rows.map((row) => ({ lat: row.lat, lng: row.lng }))),
    pool: rows.map(toPoolPlace),
  }
}

// 캐시가 있으면 오래됐어도 즉시 응답하고, 오래됐으면 백그라운드로만 갱신한다.
// 캐시가 전혀 없을 때(그 도시 첫 조회)만 외부 API 를 기다린다.
app.get('/api/course-pool', async (req, res) => {
  const cityKey = String(req.query.city || '').trim()
  if (!cityKey) return res.status(400).json({ message: 'city 파라미터가 필요해요.' })

  try {
    const { rows: cached, stale } = await findCityPool(cityKey)
    if (cached && cached.length > 0) {
      res.json(cityPoolResponse(cityKey, cached))
      if (stale) refreshCityPoolInBackground(cityKey)
      return
    }

    const rows = await buildCityPoolRows(cityKey)
    return res.json(cityPoolResponse(cityKey, rows))
  } catch (error) {
    console.error('[course-pool]', error)
    return res.status(502).json({ message: error.message || '여행지 정보를 가져오지 못했어요.' })
  }
})

// 여행지 카드에 쓸 대표 사진들 (한국관광공사 TourAPI). ?cities=서울,제주,... 콤마로 여러 도시를 한 번에 받는다.
app.get('/api/city-thumbnails', async (req, res) => {
  const cities = String(req.query.cities || '')
    .split(',')
    .map((city) => city.trim())
    .filter(Boolean)
  if (cities.length === 0) return res.status(400).json({ message: 'cities 파라미터가 필요해요.' })

  try {
    const thumbnails = await getCityThumbnails(cities)
    return res.json({ thumbnails })
  } catch (error) {
    return res.status(502).json({ message: error.message || '여행지 사진을 가져오지 못했어요.' })
  }
})

// 여행지 카드에 "지금 뜨는 중" 배지를 띄우기 위한 검색 트렌드 (네이버 데이터랩).
// ?cities=서울,제주,... 콤마로 여러 도시를 한 번에 받는다.
app.get('/api/city-trends', async (req, res) => {
  const cities = String(req.query.cities || '')
    .split(',')
    .map((city) => city.trim())
    .filter(Boolean)
  if (cities.length === 0) return res.status(400).json({ message: 'cities 파라미터가 필요해요.' })

  try {
    const trends = await getCityTrends(cities)
    return res.json({ trends })
  } catch (error) {
    console.error('[city-trends]', error)
    return res.status(502).json({ message: error.message || '여행지 트렌드를 가져오지 못했어요.' })
  }
})

// 출발지·숙소 자유 입력 텍스트 -> 좌표 (카카오 로컬 주소/키워드 검색).
app.get('/api/geocode', async (req, res) => {
  const query = String(req.query.query || '').trim()
  if (!query) return res.status(400).json({ message: 'query 파라미터가 필요해요.' })

  try {
    const place = await geocodePlace(query)
    return res.json(place)
  } catch (error) {
    return res.status(502).json({ message: error.message || '위치를 찾지 못했어요.' })
  }
})

// 코스 화면 상단에 보여줄 현재 날씨 하나 (OpenWeatherMap).
app.get('/api/weather', async (req, res) => {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'lat, lng 파라미터가 필요해요.' })
  }

  try {
    const weather = await fetchCurrentWeather(lat, lng)
    return res.json(weather)
  } catch (error) {
    return res.status(502).json({ message: error.message || '날씨 정보를 가져오지 못했어요.' })
  }
})

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// 날짜 선택 화면에서 여행 기간 전체의 날씨 예보를 미리 보여주기 위한 엔드포인트.
app.get('/api/weather/forecast', async (req, res) => {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  const start = String(req.query.start || '')
  const end = String(req.query.end || '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'lat, lng 파라미터가 필요해요.' })
  }
  if (!DATE_PATTERN.test(start) || !DATE_PATTERN.test(end) || start > end) {
    return res.status(400).json({ message: 'start, end 날짜(YYYY-MM-DD)가 필요해요.' })
  }

  try {
    const days = await fetchForecast(lat, lng, start, end)
    return res.json({ days })
  } catch (error) {
    return res.status(502).json({ message: error.message || '날씨 예보를 가져오지 못했어요.' })
  }
})

// 코스 화면에서 선택한 관광지 주변 주차장 (카카오 로컬 카테고리 검색, PK6).
app.get('/api/parking', async (req, res) => {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  const radius = Number(req.query.radius)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'lat, lng 파라미터가 필요해요.' })
  }

  try {
    const items = await searchParkingNear(lat, lng, Number.isFinite(radius) ? radius : 700)
    return res.json({ items })
  } catch (error) {
    return res.status(502).json({ message: error.message || '주차장 정보를 가져오지 못했어요.' })
  }
})
