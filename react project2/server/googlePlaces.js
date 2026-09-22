// ─────────────────────────────────────────────────────────────
// server/googlePlaces.js — Google Places (음식점·카페의 영업시간·사진)
//
// 카카오 로컬은 영업시간을 주지 않는다. 그런데 이 앱은 "도착 시각에 문이 열려 있는가"를
// 따지기 때문에 영업시간이 없으면 맛집·카페만 판정에서 빠지게 된다. 그 구멍을 메우는 API 다.
//
// 없어도 되는 API 다 — 키가 없으면 조용히 비활성화되고, 맛집·카페가 영업시간·사진 없이 나온다.
//
// 사진 처리에 주의가 필요하다. Google 사진 주소는 API 키가 있어야 열리는데,
// 키를 브라우저로 내보낼 수는 없다. 그래서 사진 "리소스 이름"만 저장해 두고,
// 서버의 /api/place-photo 가 실제 주소를 받아 리다이렉트한다.
// 그때 서버가 아무 URL 이나 요청하지 않도록 형식 검사(PHOTO_REF_PATTERN)를 거친다.
// ─────────────────────────────────────────────────────────────

// 카카오 로컬 API 에는 영업시간이 없어서, 음식점·카페는 Google Places API (New) 로 채운다.
// places:searchText 한 번에 이름+위치로 검색하고 regularOpeningHours 를 바로 받아온다(별도 상세조회 불필요).
// 키가 없으면 조용히 비활성 — 그 경우 카카오 장소는 예전처럼 영업시간 없이 나온다.
import { mapLimit, timeoutSignal } from './concurrency.js'
import { costTierFromPriceLevel } from './costTier.js'

const apiKey = process.env.GOOGLE_PLACES_API_KEY
const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const PHOTO_BASE_URL = 'https://places.googleapis.com/v1'

// Google 사진 리소스 이름: "places/<place_id>/photos/<photo_id>".
// 이 값을 그대로 브라우저에 주면 API 키가 필요해 노출되므로, 서버 프록시(/api/place-photo)를 거친다.
const PHOTO_REF_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/

export function isPhotoRef(value) {
  return PHOTO_REF_PATTERN.test(String(value || ''))
}

// 사진 리소스 이름 -> 프런트가 <img src> 로 쓸 수 있는 우리 서버 경로.
export function googlePhotoPath(photoRef) {
  if (!isPhotoRef(photoRef)) return null
  return `/api/place-photo?ref=${encodeURIComponent(photoRef)}`
}

// 실제 이미지 주소는 서명이 붙어 있고 한 시간쯤 뒤 만료된다. DB 에 넣어 두면 금방 깨지니
// 요청이 올 때마다 새로 받아 오되, 만료 전까지는 메모리에 재사용한다.
const photoUriCache = new Map() // `${ref}|${maxWidth}` -> { uri, cachedAt }
const PHOTO_URI_TTL_MS = 45 * 60 * 1000

// 사진 리소스 이름 -> googleusercontent 실제 이미지 주소 | null
export async function resolveGooglePhotoUri(photoRef, maxWidth = 320) {
  if (!apiKey || !isPhotoRef(photoRef)) return null

  const cacheKey = `${photoRef}|${maxWidth}`
  const cached = photoUriCache.get(cacheKey)
  if (cached && Date.now() - cached.cachedAt < PHOTO_URI_TTL_MS) return cached.uri

  const params = new URLSearchParams({
    maxWidthPx: String(maxWidth),
    skipHttpRedirect: 'true', // 이미지 바이트 대신 주소(JSON)만 받아서 브라우저로 리다이렉트한다.
    key: apiKey,
  })

  let response
  try {
    response = await fetch(`${PHOTO_BASE_URL}/${photoRef}/media?${params}`, { signal: timeoutSignal(4000) })
  } catch {
    return null
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.photoUri) return null

  photoUriCache.set(cacheKey, { uri: data.photoUri, cachedAt: Date.now() })
  return data.photoUri
}

// priceLevel -> 사용자에게 보여줄 짧은 문구 (Google 은 금액 텍스트를 주지 않는다).
const PRICE_LEVEL_TEXT = {
  PRICE_LEVEL_FREE: '무료',
  PRICE_LEVEL_INEXPENSIVE: '저렴한 편',
  PRICE_LEVEL_MODERATE: '보통',
  PRICE_LEVEL_EXPENSIVE: '비싼 편',
  PRICE_LEVEL_VERY_EXPENSIVE: '많이 비싼 편',
}

// Google 의 요일 번호(0=일요일)를 한글 요일로. JS Date.getDay() 와 같은 규칙이라 프런트 isClosedOnDate 와 그대로 맞는다.
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

