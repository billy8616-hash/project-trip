// ─────────────────────────────────────────────────────────────
// screens/course-detail/TimelinePanel.jsx — 왼쪽 패널 전체
//
// 카드 사이사이에 이동 정보를 끼워 넣는 일을 여기서 한다
// (routeByFrom 으로 "이 장소에서 출발하는 구간"을 빠르게 찾는다).
// ─────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import { AddPlaceRow } from './AddPlaceRow.jsx'
import { AnchorCard } from './AnchorCard.jsx'
import { DaySummaryHeader } from './DaySummaryHeader.jsx'
import { PlaceCard } from './PlaceCard.jsx'
import { RouteBadge } from './RouteBadge.jsx'

export function TimelinePanel({
  day, days, activeDay, onSelectDay, places, routes, selectedIndex, onPick, onMovePlace,
  pool, excludeNames, onAddPlace, onGeocode, startAnchor, endAnchor,
}) {
  const routeByFrom = useMemo(() => {
    const m = {}
    ;(routes || []).forEach((r) => { m[r.from] = r })
    return m
  }, [routes])

  return (
    <div className="tw-flex tw-min-h-0 tw-flex-1 tw-flex-col tw-border-cline lg:tw-flex-none lg:tw-w-[47%] lg:tw-min-w-[360px] lg:tw-max-w-[620px] lg:tw-border-l">
      <DaySummaryHeader day={day} days={days} activeDay={activeDay} onSelectDay={onSelectDay} count={places.length} />
      <div className="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-overflow-x-hidden tw-px-5 tw-py-5">
        {/* 맨 위에 둔다 — 목록 끝(스크롤을 한참 내려야 하는 자리)에 있으면 검색 결과가 화면
            밖으로 가려지기 쉽고, 찾기도 번거롭다. 여기 있으면 화면을 열자마자 바로 보인다.
            시간대 순서는 그대로 지켜진다 — 여기서 골라도 실제로는 CourseDetail 을 부르는 쪽에서
            assignedSlot(오전/점심/오후/저녁)에 맞는 자리에 알아서 끼워 넣는다(insertManualBySlot). */}
        {onAddPlace && <AddPlaceRow pool={pool} excludeNames={excludeNames} onAdd={onAddPlace} onGeocode={onGeocode} />}
        {places.length === 0 && (
          <p className="tw-py-10 tw-text-center tw-text-sm tw-text-cink-faint">이 날은 아직 장소가 없어요.</p>
        )}

        {/* 하루의 시작점 — 출발지를 입력했을 때만 나온다.
            장소가 하나도 없는 날에는 시작점·끝점만 덩그러니 남아 이상하므로 함께 감춘다. */}
        {places.length > 0 && <AnchorCard anchor={startAnchor} position="start" />}

        {places.map((place, i) => (
          <div key={place.id}>
            {i > 0 && <RouteBadge route={routeByFrom[places[i - 1].id]} />}
            <PlaceCard
              place={place}
              isFirst={i === 0}
              isLast={i === places.length - 1}
              isActive={i === selectedIndex}
              onPick={() => onPick && onPick(i, place)}
              onMoveUp={onMovePlace ? () => onMovePlace(i, i - 1) : undefined}
              onMoveDown={onMovePlace ? () => onMovePlace(i, i + 1) : undefined}
            />
          </div>
        ))}

        {/* 하루의 끝점 — 숙소를 입력했으면 숙소, 아니면 출발지로 복귀. */}
        {places.length > 0 && <AnchorCard anchor={endAnchor} position="end" />}
      </div>
    </div>
  )
}
