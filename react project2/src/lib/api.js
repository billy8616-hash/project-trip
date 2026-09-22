// ─────────────────────────────────────────────────────────────
// lib/api.js — 로그인이 필요 없는 백엔드 호출 모음
//
// 외부 API 키는 전부 서버에만 있다. 브라우저는 여기 있는 함수로 우리 서버를
// 부르고, 서버가 대신 TourAPI·카카오·ODsay·Tmap·OpenWeather 를 호출한다.
// (로그인이 필요한 호출은 apiClient.js → tripsApi/communityApi/profileApi)
//
// 담당 영역
//   장소 풀·썸네일·트렌드    fetchCityPool · fetchCityThumbnails · fetchCityTrends
//   날씨                     fetchWeather · fetchWeatherForecast
//   위치                     fetchGeocode · fetchNearbyParking
//   길찾기(교통 모드별 3종)  fetchCarRoute · fetchTransitRoute · fetchWalkRoute
//
// 응답 처리 방식이 전부 같다 — fetch → json → 필요한 필드가 없으면 에러를 던진다.
// 화면 쪽은 try/catch 한 번으로 "이 기능만 빠진 상태"를 표시하면 된다.
// ─────────────────────────────────────────────────────────────

// 프런트엔드가 쓰는 백엔드 엔드포인트 모음.
// 비워두면 같은 오리진(/api)으로 요청하고 Vite 프록시가 백엔드로 전달한다.
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

// 서버가 내려주는 이미지 주소는 두 종류다.
//  · 절대 URL      (TourAPI 사진) -> 그대로 쓴다
//  · "/api/..." 경로 (Google 사진 프록시) -> 백엔드를 따로 띄웠다면 그 오리진을 붙여 줘야 한다
export function resolveImageUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  return url.startsWith('/') ? `${apiBaseUrl}${url}` : url
}

// 도시별 장소 풀. TourAPI(관광지/문화시설/야경) + 카카오 로컬(맛집/카페) + Gemini(추천이유/주의사항/테마)를
// 서버가 모아서 { title, subtitle, center, pool } 모양으로 내려준다. (server/app.js 참고)
export async function fetchCityPool(cityName) {
  const response = await fetch(`${apiBaseUrl}/api/course-pool?city=${encodeURIComponent(cityName)}`, {
    credentials: 'include',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.pool) throw new Error(data?.message || '여행지 정보를 가져오지 못했어요.')
  return data
}

// 여행지 카드 썸네일용 대표 사진 (한국관광공사 TourAPI, server/tourApi.js 경유).
export async function fetchCityThumbnails(cityNames) {
  const params = new URLSearchParams({ cities: cityNames.join(',') })
  const response = await fetch(`${apiBaseUrl}/api/city-thumbnails?${params}`, { credentials: 'include' })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.thumbnails) throw new Error(data?.message || '여행지 사진을 가져오지 못했어요.')
  return data.thumbnails
}

// 여행지 카드 "지금 뜨는 중" 배지용 검색 트렌드 (네이버 데이터랩, server/naverTrend.js 경유).
export async function fetchCityTrends(cityNames) {
  const params = new URLSearchParams({ cities: cityNames.join(',') })
  const response = await fetch(`${apiBaseUrl}/api/city-trends?${params}`, { credentials: 'include' })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.trends) throw new Error(data?.message || '여행지 트렌드를 가져오지 못했어요.')
  return data.trends
}

// 코스 화면 상단에 보여줄 현재 날씨 (OpenWeatherMap, server/weather.js 경유).
export async function fetchWeather(lat, lng) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
  const response = await fetch(`${apiBaseUrl}/api/weather?${params}`, { credentials: 'include' })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.description) throw new Error(data?.message || '날씨 정보를 가져오지 못했어요.')
  return data
}

// 날짜 선택 화면에서 여행 기간 전체의 날씨 예보를 보여줄 때 쓴다 (OpenWeatherMap 5일 예보).
export async function fetchWeatherForecast(lat, lng, startDate, endDate) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), start: startDate, end: endDate })
  const response = await fetch(`${apiBaseUrl}/api/weather/forecast?${params}`, { credentials: 'include' })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.days) throw new Error(data?.message || '날씨 예보를 가져오지 못했어요.')
  return data.days
}

