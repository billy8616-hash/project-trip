// ─────────────────────────────────────────────────────────────
// server/routes/directions.js — 길찾기 프록시 (교통 모드별 3종)
//
// 좌표를 정규식으로 먼저 검사한다. 사용자가 보낸 값을 그대로 외부 API 에 넘기면
// 서버가 엉뚱한 요청을 대신 날려 주는 통로가 될 수 있기 때문이다.
// ─────────────────────────────────────────────────────────────

import express from 'express'
import { publicMessage } from '../httpError.js'
import { mapLimit, timeoutSignal } from '../concurrency.js'
import { searchTransitPath } from '../odsay.js'
import { searchWalkPath } from '../ors.js'

const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY

const COORD_PATTERN = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/
// 경유지는 최대 28개(출발·도착 포함 30곳). 구간마다 외부 API 를 한 번씩 부르므로, 상한이 없으면 요청 하나로
// ORS(하루 2,000회)·ODsay 한도를 다 쓸 수 있다. 하루 코스는 많아야 10곳 남짓이라 넉넉하다.
const WAYPOINTS_PATTERN = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?(\|-?\d+(\.\d+)?,-?\d+(\.\d+)?){0,27}$/

export const router = express.Router()

// 구간마다 외부 API 를 한 번씩 부르므로 한꺼번에 던지지 않고 동시에 이 개수까지만 보낸다.
// (ORS 는 분당 40회 한도라 경유지가 많은 하루를 28구간 동시에 던지면 한 요청만으로도 넘는다.)
const SEGMENT_CONCURRENCY = 4

// 카카오모빌리티 길찾기는 경유지를 5개까지만 받는다(초과하면 "waypoints must be between 0 and 5").
// 그래서 정류장이 7개를 넘으면 앞 묶음의 끝점을 다음 묶음의 시작점으로 겹쳐 7개씩 나눠 요청한다.
const CAR_MAX_POINTS = 7

function chunkRoutePoints(points) {
  const chunks = []
  for (let start = 0; start < points.length - 1; start += CAR_MAX_POINTS - 1) {
    chunks.push(points.slice(start, start + CAR_MAX_POINTS))
  }
  return chunks
}

async function fetchCarRoute(points) {
  const params = new URLSearchParams({ origin: points[0], destination: points.at(-1), priority: 'RECOMMEND' })
  if (points.length > 2) params.set('waypoints', points.slice(1, -1).join('|'))

  let response
  try {
    response = await fetch(`https://apis-navi.kakaomobility.com/v1/directions?${params}`, {
      headers: { Authorization: `KakaoAK ${kakaoRestApiKey}` },
      signal: timeoutSignal(8000),
    })
  } catch {
    throw new Error('카카오 길찾기 서버에 연결하지 못했어요.')
  }

  const data = await response.json().catch(() => null)
  const route = data?.routes?.[0]
  if (!response.ok || !route || route.result_code !== 0) {
    throw new Error(route?.result_msg || data?.msg || '경로를 찾지 못했어요.')
  }
  return route
}

// 자동차 모드 지도 경로용: 카카오모빌리티 길찾기(REST API)를 서버에서 대신 호출한다.
// REST 키를 브라우저에 노출하지 않기 위해 프런트는 이 엔드포인트로만 요청한다.
router.get('/api/directions/car', async (req, res) => {
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

  const points = [origin, ...(waypoints ? waypoints.split('|') : []), destination]
  let routes
  try {
    routes = await Promise.all(chunkRoutePoints(points).map(fetchCarRoute))
  } catch (error) {
    return res.status(502).json({ message: error.message })
  }

  const sections = routes.flatMap((route) => route.sections).map((section) => ({
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

  const total = (key) => routes.reduce((sum, route) => sum + route.summary[key], 0)
  return res.json({ sections, duration: total('duration'), distance: total('distance') })
})

// 대중교통 모드 지도 경로용: ODsay 대중교통 길찾기를 서버에서 대신 호출한다.
// 자동차와 달리 ODsay 는 경유지를 못 받아서, 구간(정류장 i -> i+1)마다 따로 조회해 합친다.
// 경로가 없는 구간(지방 시골 등)은 sections 에 null 로 담아 프런트가 직선+추정으로 폴백하게 한다.
router.get('/api/directions/transit', async (req, res) => {
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
    const sections = await mapLimit(points.slice(0, -1), SEGMENT_CONCURRENCY, (from, index) =>
      searchTransitPath(from, points[index + 1]).catch(() => null),
    )
    const totalMinutes = sections.reduce((sum, section) => sum + (section?.totalMinutes || 0), 0)
    return res.json({ sections, totalMinutes })
  } catch (error) {
    console.error('[directions/transit]', error)
    return res.status(502).json({ message: publicMessage(error, '대중교통 경로를 가져오지 못했어요.') })
  }
})

// 도보 모드 지도 경로용: OpenRouteService 보행자 경로안내를 서버에서 대신 호출한다.
// ODsay 처럼 경유지를 한 번에 못 받아서 구간(정류장 i -> i+1)마다 따로 조회해 합친다.
// 경로가 없는 구간은 sections 에 null 로 담아 프런트가 직선+추정으로 폴백하게 한다.
router.get('/api/directions/walk', async (req, res) => {
  if (!process.env.ORS_API_KEY) {
    return res.status(503).json({ message: '서버에 ORS_API_KEY가 설정되지 않았어요.' })
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
    const sections = await mapLimit(points.slice(0, -1), SEGMENT_CONCURRENCY, (from, index) =>
      searchWalkPath(from, points[index + 1]).catch(() => null),
    )
    const totalMinutes = sections.reduce((sum, section) => sum + (section?.totalMinutes || 0), 0)
    return res.json({ sections, totalMinutes })
  } catch (error) {
    console.error('[directions/walk]', error)
    return res.status(502).json({ message: publicMessage(error, '도보 경로를 가져오지 못했어요.') })
  }
})
