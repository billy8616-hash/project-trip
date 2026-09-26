// ─────────────────────────────────────────────────────────────
// screens/course-detail/AnchorCard.jsx — 출발지·숙소 카드
//
// 코스에 "들르는 장소"가 아니라 하루의 시작점·끝점이라서, 번호도 붙지 않고
// 순서를 바꾸거나 지울 수도 없다. 장소 카드(PlaceCard)와 생김새를 일부러 다르게 해서
// 사용자가 둘을 헷갈리지 않게 했다.
//
// 지도에도 같은 지점이 '출발'·'숙소' 마커로 찍혀 있다(KakaoRouteMap 의 stops).
// 타임라인에만 빠져 있으면 "숙소를 적었는데 코스에 없다"고 느끼게 되므로 여기서 함께 보여 준다.
// ─────────────────────────────────────────────────────────────

import { Icon } from './icons.jsx'

export function AnchorCard({ anchor, position }) {
  if (!anchor?.name) return null

  const isStart = position === 'start'
  const icon = isStart ? 'flag' : anchor.kind === 'lodging' ? 'bed' : 'flag'
  const label = isStart ? '출발' : anchor.kind === 'lodging' ? '숙소' : '복귀'
  const hint = isStart
    ? '여기서 하루를 시작해요'
    : anchor.kind === 'lodging'
      ? '마지막 일정을 마치고 숙소로 돌아가요'
      : '마지막 일정을 마치고 출발지로 돌아와요'

  return (
    <div className="tw-grid tw-grid-cols-[32px_minmax(0,1fr)] tw-gap-3">
      <div className="tw-flex tw-flex-col tw-items-center">
        <div className="tw-grid tw-h-7 tw-w-7 tw-place-items-center tw-rounded-full tw-border tw-border-cline tw-bg-surface-2 tw-text-cink-muted">
          <Icon name={icon} size={14} stroke={2.2} />
        </div>
        {isStart && <div className="tw-mt-1.5 tw-w-px tw-flex-1 tw-bg-cline" />}
      </div>

      <div className="tw-mb-4 tw-rounded-cxl tw-border tw-border-dashed tw-border-cline tw-bg-surface-2 tw-px-4 tw-py-3">
        <div className="tw-flex tw-items-center tw-gap-2">
          <span className="tw-rounded-md tw-bg-surface tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-cink-muted">
            {label}
          </span>
          <b className="tw-truncate tw-text-[14px] tw-font-semibold tw-text-cink">{anchor.name}</b>
        </div>
        {anchor.address && (
          <p className="tw-mt-1 tw-truncate tw-text-[12px] tw-text-cink-faint">{anchor.address}</p>
        )}
        <p className="tw-mt-1 tw-text-[12px] tw-text-cink-muted">{hint}</p>
      </div>
    </div>
  )
}
