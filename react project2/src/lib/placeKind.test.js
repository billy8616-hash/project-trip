import { describe, expect, it } from 'vitest'
import { placeKindOf, themesOf } from './placeKind.js'

describe('placeKindOf', () => {
  it('카카오 장소는 이름이 아니라 카테고리로만 판별한다', () => {
    const kakao = (name, category) => placeKindOf({ name, category, source: 'kakao' })
    expect(kakao('금강산옹심이막국수', '음식점 > 한식 > 국수')).toBe('restaurant')
    expect(kakao('황생가칼국수', '음식점 > 한식 > 국수 > 칼국수')).toBe('restaurant')
    expect(kakao('전망대횟집', '음식점 > 한식 > 해물,생선 > 회')).toBe('restaurant')
    expect(kakao('카페 밥상', '음식점 > 한식')).toBe('restaurant')
    expect(kakao('커피앤시가렛', '음식점 > 카페')).toBe('cafe')
    expect(kakao('동네한잔', '음식점 > 술집 > 호프,요리주점')).toBe('bar')
  })

  it('관광지는 여전히 이름으로도 판별한다', () => {
    expect(placeKindOf({ name: '남산서울타워', category: '', source: 'tourapi' })).toBe('viewpoint')
  })
})

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
