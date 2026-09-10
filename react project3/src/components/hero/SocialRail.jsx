/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/components/hero/SocialRail.jsx
   [화면의 어디?]  홈 화면 왼쪽 가장자리에 세로로 놓인 SNS 아이콘 줄
                  (페이스북 · 인스타그램 · 트위터 · 유튜브).
   [상태]  링크 주소가 아직 '#' 이라서 눌러도 이동하지 않는다. 좁은 화면에서는 CSS 로 숨겨진다.
   [연결]  HeroSection.jsx 안에서 <SocialRail /> 로 놓인다.
   [메모]  아래 ICONS 는 아이콘 그림 모음, LINKS 는 어떤 아이콘을 어떤 순서로 보여줄지 목록이다.
   ─────────────────────────────────────────────────────────────── */

import styles from './SocialRail.module.css'

/* 각 소셜 아이콘 그림 (svg = 코드로 그린 그림). currentColor = 글자색을 따라감 */
const ICONS = {
  facebook: (
    <path
      d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.5-1.5H17V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2V10H7.7v3h2.8v8h3Z"
      fill="currentColor"
    />
  ),
  instagram: (
    <>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="16.6" cy="7.4" r="1.2" fill="currentColor" />
    </>
  ),
  twitter: (
    <path
      d="M4 4h3.9l4 5.6L16.7 4H20l-6.3 7.4L20.4 20h-3.9l-4.3-6L6.8 20H3.5l6.7-7.9L4 4Z"
      fill="currentColor"
    />
  ),
  youtube: (
    <>
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M10.5 9.3v5.4l4.6-2.7-4.6-2.7Z" fill="currentColor" />
    </>
  ),
}

// 보여 줄 아이콘 목록 (위에서 아래 순서대로). key 로 위 ICONS 에서 알맞은 그림을 꺼낸다.
const LINKS = [
  { key: 'facebook', label: '페이스북' },
  { key: 'instagram', label: '인스타그램' },
  { key: 'twitter', label: '트위터' },
  { key: 'youtube', label: '유튜브' },
]

export default function SocialRail() {
  return (
    <ul className={styles.rail}>
      {/* LINKS 목록을 하나씩 돌면서(map) 아이콘 링크를 만든다 */}
      {LINKS.map(({ key, label }) => (
        <li key={key}>
          <a href="#" className={styles.link} aria-label={label}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              {ICONS[key]} {/* key 에 맞는 아이콘 그림 */}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  )
}
