import { describe, expect, it } from 'vitest'
import { placeKindOf } from '../src/lib/placeKind.js'
import { slotsForTourPlace } from './placeSlots.js'
import { isTouristSpot, legacyCategoryOf } from './tourApi.js'

// 실제 KorService2 응답처럼 cat1~3 은 비고 lclsSystm 만 채운 항목.
const item = (lclsSystm3, title = '') => ({ cat1: '', cat2: '', cat3: '', lclsSystm3, title })

// TourAPI 항목이 앱에서 어떤 시간대·종류로 분류되는지 (tourApi.toPlace 와 같은 경로).
function classify(raw, contentTypeId = '12') {
  const [cat1, cat2, cat3] = legacyCategoryOf(raw)
  const slots = slotsForTourPlace({ contentTypeId, cat1, cat2, cat3, title: raw.title })
  return { slots, kind: placeKindOf({ category: cat3 || cat2, name: raw.title, source: 'tourapi' }) }
}

describe('legacyCategoryOf', () => {
  it('옛 분류(cat1~3)가 있으면 그대로 쓴다', () => {
    expect(legacyCategoryOf({ cat1: 'A01', cat2: 'A0101', cat3: 'A01010100', lclsSystm3: 'HS010100' })).toEqual([
      'A01',
      'A0101',
      'A01010100',
    ])
  })

  it('모르는 새 분류면 빈 값', () => {
    expect(legacyCategoryOf(item('ZZ999999'))).toEqual(['', '', ''])
    expect(legacyCategoryOf(item(''))).toEqual(['', '', ''])
  })
})

describe('새 분류(lclsSystm) → 시간대·종류', () => {
  it('타워·전망대는 저녁 칸, 전망 종류', () => {
    expect(classify(item('VE010200', 'N서울타워'))).toEqual({ slots: ['저녁'], kind: 'viewpoint' })
  })

  it('고궁·유적은 오전·오후, 역사 종류', () => {
    expect(classify(item('HS010100', '경복궁'))).toEqual({ slots: ['오전', '오후 카페'], kind: 'history' })
  })

  it('박물관은 오후·오전, 전시 종류', () => {
    expect(classify(item('VE070100', '국립중앙박물관'), '14')).toEqual({ slots: ['오후 카페', '오전'], kind: 'museum' })
  })

  it('시장은 오전, 시장 종류', () => {
    expect(classify(item('SH060200', '광장시장'))).toEqual({ slots: ['오전'], kind: 'market' })
  })

  it('자연은 오전·오후, 자연 종류', () => {
    expect(classify(item('NA040700', '서울식물원'))).toEqual({ slots: ['오전', '오후 카페'], kind: 'nature' })
  })
})

describe('isTouristSpot', () => {
  it('도서관·학교·수련시설·교통시설은 코스 후보에서 뺀다', () => {
    expect(isTouristSpot(item('VE090300'))).toBe(false) // 도서관
    expect(isTouristSpot(item('VE100200'))).toBe(false) // 스포츠센터·수련시설
    expect(isTouristSpot(item('VE110200'))).toBe(false) // 기차역
  })

  it('관광지와 분류 없는 항목은 남긴다', () => {
    expect(isTouristSpot(item('VE070100'))).toBe(true)
    expect(isTouristSpot(item('VE100100'))).toBe(true) // 스포츠경기장
    expect(isTouristSpot(item(''))).toBe(true)
  })
})
