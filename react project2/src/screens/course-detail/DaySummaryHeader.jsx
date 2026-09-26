// ─────────────────────────────────────────────────────────────
// screens/course-detail/DaySummaryHeader.jsx — 일정 요약 헤더 (+ 여러 날이면 Day 탭)
//
// 타임라인 맨 위 고정 영역. 며칠짜리 여행이면 Day 탭이 함께 나온다.
// ─────────────────────────────────────────────────────────────

import { Icon } from './icons.jsx'

export function DaySummaryHeader({ day, days, activeDay, onSelectDay, count }) {
  const multi = days && days.length > 1
  return (
    <header className="tw-shrink-0 tw-border-b tw-border-cline tw-bg-surface tw-px-5 tw-py-4">
      <div className="tw-flex tw-items-center tw-gap-2">
        <span className="tw-rounded-md tw-bg-caccent tw-px-2 tw-py-0.5 tw-text-sm tw-font-bold tw-text-white">Day {day.no}</span>
        <span className="tw-text-sm tw-font-medium tw-text-cink-muted">{day.region}</span>
      </div>
      <div className="tw-mt-2 tw-flex tw-items-center tw-gap-3 tw-text-xs tw-text-cink-faint">
        <span className="tw-inline-flex tw-items-center tw-gap-1"><Icon name="calendar" size={13} />{day.date}</span>
        <span className="tw-inline-flex tw-items-center tw-gap-1"><Icon name="pin" size={13} />방문 {count}곳</span>
      </div>

      {multi && (
        <div role="tablist" className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-1.5">
          {days.map((d, i) => (
            <button key={i} role="tab" aria-selected={i === activeDay} type="button"
              onClick={() => onSelectDay && onSelectDay(i)}
              className={`tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-transition-colors ${
                i === activeDay ? 'tw-bg-caccent tw-text-white' : 'tw-border tw-border-cline tw-text-cink-muted hover:tw-text-cink'
              }`}>
              Day {i + 1}
              {d.label && <span className="tw-ml-1 tw-font-normal tw-opacity-80">{d.label}</span>}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
