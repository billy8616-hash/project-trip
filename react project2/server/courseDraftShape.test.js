import { describe, expect, it } from 'vitest'
import { draftCityOf, normalizeDraftPayload } from './courseDraftShape.js'

const meta = { destination: '부산', duration: '1박 2일', journeyTheme: 'view' }

describe('normalizeDraftPayload', () => {
  it('복원에 필요한 필드만 남긴다', () => {
    const result = normalizeDraftPayload({
      meta,
      edits: { currentTimelineDays: [[{ name: '해운대', assignedSlot: '오전' }]], manualOrderDays: [0] },
      view: { selectedDay: 1, savedName: '부산 여행' },
      screen: 'course',
      extra: 'x',
    })
    expect(result).toEqual({
      meta,
      edits: { currentTimelineDays: [[{ name: '해운대', assignedSlot: '오전' }]], manualOrderDays: [0] },
      view: { selectedDay: 1, savedName: '부산 여행' },
    })
  })

  it('편집 내역이 없어도 저장된다 (추천 코스 그대로 보는 중)', () => {
    expect(normalizeDraftPayload({ meta })).toEqual({
      meta,
      edits: { currentTimelineDays: [], manualOrderDays: [] },
      view: { selectedDay: 0, savedName: '' },
    })
  })

  it('목적지가 없으면 거절한다', () => {
    expect(normalizeDraftPayload({ meta: { destination: '  ' } })).toBeNull()
    expect(normalizeDraftPayload({ meta: null })).toBeNull()
    expect(normalizeDraftPayload(null)).toBeNull()
    expect(normalizeDraftPayload([])).toBeNull()
  })

  it('일정 모양이 깨졌으면 거절한다', () => {
    expect(normalizeDraftPayload({ meta, edits: { currentTimelineDays: ['해운대'] } })).toBeNull()
    expect(normalizeDraftPayload({ meta, edits: { currentTimelineDays: [[{ title: '이름 없음' }]] } })).toBeNull()
    expect(normalizeDraftPayload({ meta, edits: { currentTimelineDays: Array.from({ length: 31 }, () => []) } })).toBeNull()
  })

  it('수동 정렬 날짜는 올바른 정수만 남긴다', () => {
    const result = normalizeDraftPayload({ meta, edits: { manualOrderDays: [0, 2, -1, 1.5, '3', 99] } })
    expect(result.edits.manualOrderDays).toEqual([0, 2])
  })

  it('너무 큰 payload 는 거절한다', () => {
    const big = Array.from({ length: 30 }, () => Array.from({ length: 40 }, () => ({ name: 'x'.repeat(100) })))
    expect(normalizeDraftPayload({ meta, edits: { currentTimelineDays: big } })).toBeNull()
  })
})

describe('draftCityOf', () => {
  it('직접 고른 목적지를 우선한다', () => {
    expect(draftCityOf({ destination: '부산 여행', pickedDestination: '부산' })).toBe('부산')
    expect(draftCityOf({ destination: ' 경주 ' })).toBe('경주')
  })
})
