// ─────────────────────────────────────────────────────────────
// server/tmap.js — Tmap 보행자 경로
//
// 도보 모드에서 "실제 인도를 따라가는" 경로를 받아 온다.
//
// 이 API 를 붙이기 전에는 도보 모드가 직선 경로를 그렸는데, 그 모양이 대중교통
// API 실패 시의 대체 경로와 똑같아서 두 모드가 구별되지 않았다. 그 문제를 해결한 파일이다.
//
// ODsay 와 마찬가지로 무료 한도가 있어 같은 방식의 메모리 캐시를 둔다.
// ─────────────────────────────────────────────────────────────

// Tmap(SK 오픈API) 보행자 경로안내 — 도보 모드 지도 경로에 쓴다.
// ODsay(대중교통)·카카오모빌리티(자차)와 달리 실제 "인도를 따라가는" 좌표열을 준다.
const tmapApiKey = process.env.TMAP_API_KEY

// 하루 무료 호출 한도가 있어서, 같은 구간을 다시 그릴 때(새로고침, 교통편 토글 왕복 등) 재호출하지 않는다.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500
const routeCache = new Map() // cacheKey -> { route, cachedAt }

// 좌표를 소수점 4자리(약 11m)로 끊어 캐시 키를 만든다. 지도에서 미세하게 흔들린 좌표를 같은 구간으로 본다.
function cacheKey(from, to) {
  const round = (value) => Number(value).toFixed(4)
  return `${round(from.lat)},${round(from.lng)}->${round(to.lat)},${round(to.lng)}`
}

// Tmap 응답은 GeoJSON FeatureCollection. LineString 조각들을 이어 붙여 전체 경로 좌표열을 만들고,
// 총 거리/시간은 각 조각의 properties(totalDistance/totalTime, 보통 첫 Point 조각에 있다)에서 뽑는다.
function normalizeFeatures(features) {
  const path = []
  let totalDistance = 0
  let totalTime = 0
  for (const feature of features) {
    const props = feature.properties || {}
    if (typeof props.totalDistance === 'number') totalDistance = props.totalDistance
    if (typeof props.totalTime === 'number') totalTime = props.totalTime

    const geom = feature.geometry
    if (geom?.type === 'LineString') {
      for (const [lng, lat] of geom.coordinates) path.push({ lat, lng })
    } else if (geom?.type === 'Point' && path.length === 0) {
      const [lng, lat] = geom.coordinates
      path.push({ lat, lng })
    }
  }
  if (path.length < 2) return null
  return { path, totalDistance, totalMinutes: Math.max(1, Math.round(totalTime / 60)) }
}

// 두 좌표 사이의 보행자 경로 하나. 경로를 못 찾거나(너무 가까움 등) Tmap이 에러를 주면 null 을 돌려주고,
// 호출한 쪽이 직선+추정 경로로 폴백하게 한다.
export async function searchWalkPath(from, to) {
  if (!tmapApiKey) throw new Error('TMAP_API_KEY가 설정되지 않았어요.')

  const key = cacheKey(from, to)
  const cached = routeCache.get(key)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.route

  let response
  try {
    response = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1', {
      method: 'POST',
      headers: { appKey: tmapApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        startX: String(from.lng),
        startY: String(from.lat),
        endX: String(to.lng),
        endY: String(to.lat),
        startName: encodeURIComponent('출발'),
        endName: encodeURIComponent('도착'),
        reqCoordType: 'WGS84GEO',
        resCoordType: 'WGS84GEO',
        searchOption: '0', // 0 = 추천 경로
      }),
    })
  } catch {
    throw new Error('Tmap 보행자 경로 서버에 연결하지 못했어요.')
  }

  const data = await response.json().catch(() => null)
  // 출발/도착이 너무 가깝거나 보행자 경로가 없는 지역이면 error 필드를 준다 — 전부 "경로 없음"으로 본다.
  const route = data?.features ? normalizeFeatures(data.features) : null

  if (routeCache.size >= CACHE_MAX_ENTRIES) routeCache.clear()
  routeCache.set(key, { route, cachedAt: Date.now() })
  return route
}
