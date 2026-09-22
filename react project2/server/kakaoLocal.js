// ─────────────────────────────────────────────────────────────
// server/kakaoLocal.js — 카카오 로컬 (맛집·카페 + 주소→좌표 변환)
//
// TourAPI 에 없는 것이 음식점과 카페라서, 그 두 가지를 여기서 채운다.
// 코스의 "점심 맛집"·"오후 카페" 칸을 채우는 장소가 대부분 이 API 에서 온다.
//
// 실측으로 알아낸 제약이 파일 앞부분에 적혀 있다 — 검색어 하나로는 45건이
// 천장이고 그 이상은 검색어 자체를 바꿔야 한다. 그래서 여러 키워드로 나눠 검색한다.
//
// 사용자가 입력한 출발지·숙소를 좌표로 바꾸는 지오코딩도 이 API 를 쓴다.
// ─────────────────────────────────────────────────────────────

import { matchesCityRegion } from './cityRegion.js'
import { mapLimit, timeoutSignal } from './concurrency.js'
import { slotsForKakaoPlace } from './placeSlots.js'

const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY

// 카카오 로컬 키워드 검색의 페이지 제약 (실측):
// - size 는 최대 15 (45 를 넣으면 400 Request validation is failed)
// - 검색어 하나당 pageable_count 가 45 로 고정 — 즉 3페이지가 끝이고 그 뒤는 is_end=true.
// 그래서 한 검색어로는 45건이 천장이고, 더 받으려면 검색어 자체를 바꿔야 한다.
const PAGE_SIZE = 15
const MAX_PAGES = 3

