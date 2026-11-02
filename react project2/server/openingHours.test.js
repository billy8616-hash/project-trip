import { describe, expect, it } from 'vitest'
import { parseClosedDays } from './openingHours.js'

const closedOf = (text) => parseClosedDays(text).closedWeekdays

describe('parseClosedDays', () => {
  it('매주 쉬는 요일을 읽는다', () => {
    expect(closedOf('매주 월요일')).toEqual([1])
    expect(closedOf('월,화요일 휴관')).toEqual([1, 2])
    expect(closedOf('토·일요일')).toEqual([0, 6])
    expect(closedOf('일요일 및 공휴일')).toEqual([0])
  })

  it('날짜·명절의 "일"을 일요일로 읽지 않는다', () => {
    expect(closedOf('1월 1일, 월요일')).toEqual([1])
    expect(closedOf('설·추석 당일, 월요일 휴관')).toEqual([1])
    expect(closedOf('공휴일 다음날, 화요일')).toEqual([2])
  })

  it('조건부·격주 휴무는 매주 휴무로 보지 않는다', () => {
    expect(closedOf('매주 월요일 (월요일이 공휴일인 경우 화요일 휴관)')).toEqual([1])
    expect(closedOf('매월 첫째, 셋째 월요일')).toEqual([])
    expect(closedOf('매월 둘째·넷째 일요일')).toEqual([])
    expect(closedOf('격주 수요일')).toEqual([])
  })

  it('연중무휴·빈 값은 쉬는 날이 없다', () => {
    expect(closedOf('연중무휴')).toEqual([])
    expect(closedOf('')).toEqual([])
  })
})
