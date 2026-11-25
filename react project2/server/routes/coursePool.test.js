import express from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  searchAttractions: vi.fn(),
  searchCultureSpots: vi.fn(),
  searchRestaurants: vi.fn(),
  searchCafes: vi.fn(),
  fetchPlaceDetailsMany: vi.fn(),
  fetchTransitAccessMany: vi.fn(),
  fetchGoogleHoursMany: vi.fn(),
  enrichPlaces: vi.fn(),
  findCachedByIds: vi.fn(),
  findCityPool: vi.fn(),
  upsertPlaces: vi.fn(),
  updatePlaceImages: vi.fn(),
  updatePlaces: vi.fn(),
}))

vi.mock('../tourApi.js', () => ({
  searchAttractions: m.searchAttractions,
  searchCultureSpots: m.searchCultureSpots,
  fetchPlaceDetailsMany: m.fetchPlaceDetailsMany,
}))
vi.mock('../kakaoLocal.js', () => ({ searchRestaurants: m.searchRestaurants, searchCafes: m.searchCafes }))
vi.mock('../transit.js', () => ({ fetchTransitAccessMany: m.fetchTransitAccessMany }))
vi.mock('../placeEnrich.js', () => ({ enrichPlaces: m.enrichPlaces }))
vi.mock('../googlePlaces.js', () => ({
  fetchGoogleHoursMany: m.fetchGoogleHoursMany,
  googlePhotoPath: (ref) => (ref ? `/api/place-photo?ref=${ref}` : null),
}))
vi.mock('../placeCache.js', () => ({
  findCachedByIds: m.findCachedByIds,
  findCityPool: m.findCityPool,
  upsertPlaces: m.upsertPlaces,
  updatePlaceImages: m.updatePlaceImages,
  updatePlaces: m.updatePlaces,
  toPoolPlace: (row) => ({ name: row.name }),
}))

const { buildCityPoolRows, router } = await import('./coursePool.js')

const tourPlace = {
  id: 'tour-1', source: 'tourapi', name: '경복궁', address: '서울특별시 종로구', lat: 37.57, lng: 126.97,
  slots: ['오전'], category: 'A02', contentTypeId: '12', image: 'http://img/1.jpg',
}
const cachedTourRow = {
  id: 'tour-1', source: 'tourapi', themes: '["history"]', budgetTiers: '[]', reason: 'r', caution: 'c',
  parking: '주차 50대', openHoursText: '09:00~18:00', closedDayText: '매주 화요일', opensAt: 540, closesAt: 1080,
  alwaysOpen: false, closedWeekdays: '[2]', feeText: '3,000원', costTier: 'low',
  transitStation: '경복궁역', transitDistanceM: 150, transitScore: 'good', imageUrl: 'http://img/1.jpg', hoursFetchedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  m.searchAttractions.mockResolvedValue([tourPlace])
  m.searchCultureSpots.mockResolvedValue([])
  m.searchRestaurants.mockResolvedValue([])
  m.searchCafes.mockResolvedValue([])
  m.enrichPlaces.mockResolvedValue(new Map())
  m.fetchGoogleHoursMany.mockResolvedValue(new Map())
  m.findCachedByIds.mockResolvedValue([cachedTourRow])
  m.upsertPlaces.mockResolvedValue()
})

describe('도시 풀 갱신: 외부 조회 실패 시 기존 캐시 보존', () => {
  it('TourAPI 상세·교통 조회가 실패(null)하면 DB 에 있던 값을 그대로 유지한다', async () => {
    m.fetchPlaceDetailsMany.mockResolvedValue(new Map([['tour-1', null]]))
    m.fetchTransitAccessMany.mockResolvedValue(new Map([['tour-1', null]]))

    const [row] = await buildCityPoolRows('서울')

    expect(row.openHoursText).toBe('09:00~18:00')
    expect(row.closedDayText).toBe('매주 화요일')
    expect(row.opensAt).toBe(540)
    expect(row.closesAt).toBe(1080)
    expect(row.closedWeekdays).toBe('[2]')
    expect(row.parking).toBe('주차 50대')
    expect(row.feeText).toBe('3,000원')
    expect(row.costTier).toBe('low')
    expect(row.transitStation).toBe('경복궁역')
    expect(row.transitDistanceM).toBe(150)
    expect(row.transitScore).toBe('good')
  })

  it('조회가 성공해 "정보 없음"이면 그 결과를 따른다(캐시로 덮지 않는다)', async () => {
    m.fetchPlaceDetailsMany.mockResolvedValue(
      new Map([['tour-1', { parking: null, openHoursText: null, closedDayText: null, closedWeekdays: [], opensAt: null, closesAt: null, alwaysOpen: false }]]),
    )
    m.fetchTransitAccessMany.mockResolvedValue(
      new Map([['tour-1', { transitStation: null, transitDistanceM: null, transitScore: 'none' }]]),
    )

    const [row] = await buildCityPoolRows('서울')

    expect(row.openHoursText).toBeNull()
    expect(row.parking).toBeNull()
    expect(row.transitScore).toBe('none')
  })

  it('캐시가 없는 새 장소는 실패해도 예전처럼 빈 값으로 저장한다', async () => {
    m.findCachedByIds.mockResolvedValue([])
    m.fetchPlaceDetailsMany.mockResolvedValue(new Map([['tour-1', null]]))
    m.fetchTransitAccessMany.mockResolvedValue(new Map([['tour-1', null]]))

    const [row] = await buildCityPoolRows('서울')

    expect(row.openHoursText).toBeNull()
    expect(row.transitScore).toBe('none')
  })
})

