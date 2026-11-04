import { describe, expect, it, vi } from 'vitest'

// placeCache.js 가 import 하는 Prisma 클라이언트는 이 테스트에서 쓰지 않는다.
vi.mock('./db.js', () => ({ prisma: {} }))
const { isPoolStale } = await import('./placeCache.js')

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-11-01T12:00:00+09:00').getTime()
const daysAgo = (days) => new Date(NOW - days * DAY)

describe('isPoolStale', () => {
  it('처음 생긴 지 오래된 행이 있어도 최근에 다시 모았으면 오래되지 않았다', () => {
    const rows = [
      { createdAt: daysAgo(42), refreshedAt: daysAgo(1) },
      { createdAt: daysAgo(1), refreshedAt: daysAgo(1) },
    ]
    expect(isPoolStale(rows, NOW)).toBe(false)
  })

  it('이번 갱신 결과에서 빠진 옛 행은 판단에 끼어들지 않는다 (가장 최근 갱신 기준)', () => {
    const rows = [
      { refreshedAt: daysAgo(30) },
      { refreshedAt: daysAgo(2) },
    ]
    expect(isPoolStale(rows, NOW)).toBe(false)
  })

  it('마지막으로 다시 모은 지 7일이 넘으면 오래됐다', () => {
    expect(isPoolStale([{ refreshedAt: daysAgo(8) }], NOW)).toBe(true)
  })

  it('refreshedAt 이 없는 칼럼 도입 전 캐시는 한 번 다시 모으도록 오래됐다고 본다', () => {
    expect(isPoolStale([{ refreshedAt: null }, { refreshedAt: null }], NOW)).toBe(true)
  })
})
