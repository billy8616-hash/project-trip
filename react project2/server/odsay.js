const odsayApiKey = process.env.ODSAY_API_KEY

// ODsay subPath.trafficType: 1=지하철, 2=버스, 3=도보.
const TRAFFIC_TYPE = { SUBWAY: 1, BUS: 2, WALK: 3 }

// 하루 1,000회 무료 한도라 같은 구간을 다시 그릴 때(새로고침, 교통편 토글 왕복 등) 재호출하지 않는다.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500
const routeCache = new Map() // cacheKey -> { route, cachedAt }

// 좌표를 소수점 4자리(약 11m)로 끊어 캐시 키를 만든다. 지도에서 미세하게 흔들린 좌표를 같은 구간으로 본다.
function cacheKey(from, to) {
  const round = (value) => Number(value).toFixed(4)
  return `${round(from.lat)},${round(from.lng)}->${round(to.lat)},${round(to.lng)}`
}

// "수도권 2호선" -> "2호선". 지도 배지에 넣기엔 접두사가 길다.
function laneLabel(subPath) {
  const lane = subPath.lane?.[0]
  if (!lane) return null
  if (subPath.trafficType === TRAFFIC_TYPE.BUS) {
    return lane.busNo ? `${lane.busNo}번` : '버스'
  }
  return String(lane.name || '지하철').replace(/^수도권\s+/, '')
}

// 도보 구간은 정류장 목록이 없어서, 앞뒤 구간 사이가 직선으로 이어진다 (지도에서 짧게 튀는 정도라 괜찮다).
function toPathCoords(subPaths, from, to) {
  const coords = [{ lat: from.lat, lng: from.lng }]
  for (const subPath of subPaths) {
    for (const station of subPath.passStopList?.stations || []) {
      const lat = Number(station.y)
      const lng = Number(station.x)
      if (Number.isFinite(lat) && Number.isFinite(lng)) coords.push({ lat, lng })
    }
  }
  coords.push({ lat: to.lat, lng: to.lng })
  return coords
}

function normalizePath(path, from, to) {
  // 도보만으로 된 구간은 "대중교통 경로"라 부를 게 없으니 폴백(직선+추정)에 맡긴다.
  const rideSubPaths = path.subPath.filter((subPath) => subPath.trafficType !== TRAFFIC_TYPE.WALK)
  if (rideSubPaths.length === 0) return null

  const legs = path.subPath
    .filter((subPath) => subPath.sectionTime > 0)
    .map((subPath) => ({
      mode: subPath.trafficType === TRAFFIC_TYPE.SUBWAY ? 'subway' : subPath.trafficType === TRAFFIC_TYPE.BUS ? 'bus' : 'walk',
      name: laneLabel(subPath) || '도보',
      minutes: subPath.sectionTime,
      from: subPath.startName || null,
      to: subPath.endName || null,
    }))

  return {
    totalMinutes: path.info.totalTime,
    transfers: (path.info.busTransitCount || 0) + (path.info.subwayTransitCount || 0) - 1,
    // 지도 배지용 짧은 요약. 예: "2호선 → 3호선"
    summary: rideSubPaths.map(laneLabel).filter(Boolean).join(' → '),
    legs,
    path: toPathCoords(path.subPath, from, to),
  }
}

// 두 좌표 사이의 대중교통 경로 하나. 경로가 없거나 ODsay가 에러를 주면 null 을 돌려주고,
// 호출한 쪽이 직선+추정 경로로 폴백하게 한다.
export async function searchTransitPath(from, to) {
  if (!odsayApiKey) throw new Error('ODSAY_API_KEY가 설정되지 않았어요.')

  const key = cacheKey(from, to)
  const cached = routeCache.get(key)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.route

  const params = new URLSearchParams({
    apiKey: odsayApiKey,
    SX: String(from.lng),
    SY: String(from.lat),
    EX: String(to.lng),
    EY: String(to.lat),
  })

  const response = await fetch(`https://api.odsay.com/v1/api/searchPubTransPathT?${params}`)
  const data = await response.json().catch(() => null)

  // ODsay 는 "출발지와 도착지가 너무 가까움", "주변에 정류장 없음" 등도 error 로 준다. 전부 경로 없음으로 본다.
  const best = data?.result?.path?.[0]
  const route = best ? normalizePath(best, from, to) : null

  if (routeCache.size >= CACHE_MAX_ENTRIES) routeCache.clear()
  routeCache.set(key, { route, cachedAt: Date.now() })
  return route
}
