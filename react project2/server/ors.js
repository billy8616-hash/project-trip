// ─────────────────────────────────────────────────────────────
// server/ors.js — OpenRouteService 보행자 경로
//
// 도보 모드에서 "실제 인도를 따라가는" 경로를 받아 온다.
//
// 원래는 Tmap을 썼는데 Tmap 쪽 API 자체 문제로 더 이상 못 쓰게 돼서, OSM 데이터 기반의
// OpenRouteService(보행자 전용 프로필 제공, 이메일 가입만으로 무료 키 발급)로 교체했다.
//
// 하루 2,000회 · 분당 40회 무료 한도가 있어 Tmap 때와 같은 방식의 메모리 캐시를 둔다.
// ─────────────────────────────────────────────────────────────

const orsApiKey = process.env.ORS_API_KEY

// 하루 무료 호출 한도가 있어서, 같은 구간을 다시 그릴 때(새로고침, 교통편 토글 왕복 등) 재호출하지 않는다.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500
const routeCache = new Map() // cacheKey -> { route, cachedAt }

// 좌표를 소수점 4자리(약 11m)로 끊어 캐시 키를 만든다. 지도에서 미세하게 흔들린 좌표를 같은 구간으로 본다.
function cacheKey(from, to) {
  const round = (value) => Number(value).toFixed(4)
  return `${round(from.lat)},${round(from.lng)}->${round(to.lat)},${round(to.lng)}`
}

// ORS 응답은 GeoJSON Feature 하나(LineString). 좌표열과 총 거리·시간(properties.summary)을 뽑는다.
function normalizeFeature(feature) {
  const coords = feature?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null

  const path = coords.map(([lng, lat]) => ({ lat, lng }))
  const summary = feature.properties?.summary || {}
  const totalDistance = typeof summary.distance === 'number' ? summary.distance : 0
  const totalTime = typeof summary.duration === 'number' ? summary.duration : 0
  return { path, totalDistance, totalMinutes: Math.max(1, Math.round(totalTime / 60)) }
}

// 두 좌표 사이의 보행자 경로 하나. 경로를 못 찾거나(너무 가까움 등) ORS가 에러를 주면 null 을 돌려주고,
// 호출한 쪽이 직선+추정 경로로 폴백하게 한다.
export async function searchWalkPath(from, to) {
  if (!orsApiKey) throw new Error('ORS_API_KEY가 설정되지 않았어요.')

  const key = cacheKey(from, to)
  const cached = routeCache.get(key)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.route

  let response
  try {
    // HeiGIT(ORS 운영 기관) 권고에 따라 예전 api.openrouteservice.org 대신 api.heigit.org를 쓴다.
    // /geojson 엔드포인트는 Accept 를 application/geo+json 으로 안 주면 406(형식 미지원)을 준다.
    response = await fetch('https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson', {
      method: 'POST',
      headers: {
        Authorization: orsApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json; charset=utf-8',
      },
      body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }),
    })
  } catch {
    throw new Error('OpenRouteService 보행자 경로 서버에 연결하지 못했어요.')
  }

  const data = await response.json().catch(() => null)
  // 출발/도착이 너무 가깝거나 보행자 경로가 없는 지역이면 에러 응답을 준다 — 전부 "경로 없음"으로 본다.
  const route = response.ok && data?.features?.[0] ? normalizeFeature(data.features[0]) : null

  if (routeCache.size >= CACHE_MAX_ENTRIES) routeCache.clear()
  routeCache.set(key, { route, cachedAt: Date.now() })
  return route
}
