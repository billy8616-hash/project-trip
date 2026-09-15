// 지도 서비스 브랜드 마크 (파비콘 크기 인라인 SVG). 타임라인 카드·지도 링크 버튼에서 공용.
export function KakaoMark({ size = 15 }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <rect width="20" height="20" rx="5" fill="#FEE500" />
      <path
        d="M10 4.6c-3.1 0-5.6 1.9-5.6 4.3 0 1.5 1.1 2.9 2.7 3.7-.1.4-.5 1.6-.5 1.8-.1.3.1.3.3.2.2-.1 1.9-1.3 2.2-1.5.3 0 .6.1.9.1 3.1 0 5.6-1.9 5.6-4.3S13.1 4.6 10 4.6z"
        fill="#3C1E1E"
      />
    </svg>
  )
}

export function NaverMark({ size = 15 }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <rect width="20" height="20" rx="5" fill="#03C75A" />
      <path d="M7.3 6h2.2l2.3 3.5V6H13.7v8h-2.2L9.2 10.5V14H7.3z" fill="#fff" />
    </svg>
  )
}
