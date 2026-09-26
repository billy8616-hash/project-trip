// ─────────────────────────────────────────────────────────────
// screens/course-detail/icons.jsx — 코스 상세 화면 전용 인라인 아이콘 (외부 의존성 없음)
//
// 앱 전체에서 쓰는 components/Icon.jsx 와는 다른, 이 화면(Tailwind 전용)만의
// 아이콘 세트다. course-detail-root 스코프 밖에서는 쓰지 않는다.
// ─────────────────────────────────────────────────────────────

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
export function StarIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F5A524" aria-hidden="true">
      <path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1-5.4-2.9-5.4 2.9 1.1-6.1L3.2 9.9l6.1-.8z" />
    </svg>
  )
}

export function Icon({ name, size = 18, stroke = 2, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name] || null}
    </svg>
  )
}
