import { describe, expect, it } from 'vitest'
import { MAX_FORECAST_DAYS, parseCoordinate, validateForecastRange } from './weather.js'

describe('validateForecastRange', () => {
  it('정상 구간은 통과', () => {
    expect(validateForecastRange('2026-12-01', '2026-12-03')).toBeNull()
    expect(validateForecastRange('2026-12-01', '2026-12-01')).toBeNull()
  })

  it('양 끝 포함 31일까지만 받는다', () => {
    expect(validateForecastRange('2026-12-01', '2026-12-31')).toBeNull() // 31일
    expect(validateForecastRange('2026-12-01', '2027-01-01')).toMatch(String(MAX_FORECAST_DAYS)) // 32일
  })

  it('수백만 일 구간(0001-01-01 ~ 9999-12-31)을 막는다', () => {
    expect(validateForecastRange('0001-01-01', '9999-12-31')).not.toBeNull()
  })

  it('달력에 없는 날짜와 거꾸로 된 구간을 막는다', () => {
    expect(validateForecastRange('2026-02-31', '2026-03-02')).not.toBeNull()
    expect(validateForecastRange('2026-13-01', '2026-13-02')).not.toBeNull()
    expect(validateForecastRange('2026-12-05', '2026-12-01')).not.toBeNull()
    expect(validateForecastRange('', '')).not.toBeNull()
  })
})

describe('parseCoordinate', () => {
  it('정상 값은 숫자로', () => {
    expect(parseCoordinate('37.5665', 90)).toBe(37.5665)
    expect(parseCoordinate('-126.9', 180)).toBe(-126.9)
  })

  it('빈 문자열·없는 값·숫자가 아닌 값·범위 밖은 null', () => {
    expect(parseCoordinate('', 90)).toBeNull() // Number('') 는 0 이라 걸러야 한다
    expect(parseCoordinate('   ', 90)).toBeNull()
    expect(parseCoordinate(undefined, 90)).toBeNull()
    expect(parseCoordinate('abc', 90)).toBeNull()
    expect(parseCoordinate('91', 90)).toBeNull()
    expect(parseCoordinate('181', 180)).toBeNull()
    expect(parseCoordinate(['1', '2'], 90)).toBeNull()
  })
})