// 코스 화면에서 선택한 관광지 주변 주차장 목록 (카카오 로컬 카테고리 검색 PK6, server 경유).
export async function fetchNearbyParking(lat, lng, radius = 700) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(radius) })
  const response = await fetch(`${apiBaseUrl}/api/parking?${params}`, { credentials: 'include' })
  const data = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(data?.items)) {
    throw new Error(data?.message || '주차장 정보를 가져오지 못했어요.')
  }
  return data.items
}

// 숙소 이름 자동완성 후보 (카카오 로컬 숙박 검색, server 경유).
// center 를 주면 그 좌표 주변을 먼저 찾는다. signal 로 이전 요청을 취소할 수 있다 —
// 타이핑 중에는 요청이 겹치는데, 늦게 도착한 옛 응답이 새 결과를 덮어쓰면 안 되기 때문이다.
export async function fetchLodgingSuggestions(query, center, { signal } = {}) {
  const trimmed = String(query || '').trim()
  if (trimmed.length < 2) return []

  const params = new URLSearchParams({ query: trimmed })
  if (Number.isFinite(center?.lat) && Number.isFinite(center?.lng)) {
    params.set('lat', String(center.lat))
    params.set('lng', String(center.lng))
  }

  const response = await fetch(`${apiBaseUrl}/api/lodging?${params}`, { credentials: 'include', signal })
  const data = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(data?.items)) return []
  return data.items
}

// 출발지·숙소 자유 입력 텍스트를 좌표로 바꾼다 (카카오 로컬 주소/키워드 검색, server 경유).
export async function fetchGeocode(query) {
  const params = new URLSearchParams({ query })
  const response = await fetch(`${apiBaseUrl}/api/geocode?${params}`, { credentials: 'include' })
  const data = await response.json().catch(() => null)
  if (!response.ok || !Number.isFinite(data?.lat) || !Number.isFinite(data?.lng)) {
    throw new Error(data?.message || '위치를 찾지 못했어요.')
  }
  return { label: data.label || query, lat: data.lat, lng: data.lng }
}

// 경유지를 포함한 좌표 목록을 origin/waypoints/destination 쿼리로 바꾼다.
// 길찾기 3종(자차·대중교통·도보)이 모두 같은 쿼리 형식을 쓰므로 여기서 한 번만 만든다.
function routeParams(routePlaces) {
  const toCoord = (place) => `${place.location.lng},${place.location.lat}`
  const params = new URLSearchParams({
    origin: toCoord(routePlaces[0]),
    destination: toCoord(routePlaces.at(-1)),
  })
  const waypoints = routePlaces.slice(1, -1).map(toCoord).join('|')
  if (waypoints) params.set('waypoints', waypoints)
  return params
}

// 자동차 모드일 때 카카오모빌리티 길찾기(REST API, 서버 경유)로 실제 도로 경로를 가져온다.
export async function fetchCarRoute(routePlaces) {
  const response = await fetch(`${apiBaseUrl}/api/directions/car?${routeParams(routePlaces)}`, {
    credentials: 'include',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.sections) throw new Error(data?.message || '경로를 불러오지 못했어요.')
  return data
}

// 대중교통 모드일 때 ODsay 대중교통 길찾기(서버 경유)로 실제 지하철/버스 노선을 따라가는 경로를 가져온다.
// sections[i] 가 null 이면 그 구간은 대중교통으로 갈 방법이 없다는 뜻이라, 호출한 쪽에서 직선+추정으로 그린다.
export async function fetchTransitRoute(routePlaces) {
  const response = await fetch(`${apiBaseUrl}/api/directions/transit?${routeParams(routePlaces)}`, {
    credentials: 'include',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.sections) throw new Error(data?.message || '대중교통 경로를 불러오지 못했어요.')
  return data
}

// 도보 모드일 때 Tmap 보행자 경로안내(서버 경유)로 실제 인도를 따라가는 경로를 가져온다.
// sections[i] 가 null 이면 그 구간은 보행자 경로를 못 찾았다는 뜻이라, 호출한 쪽에서 직선+추정으로 그린다.
export async function fetchWalkRoute(routePlaces) {
  const response = await fetch(`${apiBaseUrl}/api/directions/walk?${routeParams(routePlaces)}`, {
    credentials: 'include',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.sections) throw new Error(data?.message || '도보 경로를 불러오지 못했어요.')
  return data
}
