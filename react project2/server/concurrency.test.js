import { describe, expect, it } from 'vitest'
import { mapLimit } from './concurrency.js'

describe('mapLimit', () => {
  it('동시에 limit 개까지만 실행하고 결과 순서를 유지한다', async () => {
    let running = 0
    let peak = 0
    const results = await mapLimit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, async (n) => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running -= 1
      return n * 2
    })
    expect(peak).toBeLessThanOrEqual(4)
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])
  })
})
