import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  durationLabelFromNights,
  formatShortDate,
  nightsBetween,
  parseDayCount,
  todayISO,
} from './datetime.js'

describe('addDaysISO', () => {
  it('0일을 더해도 같은 날짜다 (UTC 변환으로 하루 앞당겨지던 버그의 회귀 테스트)', () => {
    expect(addDaysISO('2026-10-19', 0)).toBe('2026-10-19')
  })

  it('월·연 경계를 넘긴다', () => {
    expect(addDaysISO('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('윤년 2월 29일을 지난다', () => {
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysISO('2028-02-28', 2)).toBe('2028-03-01')
  })
})

describe('todayISO', () => {
  it('로컬 날짜를 YYYY-MM-DD 로 돌려준다', () => {
    const now = new Date()
    const expected = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map((n, i) => (i === 0 ? String(n) : String(n).padStart(2, '0')))
      .join('-')
    expect(todayISO()).toBe(expected)
  })
})

describe('formatShortDate', () => {
  it('"월/일 (요일)" 로 표기한다', () => {
    expect(formatShortDate('2026-10-19')).toBe('10/19 (월)')
    expect(formatShortDate('2026-10-18')).toBe('10/18 (일)')
  })
})

describe('nightsBetween / durationLabelFromNights', () => {
  it('같은 날이면 0박(당일)이다', () => {
    expect(nightsBetween('2026-10-19', '2026-10-19')).toBe(0)
    expect(durationLabelFromNights(0)).toBe('당일')
  })

  it('박수를 세고 "N박 N+1일" 라벨을 만든다', () => {
    expect(nightsBetween('2026-10-19', '2026-10-21')).toBe(2)
    expect(durationLabelFromNights(2)).toBe('2박 3일')
  })
})

describe('parseDayCount', () => {
  it('라벨 끝의 "N일" 을 읽는다', () => {
    expect(parseDayCount('2박 3일')).toBe(3)
    expect(parseDayCount('4박 5일')).toBe(5)
  })

  it('알 수 없는 라벨이나 빈 값은 1일이다', () => {
    expect(parseDayCount('')).toBe(1)
    expect(parseDayCount(undefined)).toBe(1)
  })
})
