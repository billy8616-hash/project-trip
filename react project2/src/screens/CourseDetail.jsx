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
// 파일 안의 부품들 (아래에서 위로 조립된다)
//   DaySummaryHeader  Day 탭과 요약
//   PlaceCard         장소 카드 한 장 (펼치면 상세·이동 버튼)
//   RouteBadge        카드 사이의 이동 구간 표시
//   AddPlaceRow       장소 검색·추가
//   TimelinePanel     왼쪽 전체
//   FallbackMap       지도가 없을 때 쓰는 일러스트 지도
//   TransportToggle · FloatingActions · ZoomControls  지도 위 컨트롤
//   CourseDetail      맨 아래, 위 부품들을 배치하는 루트
// ─────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'

/* ============================================================================
 *  코스 상세 화면 — 좌우 2분할 (왼쪽: 스크롤 타임라인 / 오른쪽: 고정 지도)
 *
 *  · 스타일은 전부 Tailwind (`tw-` 접두사) — 프로젝트 기존 CSS 와 안 겹친다.
 *  · 루트 클래스 `course-detail-root` 가 index.css 의 스코프 리셋을 받는다.
 *  · 화면은 "표시 전용". 데이터·지도·동작은 전부 props 로 받는다.
 *      places  : 타임라인에 그릴 장소 배열
 *      routes  : 장소 사이 이동 구간 배열 (from/to 는 place.id)
 *      mapSlot : 오른쪽에 깔 지도 노드 (실제 KakaoRouteMap 등). 없으면 내장 일러스트 지도.
 * ========================================================================== */

/* 장소 종류(placeKindOf 결과) → 태그 라벨/색 */
export const KIND_STYLE = {
  cafe: { label: '카페', bg: '#F2ECE4', fg: '#87664A' },
  bar: { label: '술집', bg: '#F5E9DC', fg: '#8A5A2B' },
  museum: { label: '문화·전시', bg: '#EDEFFB', fg: '#4658CF' },
  viewpoint: { label: '전망', bg: '#E7F1FB', fg: '#2C7FBE' },
  market: { label: '시장', bg: '#FBF0E3', fg: '#C0752E' },
  themepark: { label: '테마파크', bg: '#FBEAF0', fg: '#BC5080' },
  spa: { label: '스파', bg: '#E9F3F4', fg: '#3E8B92' },
  nature: { label: '자연', bg: '#E8F4EC', fg: '#2E9A6B' },
  history: { label: '역사', bg: '#EDEFFB', fg: '#4658CF' },
  restaurant: { label: '맛집', bg: '#FBF0E3', fg: '#C0752E' },
  sight: { label: '명소', bg: '#EDEDEA', fg: '#6A6A62' },
}
const kindStyle = (kind) => KIND_STYLE[kind] || KIND_STYLE.sight

// 링크 하나로 홈페이지/SNS 를 다 받기 때문에(구글 websiteUri), 인스타그램 주소면
// 라벨·아이콘만 그에 맞게 바꿔 보여준다 — 실제로는 하나의 필드다.
function websiteMeta(url) {
  if (!url) return null
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('instagram.com')) return { icon: 'instagram', label: '인스타그램' }
    return { icon: 'globe', label: '홈페이지' }
  } catch {
    return { icon: 'globe', label: '홈페이지' }
  }
}

/* ── MOCK (props 를 안 넘겼을 때만 쓰는 예시 데이터) ─────────────────────── */
// props 없이 이 컴포넌트만 띄워도 레이아웃을 확인할 수 있게 둔 예시 데이터.
// 실제 앱에서는 항상 props 가 들어오므로 쓰이지 않는다.
const MOCK_DAY = { no: 1, date: '9월 12일 (토)', region: '강릉' }
const MOCK_PLACES = [
  { id: 'p1', order: 1, name: '오죽헌', kind: 'history', bestTime: '오전', timeRange: '09:00 – 11:30',
    desc: '신사임당과 율곡 이이의 생가.', tip: '아침 공기가 상쾌하고 덜 붐비는 시간대예요.', coord: { x: 150, y: 92 } },
  { id: 'p2', order: 2, name: '초당 순두부 마을', kind: 'restaurant', bestTime: '점심', timeRange: '12:00 – 13:30',
    desc: '고소한 초당 순두부 정식.', tip: '웨이팅이 길면 포장도 좋아요.', coord: { x: 214, y: 208 } },
  { id: 'p3', order: 3, name: '허균·허난설헌 기념공원', kind: 'nature', bestTime: '오후', timeRange: '13:45 – 15:00',
    desc: '울창한 소나무 숲길 산책.', tip: '입장은 무료예요.', coord: { x: 246, y: 298 } },
  { id: 'p4', order: 4, name: '경포 해변', kind: 'nature', bestTime: '저녁', timeRange: '15:45 – 17:30',
    desc: '동해 바다 풍경과 모래사장.', tip: '노을 절정은 18:40 무렵.', coord: { x: 300, y: 370 } },
]
const MOCK_ROUTES = [
  { from: 'p1', to: 'p2', mode: 'bus', line: '버스 202번', duration: '30분', fare: '₩1,250' },
  { from: 'p2', to: 'p3', mode: 'walk', duration: '15분' },
  { from: 'p3', to: 'p4', mode: 'bus', line: '버스 230번', duration: '45분', fare: '₩1,250' },
]

