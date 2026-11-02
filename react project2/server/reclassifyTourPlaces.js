// ─────────────────────────────────────────────────────────────
// server/reclassifyTourPlaces.js — 캐시된 관광지의 분류만 다시 매기기 (일회성 스크립트)
//
// TourAPI 가 옛 분류(cat1~3)를 비워 주기 시작한 뒤 저장된 관광지는 시간대·종류가 기본값으로
// 들어가 있다. 도시 풀을 통째로 다시 만들면 Gemini·Google 까지 불리므로, 무료인 TourAPI
// 검색만 다시 해서 slot·slots·category 를 고치고, 코스에 넣을 수 없는 시설(도서관 등)은 지운다.
// 이번 검색 결과에 없는 옛 행은 건드리지 않는다.
//
//   node server/reclassifyTourPlaces.js        캐시가 있는 모든 도시
//   node server/reclassifyTourPlaces.js 서울   그 도시만
// ─────────────────────────────────────────────────────────────

import 'dotenv/config'
import { matchesCityRegion } from './cityRegion.js'
import { prisma } from './db.js'
import { CONTENT_TYPE, isTouristSpot, searchKeyword, toPlace } from './tourApi.js'

async function reclassifyCity(cityKey) {
  const found = []
  for (const contentTypeId of [CONTENT_TYPE.attraction, CONTENT_TYPE.culture]) {
    const items = await searchKeyword(cityKey, contentTypeId)
    for (const item of items) {
      if (matchesCityRegion(item.addr1, cityKey)) found.push({ item, contentTypeId })
    }
  }

  const dropIds = found.filter(({ item }) => !isTouristSpot(item)).map(({ item }) => `tour-${item.contentid}`)
  const updates = found
    .filter(({ item }) => isTouristSpot(item))
    .map(({ item, contentTypeId }) => toPlace(item, contentTypeId))
    .map((place) =>
      prisma.placeCache.updateMany({
        where: { id: place.id, cityKey },
        data: { slot: place.slot, slots: JSON.stringify(place.slots), category: place.category },
      }),
    )

  const results = await prisma.$transaction(updates)
  const { count: dropped } = await prisma.placeCache.deleteMany({ where: { id: { in: dropIds }, cityKey } })
  const updated = results.reduce((sum, result) => sum + result.count, 0)
  console.log(`${cityKey}: 분류 갱신 ${updated}곳 · 관광지 아님 삭제 ${dropped}곳`)
}

async function main() {
  const cityArg = process.argv[2]
  const cities = cityArg
    ? [cityArg]
    : (await prisma.placeCache.findMany({ distinct: ['cityKey'], select: { cityKey: true } })).map((row) => row.cityKey)
  for (const cityKey of cities) {
    await reclassifyCity(cityKey).catch((error) => console.warn(`${cityKey}: 실패 — ${error.message}`))
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
