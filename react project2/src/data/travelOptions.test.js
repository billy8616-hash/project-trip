import { describe, expect, it } from 'vitest'
import { effectiveTransport, fixedTransportOf } from './travelOptions.js'

describe('테마별 교통편 고정', () => {
  it('발길따라는 사용자가 무엇을 골랐든 도보로 짠다', () => {
    expect(fixedTransportOf('step')).toBe('도보')
    expect(effectiveTransport('step', '자차')).toBe('도보')
    expect(effectiveTransport('step', '대중교통')).toBe('도보')
  })

  it('고정이 없는 테마나 테마를 안 고른 경우엔 고른 값을 그대로 쓴다', () => {
    expect(fixedTransportOf('food')).toBeNull()
    expect(effectiveTransport('food', '자차')).toBe('자차')
    expect(effectiveTransport('', '대중교통')).toBe('대중교통')
    expect(effectiveTransport(undefined, '대중교통')).toBe('대중교통')
  })
})
