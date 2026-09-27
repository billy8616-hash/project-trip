// ─────────────────────────────────────────────────────────────
// server/routes/misc.js — 그 밖의 프록시 엔드포인트
//
// 사진·썸네일·트렌드·날씨·지오코딩. 모두 외부 API 키를 숨기기 위한 중계 통로다.
// ─────────────────────────────────────────────────────────────

import express from 'express'
import { geocodePlace, searchLodging } from '../kakaoLocal.js'
import { isPhotoRef, resolveGooglePhotoUri } from '../googlePlaces.js'
import { getCityThumbnails } from '../tourApi.js'
import { getCityTrends } from '../naverTrend.js'
import { fetchCurrentWeather, fetchForecast } from '../weather.js'

export const router = express.Router()

// 맛집·카페 대표 사진 프록시. Google Places 사진은 API 키가 있어야 받을 수 있어서
// 키를 브라우저로 내보내는 대신 여기서 실제 이미지 주소를 받아 리다이렉트한다.
// ?ref=places/<place_id>/photos/<photo_id> (PlaceCache.imageUrl 에 들어 있는 값 그대로)
router.get('/api/place-photo', async (req, res) => {
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
router.get('/api/city-thumbnails', async (req, res) => {
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
router.get('/api/city-trends', async (req, res) => {
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

// 숙소 이름 자동완성. 출발지·숙소 입력 화면에서 사용자가 타이핑하는 동안 호출된다.
// ?query=신라 &lat=35.85 &lng=129.22  (좌표는 선택 — 있으면 그 주변을 먼저 찾는다)
//
// 두 글자 미만은 후보가 너무 많아 의미가 없으므로 외부 API 를 부르지 않고 빈 배열로 끝낸다.
// 검색 실패도 200 + 빈 배열로 돌려준다 — 자동완성은 부가 기능이라, 실패했다고
// 입력 화면에 에러를 띄우면 오히려 방해가 된다.
router.get('/api/lodging', async (req, res) => {
  const query = String(req.query.query || '').trim()
  if (query.length < 2) return res.json({ items: [] })

  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)

  try {
    const items = await searchLodging(query, { lat, lng })
    return res.json({ items })
  } catch (error) {
    console.warn('[lodging]', error?.message || error)
    return res.json({ items: [] })
  }
})

// 출발지·숙소 자유 입력 텍스트 -> 좌표 (카카오 로컬 주소/키워드 검색).
router.get('/api/geocode', async (req, res) => {
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
router.get('/api/weather', async (req, res) => {
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
router.get('/api/weather/forecast', async (req, res) => {
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