// 맛집/카페 키워드 검색 한 페이지. category_group_code: FD6=음식점, CE7=카페.
async function searchKeywordPage(query, categoryGroupCode, page) {
  if (!kakaoRestApiKey) throw new Error('KAKAO_REST_API_KEY가 설정되지 않았어요.')

  const params = new URLSearchParams({
    query,
    category_group_code: categoryGroupCode,
    size: String(PAGE_SIZE),
    page: String(page),
    sort: 'accuracy',
  })

  const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`, {
    headers: { Authorization: `KakaoAK ${kakaoRestApiKey}` },
    signal: timeoutSignal(8000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    throw new Error(data?.message || '카카오 로컬 검색에 실패했어요.')
  }

  return { documents: data.documents || [], isEnd: Boolean(data.meta?.is_end) }
}

// 검색어 하나를 끝까지(최대 45건) 훑는다. 페이지는 순서대로 — 앞 페이지가 끝이면 더 안 부른다.
async function searchKeyword(query, categoryGroupCode) {
  const collected = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { documents, isEnd } = await searchKeywordPage(query, categoryGroupCode, page)
    collected.push(...documents)
    if (isEnd || documents.length < PAGE_SIZE) break
  }
  return collected
}

// 검색어 여러 개를 돌려 "검색어당 45건" 천장을 넘긴다. 검색어끼리 결과가 많이 겹치므로 id 로 중복 제거한다.
// 검색어 하나가 실패해도 나머지 결과는 살린다 — 장소는 많을수록 좋지만 없으면 코스를 못 짠다.
async function searchKeywordVariants(queries, categoryGroupCode) {
  const results = await mapLimit(queries, 2, (query) =>
    searchKeyword(query, categoryGroupCode).catch((error) => {
      console.warn(`[kakao] "${query}" 검색 실패 — 건너뜁니다: ${error.message}`)
      return []
    }),
  )

  const seen = new Set()
  const merged = []
  for (const documents of results) {
    for (const doc of documents) {
      if (seen.has(doc.id)) continue
      seen.add(doc.id)
      merged.push(doc)
    }
  }
  return merged
}

// 카카오 로컬 키워드 검색도 텍스트 매칭이라 "{도시} 맛집" 검색에 상호명만 도시명을 포함하고
// 실제로는 다른 지역인 결과가 섞여 온다. 주소가 실제로 그 도시 행정구역인지로 걸러낸다.
function isInCity(doc, cityName) {
  return matchesCityRegion(doc.road_address_name || doc.address_name, cityName)
}

// 출발지·숙소 같은 자유 입력 텍스트를 좌표로 바꾼다.
// 주소 검색을 먼저 시도하고(정확), 결과가 없으면 키워드(장소명) 검색으로 넘어간다.
export async function geocodePlace(query) {
  if (!kakaoRestApiKey) throw new Error('KAKAO_REST_API_KEY가 설정되지 않았어요.')
  const trimmed = String(query || '').trim()
  if (!trimmed) throw new Error('검색어가 필요해요.')

  const headers = { Authorization: `KakaoAK ${kakaoRestApiKey}` }

  const addressUrl = `https://dapi.kakao.com/v2/local/search/address.json?${new URLSearchParams({ query: trimmed, size: '5' })}`
  const addressRes = await fetch(addressUrl, { headers, signal: timeoutSignal(8000) })
  const addressData = await addressRes.json().catch(() => null)
  const addressDoc = addressData?.documents?.[0]
  if (addressDoc) {
    return {
      label: addressDoc.address_name || trimmed,
      lat: Number(addressDoc.y),
      lng: Number(addressDoc.x),
    }
  }

  const keywordUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?${new URLSearchParams({ query: trimmed, size: '5', sort: 'accuracy' })}`
  const keywordRes = await fetch(keywordUrl, { headers, signal: timeoutSignal(8000) })
  const keywordData = await keywordRes.json().catch(() => null)
  const keywordDoc = keywordData?.documents?.[0]
  if (keywordDoc) {
    return {
      label: keywordDoc.place_name || trimmed,
      lat: Number(keywordDoc.y),
      lng: Number(keywordDoc.x),
      address: keywordDoc.road_address_name || keywordDoc.address_name || '',
    }
  }

  throw new Error('입력하신 위치를 찾지 못했어요.')
}

// 숙소 이름 자동완성 (카카오 로컬 키워드 검색). category_group_code AD5 = 숙박.
//
// geocodePlace 와 달리 후보를 "여러 개" 돌려준다 — 사용자가 호텔 이름을 정확히 몰라도
// 목록에서 고를 수 있게 하려는 것이다. 고른 시점에 좌표가 이미 손에 들어오므로
// 나중에 다시 지오코딩할 필요도 없다.
//
// 여행지 좌표(lat·lng)를 주면 그 주변으로 먼저 찾는다. "신라"처럼 전국에 같은 이름이
// 흔한 검색어에서 엉뚱한 지역 숙소가 올라오는 것을 막기 위해서다.
// 주변에서 못 찾으면 지역 제한 없이 한 번 더 찾는다 — 근처 도시에 잡은 숙소일 수도 있다.
export async function searchLodging(query, { lat, lng, limit = 6 } = {}) {
  if (!kakaoRestApiKey) throw new Error('KAKAO_REST_API_KEY가 설정되지 않았어요.')
  const trimmed = String(query || '').trim()
  if (!trimmed) return []

  const size = String(Math.min(Math.max(Math.round(limit) || 6, 1), 15))
  const headers = { Authorization: `KakaoAK ${kakaoRestApiKey}` }

  const run = async (extra) => {
    const params = new URLSearchParams({
      query: trimmed,
      category_group_code: 'AD5',
      size,
      sort: 'accuracy',
      ...extra,
    })
    const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`, {
      headers,
      signal: timeoutSignal(8000),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data) throw new Error(data?.message || '숙소 검색에 실패했어요.')
    return data.documents || []
  }

  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng)
  // 카카오 키워드 검색의 radius 상한은 20km 다.
  let documents = hasCenter ? await run({ x: String(lng), y: String(lat), radius: '20000' }) : []
  if (documents.length === 0) documents = await run({})

  return documents.map((doc) => ({
    id: `kakao-${doc.id}`,
    name: doc.place_name,
    address: doc.road_address_name || doc.address_name || '',
    lat: Number(doc.y),
    lng: Number(doc.x),
    category: doc.category_name || '',
    url: doc.place_url || '',
  }))
}

