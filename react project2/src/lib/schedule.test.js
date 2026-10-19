import { describe, expect, it } from 'vitest'
import {
  arrivesAfterClose,
  DEFAULT_DAY_START_MIN,
  formatClock,
  isOpenAround,
  parseClock,
  scheduleDay,
} from './schedule.js'

const HOUR = 60

describe('formatClock / parseClock', () => {
  it('분을 HH:MM 으로, 자정을 넘기면 감아서 표시한다', () => {
    expect(formatClock(570)).toBe('09:30')
    expect(formatClock(24 * HOUR + 60)).toBe('01:00')
    expect(formatClock(-30)).toBe('23:30')
  })

  it('HH:MM 을 분으로 읽는다', () => {
    expect(parseClock('09:30')).toBe(570)
    expect(parseClock('9:05')).toBe(545)
    expect(parseClock(' 18:00 ')).toBe(1080)
  })

  it('형식이 이상하거나 범위를 벗어나면 기본값(09:30)이다', () => {
    expect(parseClock('abc')).toBe(DEFAULT_DAY_START_MIN)
    expect(parseClock('24:00')).toBe(DEFAULT_DAY_START_MIN)
    expect(parseClock('')).toBe(DEFAULT_DAY_START_MIN)
    expect(parseClock(undefined, 600)).toBe(600)
  })
})

describe('scheduleDay', () => {
  // 이름·분류 단서가 없는 장소는 '일반 명소'(체류 50분)로 분류된다.
  const spot = (name, extra = {}) => ({ name, ...extra })

  it('체류시간과 이동시간을 누적해 도착·출발 시각을 매긴다', () => {
    const [a, b] = scheduleDay([spot('가'), spot('나')], { dayStartMin: 9 * HOUR + 30 })
    expect(a.arriveMin).toBe(570)
    expect(a.stayMin).toBe(50)
    expect(a.departMin).toBe(620)
    // 좌표가 없으니 대중교통 기본 이동시간 22분
    expect(a.travelToNextMin).toBe(22)
    expect(b.arriveMin).toBe(642)
    expect(b.travelToNextMin).toBe(0)
  })

  it('점심 슬롯은 12:00 전에 도착하지 않게 밀고, 저녁은 18:00 이다', () => {
    const [lunch, dinner] = scheduleDay([
      spot('식당1', { assignedSlot: '점심 맛집' }),
      spot('식당2', { assignedSlot: '저녁' }),
    ])
    expect(lunch.arriveMin).toBe(12 * HOUR)
    expect(dinner.arriveMin).toBe(18 * HOUR)
  })

  it('앞 일정이 이미 밀려 앵커를 넘겼으면 그대로 진행한다', () => {
    const [, lunch] = scheduleDay([spot('가'), spot('식당', { assignedSlot: '점심 맛집' })], {
      dayStartMin: 12 * HOUR,
    })
    expect(lunch.arriveMin).toBe(12 * HOUR + 50 + 22)
  })

  it('곧 열리는 곳(75분 이내)은 기다렸다 입장한다', () => {
    const [place] = scheduleDay([spot('가', { opensAt: 10 * HOUR, closesAt: 18 * HOUR })], {
      dayStartMin: 9 * HOUR + 30,
    })
    expect(place.arriveMin).toBe(10 * HOUR)
    expect(place.hoursNote).toBeNull()
  })

  it('개장까지 한참 남으면 기다리지 않고 안내만 붙인다', () => {
    const [place] = scheduleDay([spot('가', { opensAt: 12 * HOUR, closesAt: 18 * HOUR })], {
      dayStartMin: 9 * HOUR,
    })
    expect(place.arriveMin).toBe(9 * HOUR)
    expect(place.hoursNote).toContain('개장')
  })

  it('도착 시각이 마감 이후면 마감 안내를 붙인다', () => {
    const [place] = scheduleDay([spot('가', { opensAt: 9 * HOUR, closesAt: 9 * HOUR + 20 })], {
      dayStartMin: 9 * HOUR + 30,
    })
    expect(place.hoursNote).toContain('이미 마감')
  })

  it('머무는 동안 마감되면 "머물 시간이 짧아요" 안내를 붙인다', () => {
    const [place] = scheduleDay([spot('가', { opensAt: 9 * HOUR, closesAt: 10 * HOUR })], {
      dayStartMin: 9 * HOUR + 30, // 50분 체류하면 10:20 → 마감 넘김
    })
    expect(place.hoursNote).toContain('머물 시간이 짧아요')
  })

  it('항상 여는 곳은 영업시간 안내가 없다', () => {
    const [place] = scheduleDay([spot('가', { alwaysOpen: true, opensAt: 0, closesAt: 1 })])
    expect(place.hoursNote).toBeNull()
  })

  it('자연 명소를 19시 이후에 도착하면 어둡다는 안내를 붙인다', () => {
    const [park] = scheduleDay([spot('중앙공원')], { dayStartMin: 19 * HOUR + 10 })
    expect(park.hoursNote).toContain('어두워서')
  })

  it('원본 배열을 바꾸지 않는다', () => {
    const input = [spot('가')]
    scheduleDay(input)
    expect(input[0]).toEqual({ name: '가' })
  })
})

describe('arrivesAfterClose / isOpenAround', () => {
  it('도착 시각이 마감 시각 이상이면 방문 불가', () => {
    expect(arrivesAfterClose({ name: 'x', arriveMin: 18 * HOUR, opensAt: 9 * HOUR, closesAt: 18 * HOUR })).toBe(true)
    expect(arrivesAfterClose({ name: 'x', arriveMin: 17 * HOUR, opensAt: 9 * HOUR, closesAt: 18 * HOUR })).toBe(false)
  })

  it('항상 열거나 영업시간 정보가 없으면 마감 아님', () => {
    expect(arrivesAfterClose({ name: 'x', arriveMin: 23 * HOUR, alwaysOpen: true })).toBe(false)
    expect(arrivesAfterClose({ name: 'x', arriveMin: 23 * HOUR })).toBe(false)
    expect(arrivesAfterClose(null)).toBe(false)
  })

  it('isOpenAround: 영업시간 안이면 true, 정보가 없으면 낙관적으로 true', () => {
    const shop = { name: 'x', opensAt: 9 * HOUR, closesAt: 18 * HOUR }
    expect(isOpenAround(shop, 12 * HOUR)).toBe(true)
    expect(isOpenAround(shop, 18 * HOUR)).toBe(false)
    expect(isOpenAround(shop, 8 * HOUR)).toBe(false)
    expect(isOpenAround({ name: 'x' }, 3 * HOUR)).toBe(true)
    expect(isOpenAround(null, 3 * HOUR)).toBe(true)
  })

  it('isOpenAround: 야외 경관 장소는 19시 이후엔 닫힌 것으로 본다', () => {
    expect(isOpenAround({ name: '중앙공원' }, 19 * HOUR)).toBe(false)
    expect(isOpenAround({ name: '중앙공원' }, 15 * HOUR)).toBe(true)
  })
})
