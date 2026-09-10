import { mapLimit, timeoutSignal } from './concurrency.js'

const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY

// 좌표에서 이 반경(m) 안에 지하철역이 없으면 "대중교통으로는 사실상 접근 불가"로 본다.
const SEARCH_RADIUS_M = 2000

// 좌표에서 가장 가까운 지하철역 (카카오 로컬 카테고리 검색, SW8 = 지하철역).
// x,y 를 주면 카카오가 응답에 거리(m)를 넣어주므로 별도 거리 계산이 필요 없다.
async function nearestStation({ lat, lng }) {
  if (!kakaoRestApiKey) throw new Error('KAKAO_REST_API_KEY가 설정되지 않았어요.')
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const params = new URLSearchParams({
    category_group_code: 'SW8',
    x: String(lng),
    y: String(lat),
    radius: String(SEARCH_RADIUS_M),
    sort: 'distance',
    size: '1',
  })

  const response = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
    headers: { Authorization: `KakaoAK ${kakaoRestApiKey}` },
    signal: timeoutSignal(4000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) return null

  const doc = data.documents?.[0]
  if (!doc) return null
  return { name: doc.place_name, distanceM: Number(doc.distance) }
}

// 최근접 지하철역 거리로 대중교통 접근성 등급을 매긴다 (도보 속도 약 67m/분 기준).
// good: 도보 6분 이내 / ok: 도보 13분 이내 / far: 반경 내 있지만 멂 / none: 반경 내 지하철역 없음
export function transitScoreFromDistance(distanceM) {
  if (!Number.isFinite(distanceM)) return 'none'
  if (distanceM <= 400) return 'good'
  if (distanceM <= 900) return 'ok'
  return 'far'
}

const NO_TRANSIT = { transitStation: null, transitDistanceM: null, transitScore: 'none' }

export async function fetchTransitAccess(place) {
  const station = await nearestStation(place).catch(() => null)
  if (!station || !Number.isFinite(station.distanceM)) return NO_TRANSIT
  return {
    transitStation: station.name,
    transitDistanceM: Math.round(station.distanceM),
    transitScore: transitScoreFromDistance(station.distanceM),
  }
}

// 여러 장소의 대중교통 접근성을 조회한다. 동시 10개까지만.
export async function fetchTransitAccessMany(places) {
  const entries = await mapLimit(places, 10, async (place) => [place.id, await fetchTransitAccess(place)])
  return new Map(entries)
}
