import { describe, expect, it } from 'vitest'
import { buildCourse, insertManualBySlot, rainScoreAdjust, transportAdjust } from './course.js'

const KM_PER_DEG = (6371 * Math.PI) / 180

// 서로 가까운(약 수백 m 간격) 장소 하나. slots 는 그 장소가 어울리는 시간대 태그.
let seq = 0
function makePlace(name, slots, extra = {}) {
  seq += 1
  return {
    name,
    slots,
    themes: [],
    budgetTiers: [],
    location: { lat: 35 + (seq * 0.3) / KM_PER_DEG, lng: 127 },
    ...extra,
  }
}

const base = (pool) => ({ title: '테스트 도시', subtitle: '', center: { lat: 35, lng: 127 }, pool })

// 시간대마다 후보가 충분한 풀: 오전 2 / 점심 2 / 카페 2 / 저녁 2
const fullPool = () => [
  makePlace('오전A', ['오전']),
  makePlace('오전B', ['오전']),
  makePlace('점심A', ['점심 맛집']),
  makePlace('점심B', ['점심 맛집']),
  makePlace('카페A', ['오후 카페']),
  makePlace('카페B', ['오후 카페']),
  makePlace('저녁A', ['저녁']),
  makePlace('저녁B', ['저녁']),
]

const namesOf = (course) => course.days.map((day) => day.places.map((p) => p.name))

describe('rainScoreAdjust', () => {
  it('맑은 날은 보정이 없다', () => {
    expect(rainScoreAdjust({ name: '해수욕장' }, false)).toBe(0)
  })

  it('비 오는 날: 야외는 감점, 고궁류는 소폭 감점, 실내는 가점', () => {
    expect(rainScoreAdjust({ name: '중앙공원' }, true)).toBe(-7)
    expect(rainScoreAdjust({ name: '경복궁 고궁' }, true)).toBe(-3)
    expect(rainScoreAdjust({ name: '국립박물관' }, true)).toBe(4)
    expect(rainScoreAdjust({ name: '아무 곳' }, true)).toBe(0)
  })
})

describe('transportAdjust', () => {
  it('자차: 주차 안내 문구로 가감점', () => {
    expect(transportAdjust({ parking: '주차 불가' }, '자차', true)).toBe(-3)
    expect(transportAdjust({ parking: '무료 주차장 있음' }, '자차', true)).toBe(1)
    expect(transportAdjust({}, '자차', true)).toBe(0)
  })

  it('대중교통·도보: 지하철역 등급으로 가감점', () => {
    expect(transportAdjust({ transitScore: 'good' }, '대중교통', true)).toBe(3)
    expect(transportAdjust({ transitScore: 'none' }, '도보', true)).toBe(-4)
  })

  it('지하철이 없는 도시에서는 역 등급으로 감점하지 않는다', () => {
    expect(transportAdjust({ transitScore: 'none' }, '대중교통', false)).toBe(0)
  })
})

describe('insertManualBySlot', () => {
  const ordered = [
    { name: '오전', assignedSlot: '오전' },
    { name: '점심', assignedSlot: '점심 맛집' },
    { name: '저녁', assignedSlot: '저녁' },
  ]

  it('직접 추가한 장소를 자기 시간대 자리에 끼워 넣는다', () => {
    const result = insertManualBySlot(ordered, [{ name: '카페', assignedSlot: '오후 카페' }])
    expect(result.map((p) => p.name)).toEqual(['오전', '점심', '카페', '저녁'])
  })

  it('가장 늦은 시간대면 맨 뒤에 붙는다', () => {
    const result = insertManualBySlot(ordered, [{ name: '야식', assignedSlot: '저녁' }])
    expect(result.map((p) => p.name)).toEqual(['오전', '점심', '저녁', '야식'])
  })

  it('추가할 것이 없으면 원본 그대로, 원본 배열은 바꾸지 않는다', () => {
    expect(insertManualBySlot(ordered, [])).toBe(ordered)
    insertManualBySlot(ordered, [{ name: '카페', assignedSlot: '오후 카페' }])
    expect(ordered).toHaveLength(3)
  })
})

