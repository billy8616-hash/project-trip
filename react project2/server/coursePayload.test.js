import { describe, expect, it, vi } from 'vitest'
import { parseCoursePayload } from './coursePayload.js'

// communityStore.js 가 import 하는 Prisma 클라이언트는 이 테스트에서 쓰지 않는다.
vi.mock('./db.js', () => ({ prisma: {} }))
const { withoutAddresses } = await import('./communityStore.js')

describe('parseCoursePayload', () => {
  it('일차별 장소 목록이면 그대로 돌려준다(장소의 다른 필드도 유지)', () => {
    const payload = { meta: { journeyTheme: 'sns' }, days: [[{ name: '경복궁', assignedSlot: '오전' }], []] }
    expect(parseCoursePayload(payload)).toEqual(payload)
  })

  it('화면이 읽지 못하는 모양은 막는다', () => {
    expect(parseCoursePayload({ days: [1] })).toBeNull()
    expect(parseCoursePayload({ days: [[{ title: '이름 없음' }]] })).toBeNull()
    expect(parseCoursePayload({ days: [] })).toBeNull()
    expect(parseCoursePayload(null)).toBeNull()
    expect(parseCoursePayload({ days: Array.from({ length: 31 }, () => []) })).toBeNull()
  })
})

describe('withoutAddresses', () => {
  it('공유 글에서 출발지·숙소만 빼고 나머지는 남긴다', () => {
    const payload = {
      meta: { city: '서울', tripOrigin: { address: '우리집' }, tripLodging: { address: '숙소' } },
      days: [[{ name: '경복궁' }]],
    }
    expect(withoutAddresses(payload)).toEqual({ meta: { city: '서울' }, days: [[{ name: '경복궁' }]] })
  })
})
