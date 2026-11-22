// ─────────────────────────────────────────────────────────────
// screens/course-detail/MapControls.jsx — 지도 위에 떠 있는 작은 컨트롤들
//
//   MapLegend        이동수단에 따라 라벨이 바뀌는 범례
//   ZoomControls     확대/축소·전체 보기
//   TransportToggle  자차/대중교통/도보 전환
//   FloatingActions  저장·공유·지도 앱 버튼(상위에서 넘긴 것만 표시)
//
// 전부 지도 오버레이라 각자 코드가 짧고, 서로 조합해 한 화면(CourseDetail)에서만
// 쓰여서 파일 하나에 묶어 뒀다.
// ─────────────────────────────────────────────────────────────

import { Icon } from './icons.jsx'

// 지도 위 범례. 실선은 고른 이동수단의 실제 경로, 점선은 길찾기가 경로를 못 찾아
// 직선으로 이은 구간이다 (KakaoRouteMap 의 drawFallbackRoute·section 없는 구간).
export function MapLegend({ moveLabel = '버스' }) {
  return (
    <div className="tw-absolute tw-left-4 tw-top-4 tw-z-20 tw-flex tw-gap-4 tw-rounded-lg tw-border tw-border-cline tw-bg-surface/95 tw-px-3 tw-py-2 tw-text-[11px] tw-font-medium tw-text-cink-muted tw-shadow-ccard">
      <span className="tw-flex tw-items-center tw-gap-1.5"><span aria-hidden="true" className="tw-h-[3px] tw-w-5 tw-rounded tw-bg-croute" />{moveLabel} 경로</span>
      <span className="tw-flex tw-items-center tw-gap-1.5"><span aria-hidden="true" className="tw-w-5 tw-border-t-2 tw-border-dashed tw-border-cink-muted" />예상 직선(길 못 찾음)</span>
    </div>
  )
}

export function ZoomControls({ onZoomIn, onZoomOut, onRecenter }) {
  const b = 'tw-grid tw-h-9 tw-w-9 tw-place-items-center tw-text-cink-muted hover:tw-bg-surface-2 hover:tw-text-cink'
  return (
    <div className="tw-absolute tw-right-4 tw-top-4 tw-z-20 tw-flex tw-flex-col tw-overflow-hidden tw-rounded-lg tw-border tw-border-cline tw-bg-surface tw-shadow-ccard">
      <button type="button" className={b} onClick={onRecenter} aria-label="전체 보기"><Icon name="locate" size={16} /></button>
      <button type="button" className={`${b} tw-border-t tw-border-cline`} onClick={onZoomIn} aria-label="확대"><Icon name="plus" size={16} /></button>
      <button type="button" className={`${b} tw-border-t tw-border-cline`} onClick={onZoomOut} aria-label="축소"><Icon name="minus" size={16} /></button>
    </div>
  )
}

/* 이동수단 전환 — 자차/대중교통/도보 별로 동선(지도 경로 + 도착시각)을 다시 계산해서 보여준다. */
const TRANSPORT_OPTIONS = [
  { key: '자차', icon: 'car' },
  { key: '대중교통', icon: 'bus' },
  { key: '도보', icon: 'walk' },
]
// 지도 위에서 교통수단을 바꾸는 토글. 바꾸면 경로를 다시 받아 그린다.
// locked: 테마가 교통편을 정해 둔 경우(발길따라 = 도보). 켜진 값만 보여 주고 버튼은 모두 막는다.
export function TransportToggle({ value, onChange, locked = false }) {
  if (!onChange) return null
  return (
    <div
      role="group"
      aria-label={locked ? '이동수단 (발길따라는 도보로 고정)' : '이동수단'}
      title={locked ? '발길따라는 걸어서 잇는 코스라 도보로 고정돼요' : undefined}
      className="tw-absolute tw-bottom-4 tw-left-4 tw-z-20 tw-flex tw-overflow-hidden tw-rounded-full tw-border tw-border-cline tw-bg-surface tw-shadow-ccard"
    >
      {TRANSPORT_OPTIONS.map((opt) => {
        // 고정 중엔 켜져 있는 도보 버튼도 막는다 — 누르면 사용자가 원래 고른 교통편이 도보로 덮여 버린다.
        const disabled = locked
        return (
          <button
            key={opt.key}
            type="button"
            aria-label={opt.key}
            aria-pressed={value === opt.key}
            disabled={disabled}
            onClick={() => onChange(opt.key)}
            className={`tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-2 max-[480px]:tw-px-2.5 tw-text-[13px] tw-font-semibold tw-transition-colors ${
              value === opt.key
                ? 'tw-bg-caccent tw-text-cink'
                : disabled
                  ? 'tw-cursor-not-allowed tw-text-cink-muted tw-opacity-40'
                  : 'tw-text-cink-muted hover:tw-bg-surface-2 hover:tw-text-cink'
            }`}
          >
            <Icon name={opt.icon} size={14} />
            {/* 아주 좁은 지도 영역(모바일)에선 아이콘만 — FloatingActions 와 한 줄에서 안 겹치도록 */}
            <span className="max-[480px]:tw-hidden">{opt.key}</span>
          </button>
        )
      })}
    </div>
  )
}

// 지도 오른쪽 아래 떠 있는 버튼들(저장·공유 등). 상위에서 넘긴 것만 표시한다.
export function FloatingActions({ actions = {} }) {
  const items = [
    { key: 'save', label: actions.saveLabel || '코스 저장', icon: 'bookmark', primary: true, on: actions.onSave },
    { key: 'share', label: actions.shareLabel || '공유', icon: 'share', on: actions.onShare },
    { key: 'open', label: '지도 앱', icon: 'nav', on: actions.onOpenMap },
  ].filter((it) => it.on)
  if (items.length === 0) return null
  return (
    <div className="tw-absolute tw-bottom-4 tw-right-4 tw-z-20 tw-flex tw-items-center tw-gap-2">
      {items.map((it) => (
        <button key={it.key} type="button" onClick={it.on}
          className={`tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-px-3 tw-py-2 max-[480px]:tw-px-2.5 tw-text-[13px] tw-font-semibold tw-shadow-cfloat tw-transition-transform hover:tw--translate-y-0.5 ${
            it.primary ? 'tw-border tw-border-caccent-edge tw-bg-caccent tw-text-cink tw-shadow-cpaper' : 'tw-border tw-border-cline tw-bg-surface tw-text-cink'
          }`}>
          <Icon name={it.icon} size={15} />
          {/* 좁은 화면에선 아이콘만 — 왼쪽 이동수단 토글과 한 줄에 같이 놓여도 안 겹치도록 */}
          <span className="max-[480px]:tw-hidden">{it.label}</span>
        </button>
      ))}
    </div>
  )
}