// regularOpeningHours -> 우리 스키마 필드로 변환.
// { openHoursText, closedDayText, opensAt, closesAt, alwaysOpen, closedWeekdays }
export function parseGoogleHours(regularOpeningHours) {
  const roh = regularOpeningHours || {}
  const periods = Array.isArray(roh.periods) ? roh.periods : []
  const descriptions = Array.isArray(roh.weekdayDescriptions) ? roh.weekdayDescriptions : []

  const openHoursText = descriptions.join('\n') || null

  // 24시간 영업: close 가 없는 단일 구간(자정 시작).
  const alwaysOpen =
    periods.length === 1 &&
    !!periods[0]?.open &&
    !periods[0]?.close &&
    (periods[0].open.hour || 0) === 0 &&
    (periods[0].open.minute || 0) === 0

  // 여는 요일 집합 -> 그 외 요일이 정기 휴무.
  const openDays = new Set(periods.map((period) => period?.open?.day).filter((day) => Number.isInteger(day)))
  const closedWeekdays =
    alwaysOpen || openDays.size === 0
      ? []
      : [0, 1, 2, 3, 4, 5, 6].filter((day) => !openDays.has(day))

  // 대표 여닫이 시각: 시각이 있는 첫 구간 기준(요일마다 다르면 근사치). 자정을 넘기면 1440 이상.
  let opensAt = null
  let closesAt = null
  const firstFull = periods.find((period) => period?.open && period?.close)
  if (firstFull) {
    opensAt = firstFull.open.hour * 60 + (firstFull.open.minute || 0)
    closesAt = firstFull.close.hour * 60 + (firstFull.close.minute || 0)
    if (firstFull.close.day !== firstFull.open.day || closesAt <= opensAt) closesAt += 24 * 60
  }

  // 정기 휴무가 1~2일일 때만 따로 문장으로 뽑는다. 그보다 많으면(주 3일 이상 휴무 등)
  // 요일별 전체 안내(openHoursText)로 충분하고, "매주 X, Y, Z, ... 휴무" 는 오히려 읽기 나쁘다.
  const closedDayText =
    closedWeekdays.length >= 1 && closedWeekdays.length <= 2
      ? `매주 ${closedWeekdays.map((day) => `${WEEKDAY_KO[day]}요일`).join(', ')} 휴무`
      : null

  return { openHoursText, closedDayText, opensAt, closesAt, alwaysOpen, closedWeekdays }
}

// textQuery 한 번을 던져 첫 결과를 받는다. 실패/무응답이면 null.
async function searchTextOnce(textQuery, locationBias) {
  const body = { textQuery, languageCode: 'ko', regionCode: 'KR', maxResultCount: 1 }
  if (locationBias) body.locationBias = locationBias

  let response
  try {
    response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.regularOpeningHours,places.priceLevel,places.photos,' +
          'places.rating,places.userRatingCount,places.editorialSummary,places.websiteUri',
      },
      body: JSON.stringify(body),
      signal: timeoutSignal(4000),
    })
  } catch {
    return null
  }

  const data = await response.json().catch(() => null)
  if (!response.ok || !data) return null
  return data.places?.[0] || null
}

// place: { name, address, lat, lng } -> { ...영업시간, ...가격대, photoRef } | null
// 영업시간·가격대·사진을 searchText 한 번으로 같이 받는다 (필드를 늘려도 호출 수는 그대로다).
export async function fetchGoogleHours(place) {
  if (!apiKey || !place?.name) return null

  const locationBias =
    Number.isFinite(place.lat) && Number.isFinite(place.lng)
      ? // 상호명이 흔하면 엉뚱한 지점이 잡힐 수 있어 좌표 주변으로 검색을 좁힌다.
        { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 400 } }
      : undefined

  const nameQuery = place.name.trim()
  const nameAddressQuery = [place.name, place.address].filter(Boolean).join(' ').trim()
  if (!nameQuery) return null

  // 이름+주소로 먼저 찾는다(같은 이름이 여러 곳일 때 주소가 구분해 준다).
  // 구글이 도로명 대신 옛 지번 주소로 색인해 둔 곳은 이 조합이 0건으로 나오므로,
  // 좌표 반경(locationBias)만 믿고 이름만으로 한 번 더 찾아본다.
  const found =
    (nameAddressQuery && nameAddressQuery !== nameQuery ? await searchTextOnce(nameAddressQuery, locationBias) : null) ||
    (await searchTextOnce(nameQuery, locationBias))
  if (!found) return null

  const priceLevel = found.priceLevel || null
  const costFields = {
    feeText: priceLevel ? PRICE_LEVEL_TEXT[priceLevel] || null : null,
    costTier: costTierFromPriceLevel(priceLevel),
    // 사진은 인기순으로 오므로 첫 장이 대표 사진 역할을 한다.
    photoRef: found.photos?.[0]?.name || null,
    // 카드 딥데이터: 별점·리뷰수·한줄요약·홈페이지(SNS 주소도 여기 하나로 옴).
    // editorialSummary 는 구글이 요약을 만들어 둔 곳만 있어서 없는 경우가 흔하다.
    rating: typeof found.rating === 'number' ? found.rating : null,
    userRatingCount: typeof found.userRatingCount === 'number' ? found.userRatingCount : null,
    editorialSummary: found.editorialSummary?.text || null,
    websiteUrl: found.websiteUri || null,
  }
  const hasAnything = Object.values(costFields).some((value) => value !== null)

  if (!found.regularOpeningHours) {
    // 영업시간이 없어도 나머지(가격대·사진·별점 등)는 건질 수 있으면 그것만 돌려준다.
    if (!hasAnything) return null
    return {
      openHoursText: null,
      closedDayText: null,
      opensAt: null,
      closesAt: null,
      alwaysOpen: false,
      closedWeekdays: [],
      ...costFields,
    }
  }

  return { ...parseGoogleHours(found.regularOpeningHours), ...costFields }
}

// 여러 장소의 영업시간·가격대·대표 사진을 한 번에 조회한다. -> Map<placeId, info | null>
// 키가 없으면 빈 Map (불필요한 요청을 아예 안 보낸다).
export async function fetchGoogleHoursMany(places) {
  if (!apiKey || places.length === 0) return new Map()
  const entries = await mapLimit(places, 8, async (place) => [
    place.id,
    await fetchGoogleHours(place).catch(() => null),
  ])
  return new Map(entries)
}