/* ── 인라인 아이콘 (외부 의존성 없음) ──────────────────────────────────── */
const PATHS = {
  bus: <><path d="M8 6v6M16 6v6M2 12h20M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z" /><circle cx="7" cy="15" r="1" /><circle cx="17" cy="15" r="1" /></>,
  car: <><path d="M5 17h14M4 17v-4l2-5a2 2 0 0 1 1.9-1.4h8.2A2 2 0 0 1 18 8l2 5v4" /><circle cx="7.5" cy="17" r="1.6" /><circle cx="16.5" cy="17" r="1.6" /><path d="M4 13h16" /></>,
  walk: <><path d="M4 16v-3a2 2 0 0 1 2-2h1.5a2 2 0 0 0 2-2V7a2 2 0 1 1 4 0v2a2 2 0 0 0 2 2H19a2 2 0 0 1 2 2v3" /><path d="M4 20h.01M9 20h.01M14 20h.01M19 20h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pin: <><path d="M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="M21 15l-5-4-9 8" /></>,
  spark: <><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" /></>,
  warn: <><path d="M12 3l9.5 16.5H2.5L12 3z" /><path d="M12 10v4M12 17h.01" /></>,
  bookmark: <><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
  nav: <><path d="M3 11l19-9-9 19-2-8-8-2z" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  locate: <><circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  chevron: <><path d="M9 6l6 6-6 6" /></>,
  bed: <><path d="M3 18V7M3 12h15a3 3 0 0 1 3 3v3M3 18h18" /><circle cx="7.5" cy="9.5" r="1.8" /><path d="M11 12V9.5h4" /></>,
  flag: <><path d="M5 21V4M5 4h11l-2 3.5L16 11H5" /></>,
  parking: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 17V7h4a3 3 0 0 1 0 6H9" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></>,
  externalLink: <><path d="M14 4h6v6M20 4L10 14M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></>,
}
// 채워진 별 하나 — 커뮤니티 화면(Star)과 같은 색(#F5A524)을 써서 "별점"이라는 신호를 앱 전체에서 통일한다.
// 위 PATHS 는 전부 outline(fill=none) 이라 별만 별도 svg 로 그린다.
function StarIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F5A524" aria-hidden="true">
      <path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1-5.4-2.9-5.4 2.9 1.1-6.1L3.2 9.9l6.1-.8z" />
    </svg>
  )
}
function Icon({ name, size = 18, stroke = 2, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name] || null}
    </svg>
  )
}

/* ── 왼쪽 패널 ──────────────────────────────────────────────────────── */

