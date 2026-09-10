// 프런트엔드가 쓰는 백엔드 엔드포인트 모음.
// 비워두면 같은 오리진(/api)으로 요청하고 Vite 프록시가 백엔드로 전달한다.
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

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
