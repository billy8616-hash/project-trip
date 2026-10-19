import { describe, expect, it } from 'vitest'
import {
  estimateTravelMin,
  formatDurationMin,
  formatMinutes,
  isWithinWalkLimit,
  MAX_WALK_LEG_MIN,
  TRAVEL_FALLBACK,
} from './travelTime.js'

const KM_PER_DEG = (6371 * Math.PI) / 180
const place = (km) => ({ location: { lat: 35 + km / KM_PER_DEG, lng: 127 } })

describe('estimateTravelMin', () => {
  it('좌표가 없으면 교통편별 기본값을 쓴다', () => {
    expect(estimateTravelMin({ name: 'A' }, place(1), '도보')).toBe(TRAVEL_FALLBACK.도보)
    expect(estimateTravelMin(place(1), { name: 'B' }, '대중교통')).toBe(TRAVEL_FALLBACK.대중교통)
    expect(estimateTravelMin({}, {}, '자차')).toBe(TRAVEL_FALLBACK.자차)
  })

  it('알 수 없는 교통편은 20분으로 본다', () => {
    expect(estimateTravelMin({}, {}, '헬기')).toBe(20)
  })

  it('같은 자리여도 최소 1분, 출발·대기 고정 시간이 붙는다', () => {
    expect(estimateTravelMin(place(0), place(0), '도보')).toBe(2)
    expect(estimateTravelMin(place(0), place(0), '대중교통')).toBe(6)
    expect(estimateTravelMin(place(0), place(0), '자차')).toBe(4)
  })

  it('도보는 4.5km/h: 4.5km 면 고정 2분 + 60분', () => {
    expect(estimateTravelMin(place(0), place(4.5), '도보')).toBe(62)
  })

  it('먼 거리에서는 자차 < 대중교통 < 도보 순으로 오래 걸린다', () => {
    const [from, to] = [place(0), place(8)]
    const car = estimateTravelMin(from, to, '자차')
    const transit = estimateTravelMin(from, to, '대중교통')
    const walk = estimateTravelMin(from, to, '도보')
    expect(car).toBeLessThan(transit)
    expect(transit).toBeLessThan(walk)
  })

  it('도보 시간을 상한으로 뭉개지 않고 있는 그대로 돌려준다', () => {
    // 한계(40분)보다 훨씬 먼 20km 는 40분이 아니라 실제 예상 시간이어야 한다
    expect(estimateTravelMin(place(0), place(20), '도보')).toBeGreaterThan(MAX_WALK_LEG_MIN)
  })
})

describe('isWithinWalkLimit', () => {
  it('한계는 40분이다', () => {
    expect(MAX_WALK_LEG_MIN).toBe(40)
  })

  it('가까우면 true, 멀면 false', () => {
    expect(isWithinWalkLimit(place(0), place(1))).toBe(true)
    expect(isWithinWalkLimit(place(0), place(10))).toBe(false)
  })

  it('경계: 2.8km(39분)는 되고 2.9km(41분)는 안 된다', () => {
    expect(isWithinWalkLimit(place(0), place(2.8))).toBe(true)
    expect(isWithinWalkLimit(place(0), place(2.9))).toBe(false)
  })

  it('maxMinutes 로 한계를 바꿀 수 있다', () => {
    expect(isWithinWalkLimit(place(0), place(2.9), 45)).toBe(true)
    expect(isWithinWalkLimit(place(0), place(1), 5)).toBe(false)
  })

  it('좌표가 없으면 도보 기본값(18분) 기준이라 통과한다', () => {
    expect(isWithinWalkLimit({}, {})).toBe(true)
  })
})

describe('시간 표기', () => {
  it('formatDurationMin: 분·시간 단위로 읽기 좋게', () => {
    expect(formatDurationMin(47)).toBe('47분')
    expect(formatDurationMin(60)).toBe('1시간')
    expect(formatDurationMin(136)).toBe('2시간 16분')
    expect(formatDurationMin(-5)).toBe('0분')
  })

  it('formatMinutes: 초를 분으로, 최소 1분', () => {
    expect(formatMinutes(30)).toBe('1분')
    expect(formatMinutes(0)).toBe('1분')
    expect(formatMinutes(600)).toBe('10분')
  })
})
