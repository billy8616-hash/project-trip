// 카카오 로컬 API 에는 영업시간이 없어서, 음식점·카페는 Google Places API (New) 로 채운다.
// places:searchText 한 번에 이름+위치로 검색하고 regularOpeningHours 를 바로 받아온다(별도 상세조회 불필요).
// 키가 없으면 조용히 비활성 — 그 경우 카카오 장소는 예전처럼 영업시간 없이 나온다.
import { mapLimit, timeoutSignal } from './concurrency.js'
import { costTierFromPriceLevel } from './costTier.js'

const apiKey = process.env.GOOGLE_PLACES_API_KEY
const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'

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

// place: { name, address, lat, lng } -> 영업시간 정보 | null
export async function fetchGoogleHours(place) {
  if (!apiKey || !place?.name) return null

  const textQuery = [place.name, place.address].filter(Boolean).join(' ').trim()
  if (!textQuery) return null

  const body = {
    textQuery,
    languageCode: 'ko',
    regionCode: 'KR',
    maxResultCount: 1,
  }
  if (Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
    // 상호명이 흔하면 엉뚱한 지점이 잡힐 수 있어 좌표 주변으로 검색을 좁힌다.
    body.locationBias = { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 400 } }
  }

  let response
  try {
    response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.regularOpeningHours,places.priceLevel',
      },
      body: JSON.stringify(body),
      signal: timeoutSignal(4000),
    })
  } catch {
    return null
  }

  const data = await response.json().catch(() => null)
  if (!response.ok || !data) return null

  const found = data.places?.[0]
  if (!found) return null

  const priceLevel = found.priceLevel || null
  const costFields = {
    feeText: priceLevel ? PRICE_LEVEL_TEXT[priceLevel] || null : null,
    costTier: costTierFromPriceLevel(priceLevel),
  }

  if (!found.regularOpeningHours) {
    // 영업시간이 없어도 가격대는 건질 수 있으면 그것만 돌려준다.
    if (!costFields.costTier && !costFields.feeText) return null
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

// 여러 장소의 영업시간을 한 번에 조회한다. -> Map<placeId, hours | null>
// 키가 없으면 빈 Map (불필요한 요청을 아예 안 보낸다).
export async function fetchGoogleHoursMany(places) {
  if (!apiKey || places.length === 0) return new Map()
  const entries = await mapLimit(places, 8, async (place) => [
    place.id,
    await fetchGoogleHours(place).catch(() => null),
  ])
  return new Map(entries)
}