/* 일정 요약 헤더 (+ 여러 날이면 Day 탭) */
// 타임라인 맨 위 고정 영역. 며칠짜리 여행이면 Day 탭이 함께 나온다.
function DaySummaryHeader({ day, days, activeDay, onSelectDay, count }) {
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

/* 이동 수단 배지 */
// 카드와 카드 사이에 끼는 이동 정보(도보 12분 · 2호선 등).
// 장소만 나열하면 "이 다음 어떻게 가지"가 빠지므로 사이사이에 넣었다.
function RouteBadge({ route }) {
  if (!route) return null
  const walk = route.mode === 'walk'
  const icon = walk ? 'walk' : route.mode === 'car' ? 'car' : 'bus'
  const text = [route.line, route.duration, route.fare].filter(Boolean).join(' · ')
  return (
    <div className="tw-grid tw-grid-cols-[32px_minmax(0,1fr)] tw-items-center tw-gap-3">
      <div className="tw-flex tw-justify-center">
        <span className={`tw-grid tw-h-6 tw-w-6 tw-place-items-center tw-rounded-full tw-border ${
          walk ? 'tw-border-cwalk/30 tw-bg-cwalk-soft tw-text-cwalk' : 'tw-border-caccent/25 tw-bg-caccent-soft tw-text-caccent'
        }`}>
          <Icon name={icon} size={13} stroke={2.2} />
        </span>
      </div>
      <span className={`tw-py-1.5 tw-text-xs tw-font-medium tw-tabular-nums ${walk ? 'tw-text-cwalk' : 'tw-text-cink-muted'}`}>
        {text || '이동'}
      </span>
    </div>
  )
}

/* 썸네일 — 종류 색 자리표시 타일 위에 사진을 덮는다.
   사진을 받는 동안·URL 이 깨졌을 때도 빈칸 대신 타일이 그대로 보이도록 겹쳐 두는 구조다. */
// 장소 사진. 주소가 깨졌거나 불러오기에 실패하면(broken) 기본 일러스트로 대체한다.
function Thumb({ place }) {
  const k = kindStyle(place.kind)
  const [broken, setBroken] = useState(false)
  const showImage = Boolean(place.image) && !broken
  return (
    <div
      className="tw-relative tw-grid tw-h-16 tw-w-16 tw-shrink-0 tw-place-items-center tw-overflow-hidden tw-rounded-cxl tw-border tw-border-cline"
      style={{ background: k.bg, color: k.fg }}
    >
      <Icon name="image" size={22} stroke={1.8} />
      {showImage && (
        <img
          src={place.image}
          alt={`${place.name} 사진`}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="tw-absolute tw-inset-0 tw-h-full tw-w-full tw-object-cover"
        />
      )}
    </div>
  )
}

/* 장소 카드 */
// 장소 카드 한 장. 접힌 상태에서는 이름·시간·태그만, 펼치면 추천 이유·주의사항·
// 영업시간·링크가 나온다. isFirst/isLast 는 위·아래 이동 버튼을 가리는 데 쓴다.
// (여기서는 드래그 없이 ↑↓ 버튼으로 순서를 바꾼다)
function PlaceCard({ place, isFirst, isLast, isActive, onPick, onMoveUp, onMoveDown }) {
  // 처음엔 다 접힌 채로 보여준다. 카드 자체를 누르면 펼침/접힘 + 지도 선택이 같이 일어난다.
  const [open, setOpen] = useState(false)
  const k = kindStyle(place.kind)

  const toggle = () => {
    setOpen((v) => !v)
    onPick && onPick(place)
  }

  return (
    <div id={`course-place-${place.id}`} className="tw-grid tw-grid-cols-[32px_minmax(0,1fr)] tw-gap-3">
      {/* 순번 마커 + 위/아래 이동 버튼 + 세로 연결선. 이 칼럼은 옆의 role="button" 카드와
          형제 요소라서, 카드 클릭(펼침/접힘)과 겹치지 않고 독립적으로 누를 수 있다.
          위로 버튼은 위 칸의 이동수단 배지 바로 밑에서 시작되는 자리라, mt(위쪽 여백)를 넉넉히
          줘서 배지 아이콘에 안 붙게 한다 — 예전엔 여백이 없어서 배지랑 한 덩어리로 보였다. */}
      <div className="tw-flex tw-flex-col tw-items-center">
        {onMoveUp && !isFirst && (
          <button
            type="button"
            onClick={onMoveUp}
            aria-label="이전 장소와 순서 바꾸기"
            className="tw-mb-1.5 tw-mt-2 tw-grid tw-h-6 tw-w-6 tw-place-items-center tw-rounded-full tw-text-cink-faint tw-transition-colors hover:tw-bg-surface-2 hover:tw-text-caccent"
          >
            <Icon name="chevron" size={13} className="tw--rotate-90" />
          </button>
        )}
        <div className={`tw-grid tw-h-7 tw-w-7 tw-place-items-center tw-rounded-full tw-text-[13px] tw-font-bold tw-tabular-nums ${
          isActive ? 'tw-bg-caccent tw-text-white tw-ring-2 tw-ring-caccent/30' : 'tw-bg-caccent tw-text-white'
        }`}>
          {place.order}
        </div>
        {onMoveDown && !isLast && (
          <button
            type="button"
            onClick={onMoveDown}
            aria-label="다음 장소와 순서 바꾸기"
            className="tw-mt-1.5 tw-grid tw-h-6 tw-w-6 tw-place-items-center tw-rounded-full tw-text-cink-faint tw-transition-colors hover:tw-bg-surface-2 hover:tw-text-caccent"
          >
            <Icon name="chevron" size={13} className="tw-rotate-90" />
          </button>
        )}
        {!isLast && <div className="tw-mt-1.5 tw-w-px tw-flex-1 tw-bg-cline" />}
      </div>

      {/* 카드 전체가 하나의 버튼: 누르면 지도 선택 + 상세 펼침/접힘이 함께 일어난다. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        className={`tw-mb-4 tw-cursor-pointer tw-rounded-cxl tw-border tw-bg-surface tw-p-4 tw-shadow-ccard tw-transition-colors ${
          isActive ? 'tw-border-caccent' : 'tw-border-cline hover:tw-border-caccent/40'
        }`}
      >
        <div className="tw-flex tw-gap-3.5">
          <Thumb place={place} />
          <div className="tw-min-w-0 tw-flex-1">
            <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
              <div className="tw-min-w-0">
                <h3 className="tw-truncate tw-text-[15px] tw-font-semibold tw-text-cink">{place.name}</h3>
                <div className="tw-mt-1 tw-flex tw-flex-wrap tw-items-center tw-gap-1.5">
                  <span className="tw-rounded-md tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold" style={{ background: k.bg, color: k.fg }}>
                    {place.category || k.label}
                  </span>
                  {place.bestTime && (
                    <span className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-bg-surface-2 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-cink-muted">
                      <Icon name="clock" size={11} />{place.bestTime}
                    </span>
                  )}
                  {/* 사용자가 "꼭 가고 싶은 곳"에 직접 적은 장소. 추천으로 들어온 곳과 구분해 주면
                      내가 적은 것이 반영됐는지 한눈에 확인할 수 있다. */}
                  {place.mustVisit && (
                    <span className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-bg-cmark/50 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-cink">
                      <Icon name="spark" size={11} />꼭 가고 싶은 곳
                    </span>
                  )}
                </div>
              </div>
              <div className="tw-flex tw-shrink-0 tw-items-center tw-gap-1">
                {/* 접힌 상태에도 보이는 유일한 "딥 데이터" — 숫자 하나만. 리뷰수·요약·링크는 펼쳤을 때만. */}
                {Number.isFinite(place.rating) && (
                  <span className="tw-inline-flex tw-items-center tw-gap-0.5 tw-text-[12px] tw-font-semibold tw-tabular-nums tw-text-cink-muted">
                    <StarIcon size={11} />{place.rating.toFixed(1)}
                  </span>
                )}
                {/* 이제 이 자체는 버튼이 아니라 '펼쳐짐' 상태만 보여주는 장식 화살표 */}
                <span aria-hidden="true" className="tw--mr-1 tw--mt-1 tw-rounded-lg tw-p-1.5 tw-text-cink-faint">
                  <Icon name="chevron" size={16} className={`${open ? 'tw-rotate-90' : ''} tw-transition-transform tw-duration-200`} />
                </span>
              </div>
            </div>

            {place.timeRange && <p className="tw-mt-1 tw-text-xs tw-text-cink-faint tw-tabular-nums">{place.timeRange}</p>}

            {/* CSS grid-rows 트릭으로 높이를 0↔1fr 로 트랜지션 — 내용이 아래로 펼쳐지는 애니메이션 */}
            <div
              className={`tw-grid tw-overflow-hidden tw-transition-[grid-template-rows] tw-duration-200 tw-ease-out ${
                open ? 'tw-grid-rows-[1fr]' : 'tw-grid-rows-[0fr]'
              }`}
            >
              <div className="tw-min-h-0 tw-overflow-hidden">
                <div className="tw-space-y-2.5 tw-pt-2.5">
                  {/* 별점 · 리뷰수 — 신뢰 신호라 목록 맨 위, 다른 메타 칩보다 먼저 보여준다 */}
                  {Number.isFinite(place.rating) && (
                    <div className="tw-flex tw-items-center tw-gap-1 tw-text-[13px] tw-font-semibold tw-text-cink">
                      <StarIcon size={13} />
                      <span className="tw-tabular-nums">{place.rating.toFixed(1)}</span>
                      {Number.isFinite(place.reviewCount) && (
                        <span className="tw-font-medium tw-text-cink-faint">
                          리뷰 {place.reviewCount.toLocaleString()}개
                        </span>
                      )}
                    </div>
                  )}

                  {/* 구글 한줄요약 — AI 추천이유(place.desc)와 출처가 다르므로 따옴표+옅은 배경으로 분리해 보여준다 */}
                  {place.editorialSummary && (
                    <p className="tw-rounded-lg tw-bg-surface-2 tw-px-2.5 tw-py-1.5 tw-text-[12.5px] tw-italic tw-leading-relaxed tw-text-cink-muted">
                      “{place.editorialSummary}”
                    </p>
                  )}

                  {/* 체류시간 · 요금 · 대중교통 접근성 */}
                  {(place.stay || place.fee || place.transit) && (
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-1.5">
                      {place.stay && (
                        <span className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-bg-surface-2 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-cink-muted">
                          <Icon name="clock" size={11} />체류 약 {place.stay}
                        </span>
                      )}
                      {place.fee && (
                        <span className="tw-inline-flex tw-items-center tw-rounded-md tw-bg-surface-2 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-cink-muted">
                          {place.fee}
                        </span>
                      )}
                      {place.transit && (
                        <span className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-md tw-bg-surface-2 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-cink-muted">
                          <Icon name="bus" size={11} />{place.transit}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 영업시간 · 휴무일 — 요일별로 줄바꿈된 원문을 그대로 살려서 보여준다 */}
                  {(place.openHoursText || place.closedDayText) && (
                    <p className="tw-flex tw-items-start tw-gap-1.5 tw-whitespace-pre-line tw-rounded-lg tw-bg-surface-2 tw-px-2.5 tw-py-1.5 tw-text-[12px] tw-font-medium tw-leading-relaxed tw-text-cink-muted">
                      <Icon name="calendar" size={13} className="tw-mt-0.5 tw-shrink-0" />
                      <span>{[place.openHoursText, place.closedDayText].filter(Boolean).join('\n')}</span>
                    </p>
                  )}

                  {place.desc && <p className="tw-text-[13px] tw-leading-relaxed tw-text-cink-muted">{place.desc}</p>}

                  {/* 손글씨 스타일 팁 강조 박스 */}
                  {place.tip && (
                    <div className="tw-flex tw-items-start tw-gap-2 tw-rounded-lg tw-border tw-border-cmark tw-bg-cmark/20 tw-px-3 tw-py-2">
                      <Icon name="spark" size={15} className="tw-mt-0.5 tw-shrink-0 tw-text-[#B8860B]" />
                      <p className="tw-font-chand tw-text-[15px] tw-leading-snug tw-text-cink">
                        <span style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(255,229,138,.85) 60%, rgba(255,229,138,.85) 92%, transparent 92%)' }}>
                          {place.tip}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* 영업시간 경고 등 */}
                  {place.note && (
                    <p className="tw-inline-flex tw-items-start tw-gap-1.5 tw-rounded-lg tw-bg-surface-2 tw-px-2.5 tw-py-1.5 tw-text-[12px] tw-font-medium tw-text-cink-muted">
                      <Icon name="warn" size={13} className="tw-mt-0.5 tw-shrink-0" />{place.note}
                    </p>
                  )}

                  {/* 주차 안내 */}
                  {place.parking && (
                    <p className="tw-inline-flex tw-items-start tw-gap-1.5 tw-rounded-lg tw-bg-surface-2 tw-px-2.5 tw-py-1.5 tw-text-[12px] tw-font-medium tw-text-cink-muted">
                      <Icon name="parking" size={13} className="tw-mt-0.5 tw-shrink-0" />{place.parking}
                    </p>
                  )}

                  {place.address && <p className="tw-text-[12px] tw-text-cink-faint">{place.address}</p>}

                  {/* 홈페이지/SNS 링크 — 텍스트 버튼이 아니라 작은 아이콘 pill 로, 맨 마지막에 몰아서 둔다 */}
                  {place.websiteUrl && (() => {
                    const meta = websiteMeta(place.websiteUrl)
                    return (
                      <a
                        href={place.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-border tw-border-cline tw-px-3 tw-py-1.5 tw-text-[12px] tw-font-semibold tw-text-cink-muted tw-transition-colors hover:tw-border-caccent/40 hover:tw-text-caccent"
                      >
                        <Icon name={meta.icon} size={13} />{meta.label}
                        <Icon name="externalLink" size={11} className="tw-text-cink-faint" />
                      </a>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// "장소 추가" — 평소엔 작은 버튼 하나만 보이고, 누르면 검색창이 펼쳐진다.
// pool(도시 장소 풀)에서 이름이 겹치는 후보를 즉시 보여주고, 고르면 그 장소 그대로(영업시간·
// 사진·평점 포함) 일정에 붙는다. 목록에 없는 곳은 "추가"를 눌러 geocode 로 좌표만 찾아 붙인다 —
// 이 경우 영업시간·사진 같은 정보는 없이 이름과 위치만 가진 채로 들어간다.
// 장소 검색·추가 줄. 추천 풀(pool)에서 먼저 찾아보고, 없으면 지오코딩으로
// 임의의 장소를 좌표까지 얻어서 추가한다.
// 출발지·숙소 카드. 코스에 "들르는 장소"가 아니라 하루의 시작점·끝점이라서, 번호도 붙지 않고
// 순서를 바꾸거나 지울 수도 없다. 장소 카드(PlaceCard)와 생김새를 일부러 다르게 해서
// 사용자가 둘을 헷갈리지 않게 했다.
//
// 지도에도 같은 지점이 '출발'·'숙소' 마커로 찍혀 있다(KakaoRouteMap 의 stops).
// 타임라인에만 빠져 있으면 "숙소를 적었는데 코스에 없다"고 느끼게 되므로 여기서 함께 보여 준다.
function AnchorCard({ anchor, position }) {
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

function AddPlaceRow({ pool = [], excludeNames, onAdd, onGeocode }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('idle') // idle | searching | error
  const [message, setMessage] = useState('')
  const inputRef = useRef(null)
  const rowRef = useRef(null)
  const overlayRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setQuery('')
    setStatus('idle')
    setMessage('')
  }

  const suggestions = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    return pool.filter((place) => !excludeNames?.has(place.name) && place.name.includes(q)).slice(0, 6)
  }, [pool, excludeNames, query])

  // 후보 목록/안내 문구를 입력창 아래 "떠 있는 패널"로 뺐다(문서 흐름에 안 끼움. 아래 렌더 참고).
  // 예전엔 목록이 입력창 바로 밑에서 실제 레이아웃을 밀어내는 방식이었는데, 그러면 타이핑할 때마다
  // 후보 개수(6→4→6…)가 바뀔 때 카드 높이가 같이 바뀌고, 모바일 브라우저가 "포커스된 입력창을
  // 계속 보이게" 하려고 그때마다 자체적으로 스크롤을 다시 계산해 화면이 튀는 원인이 됐다.
  // 오버레이로 빼면 후보가 몇 개든 카드 자체의 높이는 절대 안 바뀌어서, 그 문제가 아예 안 생긴다.
  const hasMessage = status === 'error' || (status !== 'error' && query.trim() && suggestions.length === 0)
  const showOverlay = suggestions.length > 0 || hasMessage

  // 검색창을 열 때 한 번 화면에 보이는 자리로 스크롤한다. 이 카드가 목록 맨 아래(장소 추가
  // 버튼 자리)에 있다 보니, 직접 스크롤해서 내리지 않으면 입력창 자체가 화면 밖에 가려질 수 있다.
  useEffect(() => {
    if (open) rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [open])

  // 오버레이가 "없다가 처음 뜰 때"만 한 번 더 스크롤해서 화면 밖에 가려지지 않게 한다. 오버레이라
  // 카드 높이엔 안 잡히므로(위 주석 참고) rowRef 만으로는 오버레이까지 보장이 안 돼 따로 잡는다.
  // 그 뒤로 후보 개수가 계속 바뀌어도(대부분 계속 showOverlay=true 상태라) 다시 스크롤하지 않는다.
  const hadOverlayRef = useRef(false)
  useEffect(() => {
    if (open && showOverlay && !hadOverlayRef.current) {
      overlayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    hadOverlayRef.current = showOverlay
  }, [open, showOverlay])

  const pick = (place) => {
    onAdd({ name: place.name, assignedSlot: place.slots?.[0] })
    close()
  }

  const submit = async (event) => {
    event.preventDefault()
    const value = query.trim()
    if (!value) {
      close()
      return
    }
    // 화면에 뜬 후보 중 이름이 정확히 같은 게 있으면 그걸 그대로 쓴다(직접 다 타이핑한 경우 대비).
    const exact = suggestions.find((place) => place.name === value)
    if (exact) {
      pick(exact)
      return
    }
    if (!onGeocode) {
      close()
      return
    }
    setStatus('searching')
    setMessage('')
    try {
      const { lat, lng } = await onGeocode(value)
      onAdd({ name: value, location: { lat, lng } })
      close()
    } catch (error) {
      setStatus('error')
      setMessage(error.message || '이 장소를 찾지 못했어요.')
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tw-mb-3 tw-flex tw-w-full tw-items-center tw-justify-center tw-gap-1.5 tw-rounded-cxl tw-border tw-border-dashed tw-border-cline tw-py-3 tw-text-[13px] tw-font-semibold tw-text-cink-muted tw-transition-colors hover:tw-border-caccent/50 hover:tw-text-caccent"
      >
        <Icon name="plus" size={15} /> 장소 추가
      </button>
    )
  }

  return (
    <div ref={rowRef} className="tw-relative tw-mb-3 tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-3 tw-shadow-ccard">
      <form onSubmit={submit} className="tw-flex tw-items-center tw-gap-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setStatus('idle')
            setMessage('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close()
          }}
          placeholder="가고 싶은 곳 이름을 입력하세요"
          className="tw-min-w-0 tw-flex-1 tw-rounded-lg tw-border tw-border-cline tw-bg-cbg tw-px-3 tw-py-2 tw-text-[14px] tw-text-cink tw-outline-none focus:tw-border-caccent"
        />
        <button
          type="submit"
          disabled={status === 'searching'}
          className="tw-shrink-0 tw-rounded-lg tw-bg-caccent tw-px-3 tw-py-2 tw-text-[13px] tw-font-semibold tw-text-white disabled:tw-opacity-50"
        >
          {status === 'searching' ? '찾는 중…' : '추가'}
        </button>
        <button type="button" onClick={close} aria-label="취소" className="tw-shrink-0 tw-rounded-lg tw-px-2 tw-py-2 tw-text-cink-faint hover:tw-text-cink">×</button>
      </form>

      {/* position: absolute 오버레이 — 문서 흐름 밖이라 후보가 몇 개든 위 카드 높이에 안 잡힌다. */}
      {showOverlay && (
        <div
          ref={overlayRef}
          className="tw-absolute tw-left-0 tw-right-0 tw-top-full tw-z-20 tw-mt-2 tw-max-h-64 tw-overflow-y-auto tw-rounded-lg tw-border tw-border-cline tw-bg-surface tw-p-1.5 tw-shadow-lg"
        >
          {suggestions.length > 0 && (
            <ul className="tw-flex tw-flex-col tw-gap-1">
              {suggestions.map((place) => (
                <li key={place.name}>
                  <button
                    type="button"
                    onClick={() => pick(place)}
                    className="tw-flex tw-w-full tw-items-center tw-justify-between tw-gap-2 tw-rounded-lg tw-px-2.5 tw-py-2 tw-text-left tw-text-[13px] tw-text-cink hover:tw-bg-surface-2"
                  >
                    <span className="tw-truncate">{place.name}</span>
                    <span className="tw-ml-2 tw-shrink-0 tw-text-[11px] tw-text-cink-faint">{place.category || place.slots?.[0] || ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {status === 'error' && <p className="tw-px-2 tw-py-1.5 tw-text-[12px] tw-text-red-500">{message}</p>}
          {status !== 'error' && query.trim() && suggestions.length === 0 && (
            <p className="tw-px-2 tw-py-1.5 tw-text-[12px] tw-text-cink-faint">추천 목록에 없으면 "추가"를 눌러 위치를 직접 찾아볼게요.</p>
          )}
        </div>
      )}
    </div>
  )
}

// 왼쪽 패널 전체. 카드 사이사이에 이동 정보를 끼워 넣는 일을 여기서 한다
// (routeByFrom 으로 "이 장소에서 출발하는 구간"을 빠르게 찾는다).
function TimelinePanel({
  day, days, activeDay, onSelectDay, places, routes, selectedIndex, onPick, onMovePlace,
  pool, excludeNames, onAddPlace, onGeocode, startAnchor, endAnchor,
}) {
  const routeByFrom = useMemo(() => {
    const m = {}
    ;(routes || []).forEach((r) => { m[r.from] = r })
    return m
  }, [routes])

  return (
    <div className="tw-flex tw-min-h-0 tw-flex-1 tw-flex-col tw-border-cline lg:tw-flex-none lg:tw-w-[47%] lg:tw-min-w-[360px] lg:tw-max-w-[620px] lg:tw-border-r">
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

/* ── 오른쪽 지도 ────────────────────────────────────────────────────── */

/* mapSlot 을 안 넘겼을 때 쓰는 내장 일러스트 지도 (mock 미리보기용) */
function FallbackMap({ places, routes, onPick }) {
  const byId = useMemo(() => Object.fromEntries(places.map((p) => [p.id, p])), [places])
  const drawable = places.filter((p) => p.coord)
  if (drawable.length === 0) return null
  return (
    <svg viewBox="0 0 380 440" className="tw-h-full tw-w-full" role="img" aria-label="코스 동선">
      <path d="M300 -20 C 330 120, 300 300, 340 460 L460 460 L460 -20 Z" fill="#E7F1FB" />
      <ellipse cx="210" cy="250" rx="42" ry="28" fill="#DEEAF7" />
      <g stroke="#E1DACB" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M40 110 C 130 80, 240 120, 350 100" />
        <path d="M70 360 C 160 340, 250 320, 340 350" />
        <path d="M150 30 C 165 150, 200 300, 300 430" />
      </g>
      {(routes || []).map((r, i) => {
        const a = byId[r.from]; const b = byId[r.to]
        if (!a?.coord || !b?.coord) return null
        const walk = r.mode === 'walk'
        return (
          <line key={i} x1={a.coord.x} y1={a.coord.y} x2={b.coord.x} y2={b.coord.y}
            stroke={walk ? '#2F9E6E' : '#2563C9'} strokeWidth={walk ? 2.5 : 3.5}
            strokeLinecap="round" strokeDasharray={walk ? '1 7' : 'none'} />
        )
      })}
      {drawable.map((p, i) => {
        const w = p.name.length * 12 + 16
        const left = p.coord.x + 18 + w + 8 > 380
        return (
          <g key={p.id} role="button" tabIndex={0} aria-label={`${p.order}번 ${p.name}`} style={{ cursor: 'pointer' }}
            onClick={() => onPick && onPick(i, p)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick && onPick(i, p) } }}>
            <circle cx={p.coord.x} cy={p.coord.y} r="13" fill="#2563C9" stroke="#fff" strokeWidth="3" />
            <text x={p.coord.x} y={p.coord.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{p.order}</text>
            <g transform={`translate(${left ? p.coord.x - 18 : p.coord.x + 18}, ${p.coord.y})`}>
              <rect x={left ? -w : 0} y="-11" width={w} height="22" rx="6" fill="#fff" stroke="#E7E2D8" />
              <path d={left ? 'M0 -4 L6 0 L0 4 Z' : 'M0 -4 L-6 0 L0 4 Z'} fill="#fff" stroke="#E7E2D8" />
              <text x={left ? -8 : 8} y="4.5" textAnchor={left ? 'end' : 'start'} fontSize="11.5" fill="#2B2A27">{p.name}</text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

// 지도 위 범례. 이동수단에 따라 라벨이 바뀐다(버스·도보·자차).
function MapLegend({ moveLabel = '버스' }) {
  return (
    <div className="tw-absolute tw-left-4 tw-top-4 tw-z-20 tw-flex tw-gap-4 tw-rounded-lg tw-border tw-border-cline tw-bg-surface/95 tw-px-3 tw-py-2 tw-text-[11px] tw-font-medium tw-text-cink-muted tw-shadow-ccard">
      <span className="tw-flex tw-items-center tw-gap-1.5"><span className="tw-h-[3px] tw-w-5 tw-rounded tw-bg-caccent" />{moveLabel}</span>
      <span className="tw-flex tw-items-center tw-gap-1.5"><span className="tw-w-5 tw-border-t-2 tw-border-dashed tw-border-cwalk" />도보</span>
    </div>
  )
}

function ZoomControls({ onZoomIn, onZoomOut, onRecenter }) {
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
function TransportToggle({ value, onChange }) {
  if (!onChange) return null
  return (
    <div
      role="group"
      aria-label="이동수단"
      className="tw-absolute tw-bottom-4 tw-left-4 tw-z-20 tw-flex tw-overflow-hidden tw-rounded-full tw-border tw-border-cline tw-bg-surface tw-shadow-ccard"
    >
      {TRANSPORT_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          aria-pressed={value === opt.key}
          onClick={() => onChange(opt.key)}
          className={`tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-2 max-[480px]:tw-px-2.5 tw-text-[13px] tw-font-semibold tw-transition-colors ${
            value === opt.key ? 'tw-bg-caccent tw-text-white' : 'tw-text-cink-muted hover:tw-bg-surface-2 hover:tw-text-cink'
          }`}
        >
          <Icon name={opt.icon} size={14} />
          {/* 아주 좁은 지도 영역(모바일)에선 아이콘만 — FloatingActions 와 한 줄에서 안 겹치도록 */}
          <span className="max-[480px]:tw-hidden">{opt.key}</span>
        </button>
      ))}
    </div>
  )
}

// 지도 오른쪽 아래 떠 있는 버튼들(저장·공유 등). 상위에서 넘긴 것만 표시한다.
function FloatingActions({ actions = {} }) {
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
            it.primary ? 'tw-bg-caccent tw-text-white' : 'tw-border tw-border-cline tw-bg-surface tw-text-cink'
          }`}>
          <Icon name={it.icon} size={15} />
          {/* 좁은 화면에선 아이콘만 — 왼쪽 이동수단 토글과 한 줄에 같이 놓여도 안 겹치도록 */}
          <span className="max-[480px]:tw-hidden">{it.label}</span>
        </button>
      ))}
    </div>
  )
}

/* ── 루트 ───────────────────────────────────────────────────────────── */
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

      <div className="tw-relative tw-h-[34vh] tw-w-full tw-shrink-0 lg:tw-h-auto lg:tw-flex-1">
        <div
          className="tw-relative tw-h-full tw-w-full tw-overflow-hidden tw-bg-surface-2"
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
        </div>
        <TransportToggle value={transport} onChange={onChangeTransport} />
        <FloatingActions actions={actions} />
      </div>
    </div>
  )
}
