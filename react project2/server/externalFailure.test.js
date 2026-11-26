// 외부 API 가 "실패"한 것과 "정말 정보가 없는" 것을 구분하는지 확인한다.
// 구분이 안 되면 갱신 중 일시 장애 한 번이 DB 의 멀쩡한 값을 지워 버린다.
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

const tourPlace = { id: 'tour-1', contentTypeId: '12' }
const jsonResponse = (body, ok = true) => ({ ok, json: async () => body })

async function loadTour(fetchImpl) {
  vi.stubEnv('TOUR_API_KEY', 'k')
  vi.stubGlobal('fetch', fetchImpl)
  return import('./tourApi.js')
}

describe('TourAPI 상세 조회', () => {
  it('호출이 실패하면(한도 소진 등) 장소 값이 null — "정보 없음"과 구분된다', async () => {
    const { fetchPlaceDetailsMany } = await loadTour(async () =>
      jsonResponse({ response: { header: { resultCode: '0022' } } }),
    )
    const result = await fetchPlaceDetailsMany([tourPlace])
    expect(result.get('tour-1')).toBeNull()
  })

  it('네트워크 오류·타임아웃도 null', async () => {
    const { fetchPlaceDetailsMany } = await loadTour(async () => {
      throw new Error('timeout')
    })
    expect((await fetchPlaceDetailsMany([tourPlace])).get('tour-1')).toBeNull()
  })

  it('정상 응답인데 상세 정보가 없으면 빈 상세 객체(null 이 아님)', async () => {
    const { fetchPlaceDetailsMany } = await loadTour(async () =>
      jsonResponse({ response: { header: { resultCode: '0000' }, body: { items: '' } } }),
    )
    const detail = (await fetchPlaceDetailsMany([tourPlace])).get('tour-1')
    expect(detail).not.toBeNull()
    expect(detail.openHoursText).toBeNull()
    expect(detail.closedWeekdays).toEqual([])
  })
})

describe('지하철역 접근성 조회', () => {
  async function loadTransit(fetchImpl) {
    vi.stubEnv('KAKAO_REST_API_KEY', 'k')
    vi.stubGlobal('fetch', fetchImpl)
    return import('./transit.js')
  }
  const place = { id: 'kakao-1', lat: 37.5, lng: 127.0 }

  it('호출 실패는 null — "역 없음(none)"으로 저장되지 않는다', async () => {
    const { fetchTransitAccess } = await loadTransit(async () => jsonResponse({ msg: 'quota' }, false))
    expect(await fetchTransitAccess(place)).toBeNull()
  })

  it('네트워크 오류도 null', async () => {
    const { fetchTransitAccess } = await loadTransit(async () => {
      throw new Error('boom')
    })
    expect(await fetchTransitAccess(place)).toBeNull()
  })

  it('반경 내 역이 정말 없으면 none', async () => {
    const { fetchTransitAccess } = await loadTransit(async () => jsonResponse({ documents: [] }))
    expect(await fetchTransitAccess(place)).toEqual({ transitStation: null, transitDistanceM: null, transitScore: 'none' })
  })

  it('역이 있으면 거리와 등급', async () => {
    const { fetchTransitAccess } = await loadTransit(async () =>
      jsonResponse({ documents: [{ place_name: '강남역', distance: '300' }] }),
    )
    expect(await fetchTransitAccess(place)).toEqual({ transitStation: '강남역', transitDistanceM: 300, transitScore: 'good' })
  })
})

describe('Google Places 조회', () => {
  async function loadGoogle(fetchImpl, key = 'gk') {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', key)
    vi.stubGlobal('fetch', fetchImpl)
    return import('./googlePlaces.js')
  }
  const places = [{ id: 'kakao-1', name: '가게', address: '서울', lat: 37.5, lng: 127.0 }]
  const okBody = (placesList) => jsonResponse({ places: placesList })

  it('정상 응답으로 결과가 없으면 null — Map 에 null 로 들어간다', async () => {
    const { fetchGoogleHoursMany } = await loadGoogle(async () => okBody([]))
    const map = await fetchGoogleHoursMany(places)
    expect(map.has('kakao-1')).toBe(true)
    expect(map.get('kakao-1')).toBeNull()
  })

  it('호출이 실패하면(한도 초과·네트워크 오류) Map 에 아예 넣지 않는다', async () => {
    const { fetchGoogleHoursMany } = await loadGoogle(async () => jsonResponse({ error: 'quota' }, false))
    expect((await fetchGoogleHoursMany(places)).has('kakao-1')).toBe(false)

    vi.resetModules()
    const again = await loadGoogle(async () => {
      throw new Error('timeout')
    })
    expect((await again.fetchGoogleHoursMany(places)).has('kakao-1')).toBe(false)
  })

  it('한 번은 실패하고 한 번은 정상 "결과 없음"이어도 없다고 단정하지 않는다', async () => {
    let calls = 0
    const { fetchGoogleHoursMany } = await loadGoogle(async () => (++calls === 1 ? jsonResponse({}, false) : okBody([])))
    expect((await fetchGoogleHoursMany(places)).has('kakao-1')).toBe(false)
  })

  it('첫 검색이 실패해도 두 번째 검색이 찾으면 결과를 쓴다', async () => {
    let calls = 0
    const { fetchGoogleHoursMany } = await loadGoogle(async () =>
      ++calls === 1 ? jsonResponse({}, false) : okBody([{ id: 'p', rating: 4.2, photos: [{ name: 'places/p/photos/x' }] }]),
    )
    const info = (await fetchGoogleHoursMany(places)).get('kakao-1')
    expect(info.rating).toBe(4.2)
    expect(info.photoRef).toBe('places/p/photos/x')
  })

  it('API 키가 없으면 빈 Map — 아무 장소도 "조회함"으로 보이지 않는다', async () => {
    const fetchSpy = vi.fn()
    const { fetchGoogleHoursMany } = await loadGoogle(fetchSpy, '')
    const map = await fetchGoogleHoursMany(places)
    expect(map.size).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
