import { describe, expect, it } from 'vitest'
import { haversineKm, optimizeRouteOrder, optimizeRouteOrderBySlot } from './geo.js'

// 경도를 고정하고 북쪽으로만 움직이면 haversine 거리가 정확히 R·Δlat 이라 계산 결과를 손으로 검증할 수 있다.
const KM_PER_DEG = (6371 * Math.PI) / 180
const northKm = (km) => ({ lat: 35 + km / KM_PER_DEG, lng: 127 })
const at = (name, km, extra = {}) => ({ name, location: northKm(km), ...extra })

const pathLength = (places, anchors = {}) => {
  const points = [anchors.start, ...places, anchors.end].filter(Boolean)
  let sum = 0
  for (let i = 1; i < points.length; i += 1) sum += haversineKm(points[i - 1].location, points[i].location)
  return sum
}

describe('haversineKm', () => {
  it('같은 지점은 0이고 방향을 바꿔도 같다', () => {
    const seoul = { lat: 37.5665, lng: 126.978 }
    const busan = { lat: 35.1796, lng: 129.0756 }
    expect(haversineKm(seoul, seoul)).toBe(0)
    expect(haversineKm(seoul, busan)).toBeCloseTo(haversineKm(busan, seoul), 9)
  })

  it('서울–부산은 직선으로 약 325km 다', () => {
    const d = haversineKm({ lat: 37.5665, lng: 126.978 }, { lat: 35.1796, lng: 129.0756 })
    expect(d).toBeGreaterThan(315)
    expect(d).toBeLessThan(335)
  })

  it('북쪽으로 1km 움직이면 1km 다', () => {
    expect(haversineKm(northKm(0), northKm(1))).toBeCloseTo(1, 6)
  })
})

describe('optimizeRouteOrder', () => {
  it('좌표가 2곳 미만이면 그대로 둔다', () => {
    const only = at('A', 0)
    expect(optimizeRouteOrder([only])).toEqual([only])
    expect(optimizeRouteOrder([])).toEqual([])
  })

  it('좌표 없는 장소는 모두 맨 뒤에 붙고 하나도 사라지지 않는다', () => {
    const places = [at('A', 0), { name: '이름만' }, at('B', 5), at('C', 1)]
    const result = optimizeRouteOrder(places)
    expect(result.map((p) => p.name).sort()).toEqual(['A', 'B', 'C', '이름만'])
    expect(result[result.length - 1].name).toBe('이름만')
  })

  it('앵커가 없으면 첫 장소를 시작점으로 유지하고 왔다 갔다를 없앤다', () => {
    // 일직선 위에서 0 → 3 → 1 → 2 로 지그재그인 입력
    const places = [at('A', 0), at('B', 3), at('C', 1), at('D', 2)]
    const result = optimizeRouteOrder(places)
    expect(result[0].name).toBe('A')
    expect(result.map((p) => p.name)).toEqual(['A', 'C', 'D', 'B'])
    expect(pathLength(result)).toBeLessThan(pathLength(places))
  })

  it('출발지·도착지 앵커가 있으면 그 사이 총거리가 최소가 되도록 정렬한다', () => {
    const start = { location: northKm(0) }
    const end = { location: northKm(10) }
    const places = [at('C', 7), at('A', 2), at('B', 5)]
    const result = optimizeRouteOrder(places, { start, end })
    expect(result.map((p) => p.name)).toEqual(['A', 'B', 'C'])
    expect(pathLength(result, { start, end })).toBeCloseTo(10, 6)
  })
})

describe('optimizeRouteOrderBySlot', () => {
  it('저녁 장소가 지리적으로 더 가까워도 시간대 순서(오전→저녁)는 뒤집히지 않는다', () => {
    const start = { location: northKm(0) }
    const places = [
      at('저녁집', 0.5, { assignedSlot: '저녁' }),
      at('아침 명소', 8, { assignedSlot: '오전' }),
    ]
    const result = optimizeRouteOrderBySlot(places, { start })
    expect(result.map((p) => p.name)).toEqual(['아침 명소', '저녁집'])
  })

  it('알 수 없는 시간대 라벨은 맨 뒤에 붙고 조용히 사라지지 않는다', () => {
    const places = [
      at('X', 1, { assignedSlot: '야식' }),
      at('A', 2, { assignedSlot: '오전' }),
    ]
    const result = optimizeRouteOrderBySlot(places)
    expect(result.map((p) => p.name)).toEqual(['A', 'X'])
  })
})
