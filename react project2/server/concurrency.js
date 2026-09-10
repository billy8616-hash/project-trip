// 여러 개의 외부 API 호출을 한꺼번에 다 던지지 않고, 동시에 최대 limit 개까지만 돌린다.
// (TourAPI 상세조회처럼 수십 개를 한 번에 던지면 일부가 멈춰 전체가 지연되는 걸 막는다.)
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await fn(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

// fetch 에 타임아웃을 건다. Node 17.3+ 의 AbortSignal.timeout 사용.
export function timeoutSignal(ms) {
  try {
    return AbortSignal.timeout(ms)
  } catch {
    return undefined
  }
}
