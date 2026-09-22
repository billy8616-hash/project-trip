// ─────────────────────────────────────────────────────────────
// server/tourApi.js — 한국관광공사 TourAPI (관광지·문화시설)
//
// 코스 후보의 대부분이 여기서 온다. 공공데이터라 무료이고, 국내 관광지 정보는
// 민간 API 보다 넓고 꼼꼼하다 — 영업시간·휴무일·주차 안내·입장료까지 준다.
//
// 하는 일
//   1) 도시 중심 좌표 반경으로 장소 목록 조회 (관광지 12, 문화시설 14)
//   2) 각 장소의 상세정보를 추가 조회해 영업시간·휴무일·요금을 붙임
//   3) 그 자유 문장들을 코스 로직이 쓸 수 있는 형태로 파싱 (openingHours.js)
//   4) 실제로 그 도시에 있는 장소만 남김 (cityRegion.js)
//
// 2번에서 수십 건을 한꺼번에 던지면 API 가 버티지 못해 mapLimit 으로 동시 호출을 제한한다.
// ─────────────────────────────────────────────────────────────

import { matchesCityRegion } from './cityRegion.js'
import { mapLimit, timeoutSignal } from './concurrency.js'
import { costTierFromFee } from './costTier.js'
import { parseClosedDays, parseOpeningHours } from './openingHours.js'
import { slotsForTourPlace } from './placeSlots.js'

const tourApiKey = process.env.TOUR_API_KEY
const BASE_URL = 'https://apis.data.go.kr/B551011/KorService2'

// TourAPI 컨텐츠 타입: 12=관광지, 14=문화시설.
const CONTENT_TYPE = { attraction: '12', culture: '14' }

// data.go.kr 서비스키는 "디코딩" 값을 .env 에 넣어야 한다.
// URLSearchParams 가 알아서 인코딩하므로, 이미 인코딩된(%2B 등) 키를 넣으면 이중 인코딩되어 인증이 깨진다.
async function searchKeyword(keyword, contentTypeId) {
  if (!tourApiKey) throw new Error('TOUR_API_KEY가 설정되지 않았어요.')

  const params = new URLSearchParams({
    serviceKey: tourApiKey,
    MobileOS: 'ETC',
    MobileApp: '발길따라',
    _type: 'json',
    numOfRows: '100', // 코스는 하루 4슬롯 x 여행일수만큼 장소가 필요하다. 30 이면 3일 이상에서 후보가 말라붙는다.
    pageNo: '1',
    arrange: 'Q', // 조회순
    keyword,
  })
  if (contentTypeId) params.set('contentTypeId', contentTypeId)

  // 검색 자체는 결과가 없으면 코스를 못 만드니 타임아웃으로 fail-fast 하지 않는다(느려도 기다린다).
  const response = await fetch(`${BASE_URL}/searchKeyword2?${params}`, { signal: timeoutSignal(15000) })
  const data = await response.json().catch(() => null)
  const resultCode = data?.response?.header?.resultCode
  if (!response.ok || !data || resultCode !== '0000') {
    throw new Error(data?.response?.header?.resultMsg || 'TourAPI 조회에 실패했어요.')
  }

  // 결과가 0건이면 items 가 빈 문자열("")로 온다 (에러 아님).
  const items = data.response.body.items?.item
  if (!items) return []

  // 결과가 1건이면 배열이 아니라 단일 객체로 온다 (TourAPI 특유의 동작).
  return Array.isArray(items) ? items : [items]
}

// TourAPI 사진 URL 은 콘텐츠에 따라 http:// 로 오기도 한다. https 페이지에서 막히지 않게 통일한다.
function normalizeImageUrl(value) {
  const url = String(value || '').trim()
  if (!url) return null
  return url.startsWith('http://') ? `https://${url.slice(7)}` : url
}

function toPlace(item, contentTypeId) {
  const slots = slotsForTourPlace({
    contentTypeId,
    cat1: item.cat1,
    cat2: item.cat2,
    cat3: item.cat3,
    title: item.title,
  })
  return {
    id: `tour-${item.contentid}`,
    source: 'tourapi',
    contentTypeId, // detailIntro2(주차 정보 등)를 조회할 때 콘텐츠 타입이 필요하다.
    // 대표 사진. firstimage 는 원본, firstimage2 는 썸네일(작은 쪽)이다. 둘 다 없는 콘텐츠도 흔하다.
    // 검색 응답에 이미 들어 있어서 추가 호출이 필요 없다.
    image: normalizeImageUrl(item.firstimage || item.firstimage2),
    name: item.title,
    address: item.addr1 || '',
    lat: Number(item.mapy),
    lng: Number(item.mapx),
    category: item.cat3 || item.cat2 || '',
    slots, // 어울리는 시간대(여러 개 가능). slot(단수)은 대표값.
    slot: slots[0],
  }
}

// searchKeyword2 는 제목 텍스트 검색이라 "{도시}로집" 처럼 장소 이름에 도시명이 들어갈 뿐
// 실제로는 다른 지역인 결과도 섞여 온다. 주소가 실제로 그 도시 행정구역인지로 한 번 더 걸러낸다.
function isInCity(item, cityName) {
  return matchesCityRegion(item.addr1, cityName)
}

export async function searchAttractions(cityName) {
  const items = await searchKeyword(cityName, CONTENT_TYPE.attraction)
  return items
    .filter((item) => item.mapx && item.mapy && isInCity(item, cityName))
    .map((item) => toPlace(item, CONTENT_TYPE.attraction))
}