function toKakaoPlace(doc, groupCode) {
  const slots = slotsForKakaoPlace({ categoryName: doc.category_name, groupCode })
  return {
    id: `kakao-${doc.id}`,
    source: 'kakao',
    name: doc.place_name,
    address: doc.road_address_name || doc.address_name,
    lat: Number(doc.y),
    lng: Number(doc.x),
    category: doc.category_name,
    slots, // 어울리는 시간대(여러 개 가능). slot(단수)은 대표값.
    slot: slots[0],
  }
}

// 좌표 주변 주차장 (카카오 로컬 카테고리 검색). category_group_code PK6 = 주차장.
// 반경 안에서 가까운 순으로 정리해 상위 몇 곳만 돌려준다. 요금·만차 여부는 이 API 에 없다.
const parkingCache = new Map() // "lat,lng,radius" -> { items, cachedAt }
const PARKING_TTL_MS = 24 * 60 * 60 * 1000

export async function searchParkingNear(lat, lng, radius = 700, limit = 3) {
  if (!kakaoRestApiKey) throw new Error('KAKAO_REST_API_KEY가 설정되지 않았어요.')
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('lat, lng가 필요해요.')

  // 카카오 category 검색 radius 는 0~20000m.
  const safeRadius = Math.min(Math.max(Math.round(radius) || 700, 100), 20000)
  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${safeRadius}`
  const cached = parkingCache.get(key)
  if (cached && Date.now() - cached.cachedAt < PARKING_TTL_MS) return cached.items.slice(0, limit)

  const params = new URLSearchParams({
    category_group_code: 'PK6',
    x: String(lng),
    y: String(lat),
    radius: String(safeRadius),
    sort: 'distance',
    size: '15',
  })
  const response = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
    headers: { Authorization: `KakaoAK ${kakaoRestApiKey}` },
    signal: timeoutSignal(8000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    throw new Error(data?.message || '주차장 검색에 실패했어요.')
  }

  const items = (data.documents || []).map((doc) => ({
    id: `kakao-${doc.id}`,
    name: doc.place_name,
    address: doc.road_address_name || doc.address_name || '',
    lat: Number(doc.y),
    lng: Number(doc.x),
    distanceM: Number(doc.distance) || null,
    url: doc.place_url || '',
  }))
  parkingCache.set(key, { items, cachedAt: Date.now() })
  return items.slice(0, limit)
}

// 검색어를 나눠 던지는 이유: "{도시} 맛집" 하나로는 45건이 천장인데, 그중 상당수가
// 주소 필터(isInCity)에서 떨어져 나가 실제로 쓸 수 있는 건 훨씬 적다.
// 결이 다른 검색어를 섞으면 겹치는 결과를 빼고도 후보가 눈에 띄게 늘어난다.
const RESTAURANT_QUERIES = (city) => [`${city} 맛집`, `${city} 현지인 맛집`, `${city} 한식`, `${city} 저녁 맛집`]
const CAFE_QUERIES = (city) => [`${city} 카페`, `${city} 디저트`, `${city} 베이커리`, `${city} 분위기 좋은 카페`]

export async function searchRestaurants(cityName) {
  const documents = await searchKeywordVariants(RESTAURANT_QUERIES(cityName), 'FD6')
  return documents
    .filter((doc) => isInCity(doc, cityName))
    .map((doc) => toKakaoPlace(doc, 'FD6'))
}

export async function searchCafes(cityName) {
  const documents = await searchKeywordVariants(CAFE_QUERIES(cityName), 'CE7')
  return documents
    .filter((doc) => isInCity(doc, cityName))
    .map((doc) => toKakaoPlace(doc, 'CE7'))
}
