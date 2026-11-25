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
