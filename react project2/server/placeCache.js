// ─────────────────────────────────────────────────────────────
// server/placeCache.js — 장소 캐시 (stale-while-revalidate)
//
// 도시 하나의 장소 풀을 만들려면 TourAPI + 카카오 로컬 + Google Places + Gemini 를
// 모두 거쳐야 한다. 매 요청마다 하면 느리고 비싸서, 결과를 PlaceCache 테이블에 모아 둔다.
//
// 캐시 전략은 stale-while-revalidate 다.
//   · 캐시가 있으면 7일이 지나 오래됐더라도 "즉시" 돌려준다
//   · 오래된 경우 갱신은 백그라운드로 돌리고 사용자는 기다리지 않는다
//   · 캐시가 아예 없을 때(그 도시 첫 조회)만 외부 API 를 기다린다
//
// 신선함보다 응답 속도를 택한 것이다 — 관광지 정보는 일주일 사이에 크게 달라지지 않는다.
// 결과적으로 같은 도시의 두 번째 조회부터는 외부 호출이 0회다.
//
// 쓰는 곳: server/app.js 의 /api/course-pool
// ─────────────────────────────────────────────────────────────

import { prisma } from './db.js'

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000 // 7일 지나면 백그라운드로 다시 조회한다(응답은 안 기다림).

// 이 도시의 캐시를 가져온다. 행이 있으면 오래됐어도 그대로 돌려주되(stale-while-revalidate),
// 오래됐는지 여부(stale)를 함께 알려줘서 호출부가 백그라운드 갱신을 트리거하도록 한다.
export async function findCityPool(cityKey) {
  const rows = await prisma.placeCache.findMany({
    where: { cityKey },
    orderBy: { createdAt: 'asc' },
  })
  if (rows.length === 0) return { rows: null, stale: false }

  const oldest = rows.reduce((min, row) => Math.min(min, row.createdAt.getTime()), Date.now())
  return { rows, stale: Date.now() - oldest > STALE_AFTER_MS }
}

// 이미 캐시에 있는 장소를 id 로 한 번에 조회한다.
// 새로 모은 장소 중 "이미 아는 곳"을 걸러내 Gemini 재호출을 막는 데 쓴다.
export async function findCachedByIds(ids) {
  if (ids.length === 0) return []
  return prisma.placeCache.findMany({ where: { id: { in: ids } } })
}

// 새로 모은 장소를 저장한다. 있으면 갱신, 없으면 생성(upsert).
// 트랜잭션으로 묶어 중간에 실패해도 절반만 저장되는 일이 없게 한다.
export async function upsertPlaces(places) {
  await prisma.$transaction(
    places.map((place) =>
      prisma.placeCache.upsert({
        where: { id: place.id },
        update: place,
        create: place,
      }),
    ),
  )
}

// 사진만 따로 채워 넣을 때 쓴다. updates: [{ id, imageUrl }]
export async function updatePlaceImages(updates) {
  if (updates.length === 0) return
  await prisma.$transaction(
    updates.map((update) =>
      prisma.placeCache.update({ where: { id: update.id }, data: { imageUrl: update.imageUrl } }),
    ),
  )
}

// closedWeekdays 는 "[1]" 같은 JSON 배열 문자열로 저장돼 있다. 깨졌거나 비어있으면 빈 배열.
function parseWeekdays(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// slots 는 ["오전","오후 카페"] 같은 JSON 배열 문자열. 비어있으면(구 캐시 행) 대표 slot 하나로 폴백.
function parseSlots(value, fallbackSlot) {
  try {
    const parsed = JSON.parse(value || '[]')
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {
    /* 아래 폴백 */
  }
  return fallbackSlot ? [fallbackSlot] : []
}

// PlaceCache 행 -> 프런트가 기대하는 place 객체 모양으로 변환.
export function toPoolPlace(row) {
  return {
    name: row.name,
    address: row.address,
    source: row.source,
    category: row.category || '',
    stay: row.stay,
    reason: row.reason,
    caution: row.caution,
    time: row.time,
    parking: row.parking,
    openHoursText: row.openHoursText,
    closedDayText: row.closedDayText,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    alwaysOpen: row.alwaysOpen ?? false,
    closedWeekdays: parseWeekdays(row.closedWeekdays),
    feeText: row.feeText || null,
    costTier: row.costTier || '',
    transitStation: row.transitStation,
    transitDistanceM: row.transitDistanceM,
    transitScore: row.transitScore,
    imageUrl: row.imageUrl || '',
    rating: row.rating ?? null,
    userRatingCount: row.userRatingCount ?? null,
    editorialSummary: row.editorialSummary || null,
    websiteUrl: row.websiteUrl || null,
    location: { lat: row.lat, lng: row.lng },
    slots: parseSlots(row.slots, row.slot),
    themes: JSON.parse(row.themes),
    budgetTiers: JSON.parse(row.budgetTiers),
  }
}