export async function searchCultureSpots(cityName) {
  const items = await searchKeyword(cityName, CONTENT_TYPE.culture)
  return items
    .filter((item) => item.mapx && item.mapy && isInCity(item, cityName))
    .map((item) => toPlace(item, CONTENT_TYPE.culture))
}

// 관광지·문화시설 상세 소개(detailIntro2)에서 주차·이용시간·쉬는날 안내 텍스트를 가져온다.
// 콘텐츠 타입마다 필드 이름이 다르다: 관광지(12)는 접미사 없음, 문화시설(14)은 "culture" 접미사.
const PARKING_FIELD = { [CONTENT_TYPE.attraction]: 'parking', [CONTENT_TYPE.culture]: 'parkingculture' }
const USETIME_FIELD = { [CONTENT_TYPE.attraction]: 'usetime', [CONTENT_TYPE.culture]: 'usetimeculture' }
const RESTDATE_FIELD = { [CONTENT_TYPE.attraction]: 'restdate', [CONTENT_TYPE.culture]: 'restdateculture' }
// 이용요금: 관광지·문화시설 모두 detailIntro2 의 usefee 필드에 담긴다 (예: "무료", "성인 3,000원").
const USEFEE_FIELD = { [CONTENT_TYPE.attraction]: 'usefee', [CONTENT_TYPE.culture]: 'usefee' }

// TourAPI 안내 텍스트에는 <br>, &lt; 같은 HTML 조각이 섞여 온다. 카드에 그대로 못 쓰니 정리한다.
function cleanInfoText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchDetailIntro(contentId, contentTypeId) {
  if (!tourApiKey) throw new Error('TOUR_API_KEY가 설정되지 않았어요.')

  const params = new URLSearchParams({
    serviceKey: tourApiKey,
    MobileOS: 'ETC',
    MobileApp: '발길따라',
    _type: 'json',
    contentId,
    contentTypeId,
  })

  const response = await fetch(`${BASE_URL}/detailIntro2?${params}`, { signal: timeoutSignal(4000) })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.response?.header?.resultCode !== '0000') return null

  const items = data.response.body.items?.item
  if (!items) return null
  return Array.isArray(items) ? items[0] : items
}

// place: { id: "tour-<contentid>", contentTypeId }. TourAPI 장소만 상세 정보를 조회할 수 있다.
// 한 번의 detailIntro2 호출에서 주차 + 영업시간 + 휴무일을 함께 뽑는다.
// -> { parking, openHoursText, closedDayText, opensAt, closesAt, alwaysOpen, closedWeekdays } | null
export async function fetchPlaceDetail(place) {
  const contentId = String(place?.id || '').startsWith('tour-') ? place.id.slice(5) : null
  if (!contentId || !place?.contentTypeId) return null

  const item = await fetchDetailIntro(contentId, place.contentTypeId).catch(() => null)
  if (!item) return null

  const parkingField = PARKING_FIELD[place.contentTypeId]
  const openHoursText = cleanInfoText(item[USETIME_FIELD[place.contentTypeId]]) || null
  const closedDayText = cleanInfoText(item[RESTDATE_FIELD[place.contentTypeId]]) || null
  const feeText = cleanInfoText(item[USEFEE_FIELD[place.contentTypeId]]) || null
  const hours = parseOpeningHours(openHoursText)
  const closed = parseClosedDays(closedDayText)

  return {
    parking: (parkingField && cleanInfoText(item[parkingField])) || null,
    openHoursText,
    closedDayText,
    feeText,
    costTier: costTierFromFee(feeText),
    opensAt: hours.opensAt,
    closesAt: hours.closesAt,
    alwaysOpen: hours.alwaysOpen,
    closedWeekdays: closed.closedWeekdays,
  }
}

// 여러 장소의 상세 정보를 조회한다. 동시 8개까지만 (data.go.kr 이 느려서 한 번에 수십 개 던지면 오히려 지연).
export async function fetchPlaceDetailsMany(places) {
  const entries = await mapLimit(places, 8, async (place) => [
    place.id,
    await fetchPlaceDetail(place).catch(() => null),
  ])
  return new Map(entries)
}

// 여행지 카드 썸네일용 대표 사진 1장. 관광지 → 문화시설 → 전체 순으로 뒤져서
// firstimage 가 있는 첫 결과를 쓴다 (TourAPI 는 사진이 없는 콘텐츠가 섞여 있다).
const thumbnailCache = new Map() // cityName -> { imageUrl, cachedAt }
const THUMBNAIL_TTL_MS = 24 * 60 * 60 * 1000 // 대표 사진은 자주 안 바뀌니 하루만 캐시해도 충분하다.

async function fetchCityThumbnail(cityName) {
  for (const contentTypeId of [CONTENT_TYPE.attraction, CONTENT_TYPE.culture, undefined]) {
    const items = await searchKeyword(cityName, contentTypeId)
    const withImage = items.find((item) => item.firstimage && isInCity(item, cityName))
    if (withImage) return normalizeImageUrl(withImage.firstimage)
  }
  return null
}

export async function getCityThumbnails(cityNames) {
  const uniqueNames = [...new Set(cityNames)]
  const now = Date.now()

  const entries = await Promise.all(
    uniqueNames.map(async (name) => {
      const cached = thumbnailCache.get(name)
      if (cached && now - cached.cachedAt < THUMBNAIL_TTL_MS) return [name, cached.imageUrl]

      const imageUrl = await fetchCityThumbnail(name).catch(() => null)
      thumbnailCache.set(name, { imageUrl, cachedAt: now })
      return [name, imageUrl]
    }),
  )

  return Object.fromEntries(entries)
}
