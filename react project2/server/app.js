import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { getSupabaseAdmin } from './supabaseAdmin.js'
import { getProfile, publicProfile, upsertProfile, validateProfile } from './profileStore.js'
import { geocodePlace, searchCafes, searchParkingNear, searchRestaurants } from './kakaoLocal.js'
import {
  createSavedCourse,
  deleteSavedCourse,
  listSavedCourses,
  renameSavedCourse,
} from './savedCourseStore.js'
import {
  createPost,
  deletePost,
  deleteReview,
  getPost,
  listPosts,
  toggleLike,
  upsertReview,
} from './communityStore.js'
import { enrichPlaces } from './placeEnrich.js'
import { fetchGoogleHoursMany, googlePhotoPath, isPhotoRef, resolveGooglePhotoUri } from './googlePlaces.js'
import { findCachedByIds, findCityPool, toPoolPlace, updatePlaceImages, upsertPlaces } from './placeCache.js'
import { getCityTrends } from './naverTrend.js'
import { searchTransitPath } from './odsay.js'
import { searchWalkPath } from './tmap.js'
import { fetchPlaceDetailsMany, getCityThumbnails, searchAttractions, searchCultureSpots } from './tourApi.js'
import { fetchTransitAccessMany } from './transit.js'
import { fetchCurrentWeather, fetchForecast } from './weather.js'

// 로컬 개발에서 브라우저가 localhost 로 접속하든 127.0.0.1 로 접속하든 허용되도록
// 콤마로 구분된 여러 오리진을 받는다.
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY

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

// Authorization: Bearer <supabase access token> 헤더에서 토큰을 꺼낸다.
function bearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null
}

