import { describe, expect, it } from 'vitest'
import { isClosedOnDate } from './openingHours.js'

// 2026-10-19 는 월요일(1), 2026-10-18 은 일요일(0)이다.
describe('isClosedOnDate', () => {
  it('휴무 요일에 해당하는 날짜면 true', () => {
    expect(isClosedOnDate({ closedWeekdays: [1] }, '2026-10-19')).toBe(true)
  })

  it('휴무 요일이 아니면 false', () => {
    expect(isClosedOnDate({ closedWeekdays: [1] }, '2026-10-18')).toBe(false)
    expect(isClosedOnDate({ closedWeekdays: [0, 6] }, '2026-10-19')).toBe(false)
  })

  it('휴무 정보가 없으면 항상 false (데이터가 없다고 빼면 안 된다)', () => {
    expect(isClosedOnDate({}, '2026-10-19')).toBe(false)
    expect(isClosedOnDate({ closedWeekdays: [] }, '2026-10-19')).toBe(false)
    expect(isClosedOnDate(null, '2026-10-19')).toBe(false)
  })

  it('날짜를 모르면 false', () => {
    expect(isClosedOnDate({ closedWeekdays: [1] }, null)).toBe(false)
    expect(isClosedOnDate({ closedWeekdays: [1] }, '')).toBe(false)
  })
})
