import { describe, expect, it } from 'vitest'
import { themesOf } from './placeKind.js'

describe('themesOf', () => {
  it('Gemini 가 붙인 테마가 있으면 그대로 쓴다', () => {
    expect(themesOf({ themes: ['sns'], category: '음식점 > 한식', source: 'kakao' })).toEqual(['sns'])
  })

  it('테마가 없으면 장소 종류로 기본 테마를 정한다', () => {
    expect(themesOf({ themes: [], category: '음식점 > 한식 > 국밥', source: 'kakao' })).toEqual(['food'])
    expect(themesOf({ themes: [], category: '카페 > 커피전문점', source: 'kakao' })).toEqual(['mood', 'sns'])
    expect(themesOf({ themes: [], category: 'A01011200', source: 'tourapi' })).toEqual(['view', 'step'])
    expect(themesOf({ themes: [], category: 'A02010100', source: 'tourapi' })).toEqual(['step', 'sns'])
  })

  it('종류를 알 수 없으면 빈 배열', () => {
    expect(themesOf({ themes: [], category: '', source: 'tourapi' })).toEqual([])
  })
})
