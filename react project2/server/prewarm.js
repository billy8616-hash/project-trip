import 'dotenv/config'
import { allDestinations } from '../src/data/destinations.js'
import { buildCityPoolRows } from './app.js'
import { prisma } from './db.js'
import { findCityPool } from './placeCache.js'

// 목적지 카탈로그의 모든 도시를 미리 한 번씩 호출해 PlaceCache 를 채워둔다.
// 그러면 실제 사용자는 "그 도시 첫 조회"의 느린 경로를 절대 밟지 않는다.
//
//   node server/prewarm.js            -> 캐시 없는 도시만
//   node server/prewarm.js --force    -> 있어도 다시 만듦
//   node server/prewarm.js 부산 제주   -> 지정한 도시만
const args = process.argv.slice(2)
const force = args.includes('--force')
const only = args.filter((arg) => !arg.startsWith('-'))

async function main() {
  const targets = only.length > 0 ? only : allDestinations.map((city) => city.name)
  console.log(`[prewarm] ${targets.length}개 도시${force ? ' (강제)' : ''}: ${targets.join(', ')}`)

  for (const city of targets) {
    const startedAt = Date.now()
    try {
      if (!force) {
        const { rows } = await findCityPool(city)
        if (rows && rows.length > 0) {
          console.log(`  - ${city}: 이미 캐시됨 (${rows.length}곳) — 건너뜀`)
          continue
        }
      }
      const rows = await buildCityPoolRows(city)
      console.log(`  - ${city}: ${rows.length}곳 저장 (${((Date.now() - startedAt) / 1000).toFixed(1)}초)`)
    } catch (error) {
      console.warn(`  - ${city}: 실패 — ${error.message}`)
    }
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
