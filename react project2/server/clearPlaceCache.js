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
