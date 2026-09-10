import { matchesCityRegion } from './cityRegion.js'
import { timeoutSignal } from './concurrency.js'
import { slotsForKakaoPlace } from './placeSlots.js'

const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY

// 맛집/카페 키워드 검색 (카카오 로컬). category_group_code: FD6=음식점, CE7=카페.
async function searchKeyword(query, categoryGroupCode) {
  if (!kakaoRestApiKey) throw new Error('KAKAO_REST_API_KEY가 설정되지 않았어요.')

  const params = new URLSearchParams({
    query,
    category_group_code: categoryGroupCode,
    size: '15',
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

  return data.documents || []
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

export async function searchRestaurants(cityName) {
  const documents = await searchKeyword(`${cityName} 맛집`, 'FD6')
  return documents
    .filter((doc) => isInCity(doc, cityName))
    .map((doc) => toKakaoPlace(doc, 'FD6'))
}

export async function searchCafes(cityName) {
  const documents = await searchKeyword(`${cityName} 카페`, 'CE7')
  return documents
    .filter((doc) => isInCity(doc, cityName))
    .map((doc) => toKakaoPlace(doc, 'CE7'))
}
