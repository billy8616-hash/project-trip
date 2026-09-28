// ─────────────────────────────────────────────────────────────
// components/FootprintMapWidget.jsx — "나의 발자국 지도" ([내 여행] 페이지 미니 위젯)
//
// 지도 자체는 KoreaFootprintMap이 그리고, 이 컴포넌트는 카드 레이아웃(제목 · 지도 ·
// 방문 요약 · "전체 지도 보기" 버튼)만 맡는다. 버튼을 누르면 같은 지도를 크게 보여주는
// FootprintMapScreen으로 이동한다(onViewFullMap).
//
// cities는 가상 데이터가 아니라 실제 저장된 여행에서 뽑아낸 것이다
// (MyTripsScreen이 lib/footprint.js의 deriveVisitedCities로 만들어 넘긴다).
// ─────────────────────────────────────────────────────────────

import { KoreaFootprintMap } from './KoreaFootprintMap.jsx'
import { TOTAL_REGIONS } from '../lib/footprint.js'

export default function FootprintMapWidget({ cities = [], onViewFullMap }) {
  const visitedRegionCount = new Set(cities.map((city) => city.region).filter(Boolean)).size
  const percent = Math.round((visitedRegionCount / TOTAL_REGIONS) * 100)

  return (
    <div className="tw-w-full tw-max-w-sm tw-rounded-3xl tw-bg-white tw-p-5 tw-shadow-md">
      <h3 className="tw-mb-3 tw-text-base tw-font-bold tw-text-neutral-800">나의 발자국 지도</h3>

      <div className="tw-relative tw-aspect-[4/5] tw-w-full tw-overflow-hidden tw-rounded-2xl tw-bg-sky-50">
        {cities.length > 0 ? (
          <KoreaFootprintMap cities={cities} width={400} height={500} scale={5000} markerRadius={14} />
        ) : (
          <p className="tw-flex tw-h-full tw-items-center tw-justify-center tw-px-6 tw-text-center tw-text-sm tw-text-neutral-400">
            아직 저장된 여행에 발자국을 남길 곳이 없어요.
          </p>
        )}
      </div>

      <div className="tw-mt-4 tw-flex tw-items-center tw-justify-between tw-gap-3">
        <p className="tw-text-sm tw-text-neutral-500">
          전국 {TOTAL_REGIONS}개 시·도 중{' '}
          <span className="tw-font-semibold tw-text-orange-500">{visitedRegionCount}곳</span> 방문 ({percent}%)
        </p>
        <button
          type="button"
          onClick={onViewFullMap}
          className="tw-shrink-0 tw-rounded-full tw-border tw-border-neutral-200 tw-px-3.5 tw-py-1.5 tw-text-xs tw-font-semibold tw-text-neutral-600 tw-transition-colors hover:tw-border-orange-300 hover:tw-text-orange-500"
        >
          전체 지도 보기
        </button>
      </div>
    </div>
  )
}
