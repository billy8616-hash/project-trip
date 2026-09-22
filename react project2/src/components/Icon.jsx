// ─────────────────────────────────────────────────────────────
// components/Icon.jsx — 인라인 SVG 아이콘 모음
//
// 아이콘 라이브러리를 설치하는 대신 필요한 모양만 직접 그려서 담았다.
// 의존성이 늘지 않고, 손그림 느낌의 선 굵기·곡선을 앱 분위기에 맞출 수 있다.
// 색은 CSS(currentColor)가 정하므로 여기서는 모양만 정의한다.
//
// 쓰는 곳: 테마·옵션 버튼, 홈 화면 등 (type 문자열로 골라 쓴다)
// ─────────────────────────────────────────────────────────────

export default function Icon({ type }) {
  const icons = {
    leaf: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 4C11 4 6 8.5 6 15a5 5 0 0 0 5 5c6.5 0 9-7 9-16Z" />
        <path d="M4 20c3-6 7-9 12-11" />
      </svg>
    ),
    fork: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3v8" />
        <path d="M9 3v8" />
        <path d="M6 7h3" />
        <path d="M7.5 11v10" />
        <path d="M16 3v18" />
        <path d="M16 3c3 2 3 7 0 9" />
      </svg>
    ),
    family: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="7" r="3" />
        <circle cx="17" cy="8" r="2.5" />
        <path d="M3 21c.5-4 2.5-7 5-7s4.5 3 5 7" />
        <path d="M13 21c.4-3.4 2-5.8 4-5.8s3.6 2.4 4 5.8" />
      </svg>
    ),
    heart: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20s-7-4.4-9-9.2C1.4 7 3.7 4 7 4c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.3 0 5.6 3 4 6.8C19 15.6 12 20 12 20Z" />
      </svg>
    ),
    pin: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  }
  return icons[type] || null
}