describe('사진 보강: Google 호출 상한과 시도 기록', () => {
  const day = 24 * 60 * 60 * 1000
  const kakaoRow = (n, extra = {}) => ({
    id: `kakao-${n}`, source: 'kakao', imageUrl: null, hoursFetchedAt: null, name: `가게${n}`, address: '', lat: 37, lng: 127, ...extra,
  })
  const found = (extra = {}) => ({
    openHoursText: '매일 10:00~20:00', closedDayText: null, opensAt: 600, closesAt: 1200, alwaysOpen: false,
    closedWeekdays: [], feeText: '보통', costTier: 'mid', rating: 4.5, userRatingCount: 120,
    editorialSummary: null, websiteUrl: null, photoRef: null, ...extra,
  })

  // 백그라운드 보강이 끝날 때까지 기다린다(보강은 응답 뒤에 돈다).
  async function triggerBackfill(city, rows) {
    m.findCityPool.mockResolvedValue({ rows, stale: false })
    const app = express()
    app.use(router)
    const server = app.listen(0)
    try {
      await fetch(`http://127.0.0.1:${server.address().port}/api/course-pool?city=${encodeURIComponent(city)}`)
      await vi.waitFor(() => expect(m.updatePlaces).toHaveBeenCalled(), { timeout: 2000 })
    } finally {
      server.close()
    }
  }
  const savedById = () => Object.fromEntries(m.updatePlaces.mock.calls[0][0].map((u) => [u.id, u.data]))

  it('한 번에 최대 60곳만 Google 에 묻는다', async () => {
    m.fetchGoogleHoursMany.mockResolvedValue(new Map())
    await triggerBackfill('부산', Array.from({ length: 100 }, (_, i) => kakaoRow(i)))
    expect(m.fetchGoogleHoursMany.mock.calls[0][0]).toHaveLength(60)
  })

  it('7일 안에 이미 물어본 장소는 건너뛴다', async () => {
    const recent = kakaoRow(1, { hoursFetchedAt: new Date(Date.now() - 2 * day) })
    const old = kakaoRow(2, { hoursFetchedAt: new Date(Date.now() - 10 * day) })
    m.fetchGoogleHoursMany.mockResolvedValue(new Map([['kakao-2', null]]))
    await triggerBackfill('제주', [recent, old, kakaoRow(3)])
    expect(m.fetchGoogleHoursMany.mock.calls[0][0].map((r) => r.id).sort()).toEqual(['kakao-2', 'kakao-3'])
  })

  it('Google 이 정상 응답으로 못 찾은 장소(null)는 조회 시각만 남긴다', async () => {
    m.fetchGoogleHoursMany.mockResolvedValue(new Map([['kakao-1', null]]))
    await triggerBackfill('대구', [kakaoRow(1)])
    const data = savedById()['kakao-1']
    expect(Object.keys(data)).toEqual(['hoursFetchedAt'])
  })

  it('호출이 실패한 장소(Map 에 없음)는 아무것도 기록하지 않는다 — 일시 장애를 "없는 가게"로 굳히지 않는다', async () => {
    m.fetchGoogleHoursMany.mockResolvedValue(new Map([['kakao-2', null]])) // kakao-1 은 실패해서 빠짐
    await triggerBackfill('광주', [kakaoRow(1), kakaoRow(2)])
    expect(Object.keys(savedById())).toEqual(['kakao-2'])
  })

  it('API 키가 없어 Map 이 비면 아무 장소도 기록하지 않는다', async () => {
    m.fetchGoogleHoursMany.mockResolvedValue(new Map())
    m.findCityPool.mockResolvedValue({ rows: [kakaoRow(1), kakaoRow(2)], stale: false })
    const app = express()
    app.use(router)
    const server = app.listen(0)
    try {
      await fetch(`http://127.0.0.1:${server.address().port}/api/course-pool?city=${encodeURIComponent('대전')}`)
      await vi.waitFor(() => expect(m.fetchGoogleHoursMany).toHaveBeenCalled(), { timeout: 2000 })
      await new Promise((resolve) => setTimeout(resolve, 50))
    } finally {
      server.close()
    }
    expect(m.updatePlaces).toHaveBeenCalledWith([]) // 기록할 것이 없다
  })

  it('찾았으면 사진과 함께 이미 받은 영업시간·별점도 저장한다(사진이 없어도)', async () => {
    m.fetchGoogleHoursMany.mockResolvedValue(
      new Map([
        ['kakao-1', found({ photoRef: 'places/a/photos/b' })],
        ['kakao-2', found()], // 찾았지만 사진 없음
      ]),
    )
    await triggerBackfill('울산', [kakaoRow(1), kakaoRow(2)])
    const saved = savedById()
    expect(saved['kakao-1'].imageUrl).toBe('/api/place-photo?ref=places/a/photos/b')
    expect(saved['kakao-1'].openHoursText).toBe('매일 10:00~20:00')
    expect(saved['kakao-1'].rating).toBe(4.5)
    expect(saved['kakao-1'].hoursFetchedAt).toBeInstanceOf(Date)
    expect(saved['kakao-2'].imageUrl).toBeUndefined()
    expect(saved['kakao-2'].openHoursText).toBe('매일 10:00~20:00')
    expect(saved['kakao-2'].hoursFetchedAt).toBeInstanceOf(Date) // 사진이 없어도 기록돼 7일 가드가 적용된다
  })
})
