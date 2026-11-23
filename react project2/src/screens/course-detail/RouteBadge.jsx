// ─────────────────────────────────────────────────────────────
// screens/course-detail/RouteBadge.jsx — 이동 수단 배지
//
// 카드와 카드 사이에 끼는 이동 정보(도보 12분 · 2호선 등).
// 장소만 나열하면 "이 다음 어떻게 가지"가 빠지므로 사이사이에 넣었다.
// ─────────────────────────────────────────────────────────────

import { Icon } from './icons.jsx'
import { RAIL_GRID } from './railGrid.js'

export function RouteBadge({ route }) {
  if (!route) return null
  const walk = route.mode === 'walk'
  const icon = walk ? 'walk' : route.mode === 'car' ? 'car' : 'bus'
  const text = [route.line, route.duration, route.fare].filter(Boolean).join(' · ')
  return (
    <div className={`${RAIL_GRID} tw-items-center`}>
      <span aria-hidden="true" />
      <div className="tw-flex tw-justify-center">
        <span className={`tw-grid tw-h-7 tw-w-7 tw-place-items-center tw-rounded-full tw-border ${
          walk ? 'tw-border-cwalk/30 tw-bg-cwalk-soft tw-text-cwalk' : 'tw-border-croute/25 tw-bg-croute-soft tw-text-croute'
        }`}>
          <Icon name={icon} size={14} stroke={2.2} />
        </span>
      </div>
      <span className={`tw-py-1.5 tw-text-[14px] tw-font-semibold tw-tabular-nums ${walk ? 'tw-text-cwalk' : 'tw-text-cink-muted'}`}>
        {text || '이동'}
      </span>
    </div>
  )
}
