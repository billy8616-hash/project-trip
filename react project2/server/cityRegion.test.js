import { describe, expect, it } from 'vitest'
import { isCatalogCity, matchesCityRegion } from './cityRegion.js'

describe('matchesCityRegion', () => {
  it('카카오 로컬의 줄인 시·도 이름("서울 강남구")도 그 도시로 본다', () => {
    expect(matchesCityRegion('서울 강남구 테헤란로 152', '서울')).toBe(true)
    expect(matchesCityRegion('부산 해운대구 해운대해변로 264', '부산')).toBe(true)
    expect(matchesCityRegion('대구 중구 동성로 1', '대구')).toBe(true)
  })

  it('TourAPI 의 정식 명칭("서울특별시")도 받는다', () => {
    expect(matchesCityRegion('서울특별시 종로구 사직로 161', '서울')).toBe(true)
    expect(matchesCityRegion('광주광역시 동구 문화전당로 38', '광주')).toBe(true)
    expect(matchesCityRegion('세종특별자치시 다솜로 261', '세종')).toBe(true)
    expect(matchesCityRegion('제주특별자치도 제주시 관덕로 25', '제주')).toBe(true)
  })

  it('다른 지역 주소나 지명 일부로 들어간 도시명은 걸러낸다', () => {
    expect(matchesCityRegion('경기 광주시 경안로 1', '광주')).toBe(false)
    expect(matchesCityRegion('경기 성남시 분당구 서울대로 1', '서울')).toBe(false)
    expect(matchesCityRegion('강원특별자치도 속초시 대포항길 1', '대포')).toBe(false)
    expect(matchesCityRegion('', '서울')).toBe(false)
  })

  it('일반 시·군은 "OO시"·"OO군" 단위로 맞춘다', () => {
    expect(matchesCityRegion('강원특별자치도 속초시 중앙로 1', '속초')).toBe(true)
    expect(matchesCityRegion('경기 가평군 가평읍 1', '가평')).toBe(true)
  })
})

describe('isCatalogCity', () => {
  it('서비스하는 도시만 통과시킨다', () => {
    expect(isCatalogCity('서울')).toBe(true)
    expect(isCatalogCity('남원')).toBe(true)
    expect(isCatalogCity('기장')).toBe(false) // 부산 기장군 — 따로 풀을 만들면 부산 장소를 빼앗는다
    expect(isCatalogCity('')).toBe(false)
  })
})
