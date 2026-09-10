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

export async function findCachedByIds(ids) {
  if (ids.length === 0) return []
  return prisma.placeCache.findMany({ where: { id: { in: ids } } })
}

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
    location: { lat: row.lat, lng: row.lng },
    slots: parseSlots(row.slots, row.slot),
    themes: JSON.parse(row.themes),
    budgetTiers: JSON.parse(row.budgetTiers),
  }
}
