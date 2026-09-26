// ─────────────────────────────────────────────────────────────
// screens/CourseDetail.jsx — 완성된 코스를 보여 주는 화면 (좌: 타임라인 / 우: 지도)
//
// 이 프로젝트에서 유일하게 Tailwind 로 스타일링한 화면이다. 나머지 화면은 전부
// 손으로 쓴 index.css 를 쓴다. 전역 도입은 기존 화면을 깨뜨리므로
// preflight(전역 리셋)를 끄고 모든 유틸에 `tw-` 접두사를 붙여 충돌을 막았다
// (tailwind.config.js 참고). 이 화면만 `course-detail-root` 스코프에서
// 필요한 최소 리셋을 받는다.
//
// 설계 원칙: 이 화면은 "표시 전용"이다. 데이터도 지도도 동작도 전부 props 로 받는다.
// 지도조차 mapSlot 이라는 슬롯으로 넘겨받아서, 이 파일은 카카오맵을 전혀 모른다.
// 덕분에 지도 없이도(FallbackMap) 화면을 확인할 수 있다.
//
// 부품들은 screens/course-detail/ 아래 파일별로 나눠 뒀다 (한 파일에 다 있던 걸 쪼갰다).
//   icons·kindStyle·websiteMeta·mockData   공용 조각
//   DaySummaryHeader · RouteBadge · PlaceCard · AnchorCard · AddPlaceRow · TimelinePanel  왼쪽
//   FallbackMap · MapControls(MapLegend·ZoomControls·TransportToggle·FloatingActions)     오른쪽
// 이 파일은 그 부품들을 좌우로 배치하는 루트만 맡는다.
// ─────────────────────────────────────────────────────────────

import { FallbackMap } from './course-detail/FallbackMap.jsx'
import { FloatingActions, MapLegend, TransportToggle, ZoomControls } from './course-detail/MapControls.jsx'
import { MOCK_DAY, MOCK_PLACES, MOCK_ROUTES } from './course-detail/mockData.js'
import { TimelinePanel } from './course-detail/TimelinePanel.jsx'

export default function CourseDetail({
  day = MOCK_DAY,
  days,
  activeDay = 0,
  onSelectDay,
  places = MOCK_PLACES,
  routes = MOCK_ROUTES,
  selectedIndex = -1,
  onPickPlace,
  onMovePlace,
  pool,
  excludeNames,
  onAddPlace,
  onGeocode,
  startAnchor,
  endAnchor,
  mapSlot,
  moveLabel,
  transport,
  onChangeTransport,
  actions,
  onZoomIn,
  onZoomOut,
  onRecenter,
}) {
  // 카드/핀을 고르면 상위에 알리고, 왼쪽 카드로 스크롤도 맞춰준다.
  const pick = (index, place) => {
    if (onPickPlace) onPickPlace(index, place)
    const el = document.getElementById(`course-place-${place.id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <div className="course-detail-root tw-flex tw-h-full tw-flex-col tw-overflow-hidden tw-bg-cbg tw-font-csans tw-text-cink lg:tw-flex-row">
      <TimelinePanel
        day={day} days={days} activeDay={activeDay} onSelectDay={onSelectDay}
        places={places} routes={routes} selectedIndex={selectedIndex} onPick={pick} onMovePlace={onMovePlace}
        pool={pool} excludeNames={excludeNames} onAddPlace={onAddPlace} onGeocode={onGeocode}
        startAnchor={startAnchor} endAnchor={endAnchor}
      />

      {/* 데스크톱 폭에서는 지도가 왼쪽, 코스 목록이 오른쪽에 오도록 순서만 뒤집는다
          (lg:tw-order-*). DOM 순서는 그대로 둬서 모바일(세로 쌓기)에서는
          코스 목록이 위, 지도가 아래인 기존 배치를 그대로 유지한다. */}
      <div className="tw-relative tw-h-[34vh] tw-w-full tw-shrink-0 lg:tw-order-first lg:tw-h-auto lg:tw-flex-1 lg:tw-p-4">
        <div
          className="tw-relative tw-h-full tw-w-full tw-overflow-hidden tw-bg-surface-2 lg:tw-rounded-cxl lg:tw-border lg:tw-border-cline lg:tw-shadow-ccard"
          style={{ backgroundImage: 'radial-gradient(rgba(43,42,39,0.07) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
        >
          <MapLegend moveLabel={moveLabel} />
          <ZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} onRecenter={onRecenter} />
          {/* 실제 지도(mapSlot)가 있으면 그걸, 없으면 내장 일러스트 지도 */}
          <div className="tw-absolute tw-inset-0">
            {mapSlot || (
              <div className="tw-h-full tw-w-full tw-p-4">
                <FallbackMap places={places} routes={routes} onPick={pick} />
              </div>
            )}
          </div>
          {/* 데스크톱에서만 지도를 lg:tw-p-4 만큼 안쪽으로 들이므로(카드처럼 여백을 두려고),
              화면 벽에 붙는 오버레이(이동수단 토글·저장/공유 버튼)도 같은 컨테이너 안에 둬야
              그 여백을 함께 받는다 — 밖에 두면 absolute 위치가 바깥 벽 기준으로 계산돼 여백 밖으로 삐져나온다. */}
          <TransportToggle value={transport} onChange={onChangeTransport} />
          <FloatingActions actions={actions} />
        </div>
      </div>
    </div>
  )
}
