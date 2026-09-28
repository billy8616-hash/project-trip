// ─────────────────────────────────────────────────────────────
// screens/FootprintMapScreen.jsx — "나의 발자국 지도" 전체 화면
//
// [내 여행] 페이지 위젯(FootprintMapWidget)의 "전체 지도 보기" 버튼으로 들어오는 화면.
// MyTripsScreen과 화면이 분리돼 있어(App.jsx가 screen 전환 시 컴포넌트를 통째로
// 갈아 끼운다) 저장된 여행 목록을 여기서 다시 불러온다 — MyTripsScreen의 state를
// 그대로 이어받을 수 없기 때문이다. 같은 지도(KoreaFootprintMap)를 크게 보여주고,
// 방문한 시·도 목록을 곁들인다.
// ─────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { KoreaFootprintMap } from '../components/KoreaFootprintMap.jsx'
import { deriveVisitedCities, TOTAL_REGIONS } from '../lib/footprint.js'
import { listTrips } from '../lib/tripsApi.js'

export default function FootprintMapScreen({ user, onRequireLogin, onBack, leaving }) {
  const [trips, setTrips] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return undefined
    let alive = true
    listTrips()
      .then((list) => {
        if (alive) setTrips(list)
      })
      .catch((err) => {
        if (alive) setError(err.message || '저장한 여행을 불러오지 못했어요.')
      })
    return () => {
      alive = false
    }
  }, [user])

  const cities = useMemo(() => deriveVisitedCities(trips), [trips])
  const visitedRegions = Array.from(new Set(cities.map((city) => city.region).filter(Boolean)))
  const percent = Math.round((visitedRegions.length / TOTAL_REGIONS) * 100)

  return (
    <section className={leaving ? 'footprint-screen is-leaving' : 'footprint-screen'}>
      <header className="dest-header">
        <button className="back-button" type="button" onClick={onBack}>← 내 여행</button>
        <h1>나의 발자국 지도</h1>
        <p>지금까지 다녀온 곳을 지도에서 한눈에 확인해보세요.</p>
      </header>

      {!user ? (
        <div className="mytrips-empty">
          <b>로그인이 필요해요</b>
          <span>로그인하면 저장한 여행에서 방문한 곳을 지도로 볼 수 있어요.</span>
          <button type="button" className="mytrips-login" onClick={onRequireLogin}>로그인하기</button>
        </div>
      ) : error ? (
        <p className="mytrips-status">{error}</p>
      ) : trips === null ? (
        <p className="mytrips-status">불러오는 중이에요…</p>
      ) : (
        <div className="tw-mx-auto tw-flex tw-max-w-5xl tw-flex-col tw-gap-6 lg:tw-flex-row">
          <div className="tw-relative tw-aspect-square tw-w-full tw-overflow-hidden tw-rounded-3xl tw-bg-sky-50 tw-shadow-md lg:tw-flex-1">
            {cities.length > 0 ? (
              <KoreaFootprintMap cities={cities} scale={5200} />
            ) : (
              <p className="tw-flex tw-h-full tw-items-center tw-justify-center tw-px-6 tw-text-center tw-text-sm tw-text-neutral-400">
                아직 저장된 여행에 발자국을 남길 곳이 없어요.
              </p>
            )}
          </div>

          <div className="tw-w-full tw-shrink-0 tw-rounded-3xl tw-bg-white tw-p-5 tw-shadow-md lg:tw-w-72">
            <p className="tw-text-sm tw-text-neutral-500">
              전국 {TOTAL_REGIONS}개 시·도 중{' '}
              <span className="tw-font-semibold tw-text-orange-500">{visitedRegions.length}곳</span> 방문 ({percent}%)
            </p>
            {visitedRegions.length > 0 && (
              <ul className="tw-mt-4 tw-space-y-2">
                {visitedRegions.map((region) => (
                  <li key={region} className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-text-neutral-700">
                    <span className="tw-h-2 tw-w-2 tw-shrink-0 tw-rounded-full tw-bg-orange-500" aria-hidden="true" />
                    {region}
                    <span className="tw-text-neutral-400">
                      ({cities.filter((city) => city.region === region).map((city) => city.name).join(', ')})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