// 토큰을 Supabase 로 검증해 auth 유저를 돌려준다. 유효하지 않으면 null.
async function verifySupabaseToken(token) {
  if (!token) return null
  const { data, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

// 액세스 토큰을 검증하고 req.authUser / req.userId / req.userName 을 채운다. 실패하면 401.
async function requireAuth(req, res, next) {
  const authUser = await verifySupabaseToken(bearerToken(req))
  if (!authUser) return res.status(401).json({ message: '로그인이 필요해요.' })
  const profile = await getProfile(authUser.id)
  req.authUser = authUser
  req.userId = authUser.id
  req.userName = profile?.name || null
  return next()
}

// 로그인했으면 req.userId / req.userName 을 채우고, 아니면 그냥 통과시킨다.
// 커뮤니티 "읽기"는 비로그인도 되지만, 내가 추천했는지 같은 건 알아야 해서 쓴다.
async function optionalAuth(req, _res, next) {
  const authUser = await verifySupabaseToken(bearerToken(req))
  const profile = authUser ? await getProfile(authUser.id) : null
  req.authUser = authUser
  req.userId = authUser ? authUser.id : null
  req.userName = profile?.name || null
  return next()
}

// 이름/생년월일/성별/휴대폰 프로필 조회·저장.
// 이메일 가입 직후(프로필 완성), 소셜 로그인 첫 진입(프로필 완성)에서 공통으로 쓴다.
app.get('/api/profile', requireAuth, async (req, res) => {
  const profile = await getProfile(req.userId)
  return res.json({ profile: publicProfile(req.authUser, profile) })
})

app.put('/api/profile', requireAuth, async (req, res) => {
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

// ── 커뮤니티 ─────────────────────────────────────────────────────────────
// 읽기(목록/상세)는 비로그인도 가능. 쓰기(공유·후기·추천)는 로그인 필요.

// 공유된 코스 목록. ?city=제주 &sort=recent|likes|rating
app.get('/api/community', optionalAuth, async (req, res) => {
  const { city = '', sort = 'recent' } = req.query || {}
  try {
    const posts = await listPosts({ city: String(city).trim(), sort: String(sort), viewerId: req.userId })
    return res.json({ posts })
  } catch (error) {
    return res.status(500).json({ message: error.message || '커뮤니티 글을 불러오지 못했어요.' })
  }
})

// 글 하나 + 동선 + 후기 목록.
app.get('/api/community/:id', optionalAuth, async (req, res) => {
  try {
    const post = await getPost(req.params.id, req.userId)
    if (!post) return res.status(404).json({ message: '글을 찾지 못했어요.' })
    return res.json({ post })
  } catch (error) {
    return res.status(500).json({ message: error.message || '글을 불러오지 못했어요.' })
  }
})

// 내 코스를 커뮤니티에 공유하기.
app.post('/api/community', requireAuth, async (req, res) => {
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
app.delete('/api/community/:id', requireAuth, async (req, res) => {
  try {
    const ok = await deletePost(req.userId, req.params.id)
    if (!ok) return res.status(404).json({ message: '글을 찾지 못했어요.' })
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error.message || '글을 삭제하지 못했어요.' })
  }
})

// 후기 남기기 (한 사람당 하나. 다시 보내면 갱신).
app.post('/api/community/:id/reviews', requireAuth, async (req, res) => {
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
app.delete('/api/community/:id/reviews', requireAuth, async (req, res) => {
  try {
    const ok = await deleteReview(req.params.id, req.userId)
    if (!ok) return res.status(404).json({ message: '후기를 찾지 못했어요.' })
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ message: error.message || '후기를 지우지 못했어요.' })
  }
})

// 추천 토글.
app.post('/api/community/:id/like', requireAuth, async (req, res) => {
  try {
    const result = await toggleLike(req.params.id, req.userId)
    if (!result) return res.status(404).json({ message: '글을 찾지 못했어요.' })
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: error.message || '추천하지 못했어요.' })
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

// 도보 모드 지도 경로용: Tmap(SK 오픈API) 보행자 경로안내를 서버에서 대신 호출한다.
// ODsay 처럼 경유지를 한 번에 못 받아서 구간(정류장 i -> i+1)마다 따로 조회해 합친다.
// 경로가 없는 구간은 sections 에 null 로 담아 프런트가 직선+추정으로 폴백하게 한다.
app.get('/api/directions/walk', async (req, res) => {
  if (!process.env.TMAP_API_KEY) {
    return res.status(503).json({ message: '서버에 TMAP_API_KEY가 설정되지 않았어요.' })
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
      points.slice(0, -1).map((from, index) => searchWalkPath(from, points[index + 1]).catch(() => null)),
    )
    const totalMinutes = sections.reduce((sum, section) => sum + (section?.totalMinutes || 0), 0)
    return res.json({ sections, totalMinutes })
  } catch (error) {
    console.error('[directions/walk]', error)
    return res.status(502).json({ message: error.message || '도보 경로를 가져오지 못했어요.' })
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

// PlaceCache 에 JSON 배열 문자열로 저장된 칼럼(themes/budgetTiers)을 배열로 되돌린다.
function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// 이미 Gemini 보강을 받아 DB 에 저장된 장소의 추천문구/테마/예산대를 꺼내온다. -> Map(id -> enriched)
// 이 값들은 시간이 지나도 변하지 않는데(영업시간·폐업과 달리), 7일 staleness 갱신 때마다
// 도시 전체를 다시 Gemini 로 보내면 무료 티어 할당량이 새로 얻는 것 없이 나간다.
// 재사용 판별은 themes 가 비어있지 않은지로 한다 — 응답 스키마상 테마는 1~3개가 항상 붙으므로,
// 보강이 실패해 폴백 문구만 저장된 행은 "[]" 로 남아 있어 다음 갱신 때 자연히 다시 시도된다.
async function loadCachedEnrichment(ids) {
  const rows = await findCachedByIds(ids).catch((error) => {
    console.warn(`[course-pool] 기존 보강 조회 실패 — 전부 새로 생성합니다: ${error.message}`)
    return []
  })
  const cached = new Map()
  for (const row of rows) {
    const themes = parseJsonArray(row.themes)
    if (themes.length === 0) continue
    cached.set(row.id, {
      reason: row.reason || '',
      caution: row.caution || '',
      themes,
      budgetTiers: parseJsonArray(row.budgetTiers),
    })
  }
  return cached
}

// 한 번 돌 때 Gemini 로 보낼 장소 수 상한. 풀은 수백 곳이 될 수 있지만 코스에 실제로 쓰이는 건
// 하루 4곳 x 여행일수뿐이라 전부 보강할 이유가 없고, 무료 티어에서는 호출 수가 곧 비용이다.
// 상한에 걸려 밀린 장소는 다음 갱신 때 자연히 차례가 온다 — 이미 보강된 곳은 후보에서 빠지므로
// 갱신할 때마다 커버리지가 조금씩 넓어진다.
const ENRICH_LIMIT_PER_RUN = 80

// 상한 안에서 슬롯이 한쪽으로 쏠리지 않게 고른다.
// 그냥 앞에서부터 자르면 검색 결과 순서상 카페만 잔뜩 뽑혀 '저녁'·'점심' 슬롯엔 테마가 안 붙는다.
// 슬롯별로 돌아가며 한 곳씩 집어서, 모든 슬롯이 고르게 보강되도록 한다.
function selectForEnrichment(places, limit) {
  if (places.length <= limit) return places

  const bySlot = new Map()
  for (const place of places) {
    const slot = place.slot || place.slots?.[0] || '오전'
    if (!bySlot.has(slot)) bySlot.set(slot, [])
    bySlot.get(slot).push(place)
  }

  const queues = [...bySlot.values()]
  const picked = []
  while (picked.length < limit) {
    const before = picked.length
    for (const queue of queues) {
      if (picked.length >= limit) break
      const next = queue.shift()
      if (next) picked.push(next)
    }
    if (picked.length === before) break // 모든 큐가 비었다
  }
  return picked
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

  // 이미 보강된 장소는 Gemini 에 다시 보내지 않는다. 갱신 때 신규 장소가 없으면 호출 자체가 0번이 된다.
  const cachedEnrichment = await loadCachedEnrichment(rawPlaces.map((place) => place.id))
  const pending = rawPlaces.filter((place) => !cachedEnrichment.has(place.id))
  const needsEnrichment = selectForEnrichment(pending, ENRICH_LIMIT_PER_RUN)
  console.log(
    `[course-pool] ${cityKey}: 풀 ${rawPlaces.length}곳 | 보강 재사용 ${cachedEnrichment.size} | ` +
      `Gemini 신규 ${needsEnrichment.length}${pending.length > needsEnrichment.length ? ` (대기 ${pending.length - needsEnrichment.length})` : ''}`,
  )

  // 동시에 조회: 추천 텍스트(Gemini) · 관광지 주차·영업시간(TourAPI detailIntro2) ·
  // 음식점·카페 영업시간(Google Places) · 대중교통 접근성(카카오).
  // Gemini(추천문구·테마)는 실패해도 코스는 만들 수 있으므로(규칙 기반 슬롯/카테고리로 대체) 치명적으로 보지 않는다.
  const [enrichment, detailByPlaceId, googleHoursByPlaceId, transitByPlaceId] = await Promise.all([
      enrichPlaces(needsEnrichment.map((place) => ({ id: place.id, name: place.name, category: place.category }))).catch(
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
        // 이번에 새로 생성한 것 > DB 에 있던 기존 보강 > 폴백 순.
        const enriched =
          enrichment.get(place.id) || cachedEnrichment.get(place.id) || { reason: '', caution: '', themes: [], budgetTiers: [] }
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
          // 대표 사진: 관광지·문화시설은 TourAPI 가 준 절대 URL, 맛집·카페는 Google 사진 프록시 경로.
          imageUrl: place.image || googlePhotoPath(hours.photoRef) || null,
          // 카드 딥데이터 — 지금은 Google 소스(맛집·카페)만 채워진다. TourAPI(관광지)는 이 필드들이 없어 전부 null.
          rating: hours.rating ?? null,
          userRatingCount: hours.userRatingCount ?? null,
          editorialSummary: hours.editorialSummary ?? null,
          websiteUrl: hours.websiteUrl ?? null,
          reason: enriched.reason || `${place.name}, ${cityKey}에서 들러볼 만한 곳이에요.`,
          caution: enriched.caution || '방문 전 영업시간과 휴무일을 확인해 주세요.',
          themes: JSON.stringify(enriched.themes || []),
          budgetTiers: JSON.stringify(enriched.budgetTiers || []),
        }
      })

  await upsertPlaces(rows)
  return rows
}

// 사진 칼럼이 생기기 전에 캐시된 장소들을 위한 보강.
// 풀 전체를 다시 만들면 Gemini·상세조회까지 또 돌아가니, 사진만 따로 채워 넣는다.
// (관광지·문화시설은 도시 검색 2번으로 전부 커버되고, 맛집·카페만 장소 단위로 조회한다.)
async function backfillCityImages(cityKey, rows) {
  const missing = rows.filter((row) => !row.imageUrl)
  if (missing.length === 0) return

  const tourRows = missing.filter((row) => row.source === 'tourapi')
  const kakaoRows = missing.filter((row) => row.source === 'kakao')

  const [tourPlaces, googleByPlaceId] = await Promise.all([
    tourRows.length === 0
      ? Promise.resolve([])
      : Promise.all([searchAttractions(cityKey), searchCultureSpots(cityKey)])
          .then(([attractions, cultureSpots]) => [...attractions, ...cultureSpots])
          .catch(() => []),
    fetchGoogleHoursMany(kakaoRows),
  ])

  const tourImageById = new Map(tourPlaces.filter((place) => place.image).map((place) => [place.id, place.image]))
  const updates = missing
    .map((row) => ({
      id: row.id,
      imageUrl: tourImageById.get(row.id) || googlePhotoPath(googleByPlaceId.get(row.id)?.photoRef) || null,
    }))
    .filter((update) => update.imageUrl)

  if (updates.length > 0) await updatePlaceImages(updates)
  console.log(`[course-pool images] ${cityKey}: ${updates.length}/${missing.length}곳 사진 보강`)
}

// 같은 도시를 동시에 두 번 사진 보강하지 않도록.
const backfillingCities = new Set()
function backfillCityImagesInBackground(cityKey, rows) {
  if (backfillingCities.has(cityKey)) return
  backfillingCities.add(cityKey)
  backfillCityImages(cityKey, rows)
    .catch((error) => console.warn(`[course-pool images] ${cityKey}: ${error.message}`))
    .finally(() => backfillingCities.delete(cityKey))
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
      // 사진이 비어 있는 캐시 행(사진 기능 이전에 저장된 것)은 응답과 별개로 조용히 채워 둔다.
      else if (cached.some((row) => !row.imageUrl)) backfillCityImagesInBackground(cityKey, cached)
      return
    }

    const rows = await buildCityPoolRows(cityKey)
    return res.json(cityPoolResponse(cityKey, rows))
  } catch (error) {
    console.error('[course-pool]', error)
    return res.status(502).json({ message: error.message || '여행지 정보를 가져오지 못했어요.' })
  }
})

// 맛집·카페 대표 사진 프록시. Google Places 사진은 API 키가 있어야 받을 수 있어서
// 키를 브라우저로 내보내는 대신 여기서 실제 이미지 주소를 받아 리다이렉트한다.
// ?ref=places/<place_id>/photos/<photo_id> (PlaceCache.imageUrl 에 들어 있는 값 그대로)
app.get('/api/place-photo', async (req, res) => {
  const ref = String(req.query.ref || '')
  // 임의 URL 로 서버가 요청을 날리지 않도록 Google 사진 리소스 이름 모양만 받는다.
  if (!isPhotoRef(ref)) return res.status(400).json({ message: 'ref 파라미터가 올바르지 않아요.' })

  const width = Math.min(Math.max(Number.parseInt(req.query.w, 10) || 320, 80), 1200)

  try {
    const photoUri = await resolveGooglePhotoUri(ref, width)
    if (!photoUri) return res.status(404).json({ message: '사진을 찾지 못했어요.' })
    // 이미지 주소 자체는 만료되지만, 이 경로는 캐시돼도 되므로 브라우저 재요청을 줄인다.
    res.set('Cache-Control', 'public, max-age=1800')
    return res.redirect(302, photoUri)
  } catch (error) {
    return res.status(502).json({ message: error.message || '사진을 가져오지 못했어요.' })
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
