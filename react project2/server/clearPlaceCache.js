// ─────────────────────────────────────────────────────────────
// server/clearPlaceCache.js — 장소 캐시 비우기 (개발용 스크립트)
//
// 캐시에 저장하는 필드나 분류 규칙을 바꾸면, 이미 저장된 행은 옛 형식 그대로
// 남아 있어 새 로직이 반영되지 않는다. 그럴 때 이 스크립트로 비우면
// 다음 조회에서 외부 API 로 새로 채운다.
//
//   npm run db:clear-places        전체
//   node server/clearPlaceCache.js 부산   그 도시만
// ─────────────────────────────────────────────────────────────

import 'dotenv/config'
import { prisma } from './db.js'

// 장소 캐시(PlaceCache)를 비운다. 영업시간·슬롯 같은 스키마/로직이 바뀐 뒤
// 다음 /api/course-pool 호출 때 외부 API 로 새로 채우도록 하려고 쓴다.
//   node server/clearPlaceCache.js           -> 전체 삭제
//   node server/clearPlaceCache.js 부산       -> 그 도시만 삭제
async function main() {
  const cityArg = process.argv[2]
  const where = cityArg ? { cityKey: cityArg } : {}
  const { count } = await prisma.placeCache.deleteMany({ where })
  console.log(`Deleted ${count} PlaceCache rows${cityArg ? ` (city: ${cityArg})` : ' (all cities)'}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