describe('buildCourse', () => {
  it('하루에 네 시간대를 한 곳씩 채우고 도착 시각이 순서대로 늘어난다', () => {
    const course = buildCourse(base(fullPool()), null, null)
    const [day] = course.days
    expect(day.places.map((p) => p.assignedSlot)).toEqual(['오전', '점심 맛집', '오후 카페', '저녁'])
    const arrivals = day.places.map((p) => p.arriveMin)
    expect([...arrivals].sort((a, b) => a - b)).toEqual(arrivals)
    expect(course.places).toHaveLength(4)
  })

  it('여러 날 코스에서 같은 장소를 두 번 넣지 않는다', () => {
    const course = buildCourse(base(fullPool()), null, null, [], {}, '대중교통', { dayCount: 2 })
    const all = namesOf(course).flat()
    expect(course.days).toHaveLength(2)
    expect(new Set(all).size).toBe(all.length)
  })

  it('점수가 같으면 풀의 앞쪽 장소가 먼저 뽑힌다', () => {
    const course = buildCourse(base(fullPool()), null, null)
    expect(namesOf(course)[0]).toEqual(['오전A', '점심A', '카페A', '저녁A'])
  })

  it('테마가 맞는 장소가 우선한다', () => {
    const pool = fullPool()
    pool[1].themes = ['sns'] // 오전B 만 테마 일치
    const course = buildCourse(base(pool), 'sns', null)
    expect(namesOf(course)[0]).toContain('오전B')
    expect(namesOf(course)[0]).not.toContain('오전A')
  })

  it('비 오는 날은 야외 대신 실내 장소를 고른다', () => {
    const pool = fullPool()
    pool[0] = makePlace('중앙공원', ['오전']) // 야외 (풀의 앞쪽)
    pool[1] = makePlace('국립박물관', ['오전']) // 실내
    const dry = buildCourse(base(pool), null, null, [], {}, '대중교통', { wetDays: [false] })
    const wet = buildCourse(base(pool), null, null, [], {}, '대중교통', { wetDays: [true] })
    expect(namesOf(dry)[0]).toContain('중앙공원')
    expect(namesOf(wet)[0]).toContain('국립박물관')
    expect(wet.notices.some((n) => n.includes('비·눈'))).toBe(true)
  })

  it('여행 날짜에 쉬는 곳은 후보에서 빼고 안내한다', () => {
    const pool = fullPool()
    pool[0].closedWeekdays = [1] // 오전A: 월요일 휴무
    const course = buildCourse(base(pool), null, null, [], {}, '대중교통', { tripDate: '2026-10-19' }) // 월요일
    expect(namesOf(course)[0]).not.toContain('오전A')
    expect(course.notices.some((n) => n.includes('쉬는 곳'))).toBe(true)
  })

  it('휴무 필터를 적용하면 후보가 슬롯 수보다 적어질 때는 필터를 포기한다', () => {
    const pool = fullPool().slice(0, 4)
    pool.forEach((place) => { place.closedWeekdays = [1] })
    const course = buildCourse(base(pool), null, null, [], {}, '대중교통', { tripDate: '2026-10-19' })
    expect(course.days[0].places).toHaveLength(4)
  })

  it('꼭 가고 싶은 곳이 풀에 있으면 반드시 넣고 mustVisit 표시를 붙인다', () => {
    const pool = fullPool()
    pool.push(makePlace('전동성당', ['오전']))
    const course = buildCourse(base(pool), null, null, ['전동성당'])
    const picked = course.days[0].places.find((p) => p.name === '전동성당')
    expect(picked).toBeDefined()
    expect(picked.mustVisit).toBe(true)
  })

  it('풀에 없는 필수 방문지는 이름만 가진 카드로 넣고 안내한다', () => {
    const course = buildCourse(base(fullPool()), null, null, ['동네 작은 가게'])
    const manual = course.days[0].places.find((p) => p.name === '동네 작은 가게')
    expect(manual).toMatchObject({ manual: true, mustVisit: true, location: null })
    expect(course.notices.some((n) => n.includes('동네 작은 가게'))).toBe(true)
  })

  it('필수 방문지가 휴무일이어도 빼지 않고 안내만 한다', () => {
    const pool = fullPool()
    pool.push(makePlace('월요일휴무관', ['오전'], { closedWeekdays: [1] }))
    const course = buildCourse(base(pool), null, null, ['월요일휴무관'], {}, '대중교통', { tripDate: '2026-10-19' })
    expect(namesOf(course)[0]).toContain('월요일휴무관')
    expect(course.notices.some((n) => n.includes('쉬는 날일 수 있지만'))).toBe(true)
  })

  it('빈 풀이어도 예외 없이 빈 하루와 안내를 돌려준다', () => {
    const course = buildCourse(base([]), null, null)
    expect(course.days).toHaveLength(1)
    expect(course.days[0].places).toEqual([])
    expect(course.notices.some((n) => n.includes('다 채우지 못했어요'))).toBe(true)
  })

  it('늦게 출발해 도착 시각에 닫혀 있는 곳은 여는 다른 곳으로 바꾼다', () => {
    const pool = fullPool()
    pool[0] = makePlace('일찍닫는곳', ['오전'], { opensAt: 9 * 60, closesAt: 11 * 60 })
    pool[1] = makePlace('늦게닫는곳', ['오전'], { opensAt: 9 * 60, closesAt: 20 * 60 })
    const course = buildCourse(base(pool), null, null, [], {}, '대중교통', { dayStartMin: 11 * 60 + 30 })
    expect(namesOf(course)[0]).not.toContain('일찍닫는곳')
    expect(namesOf(course)[0]).toContain('늦게닫는곳')
    expect(course.notices.some((n) => n.includes('문을 닫는 곳'))).toBe(true)
  })
})
