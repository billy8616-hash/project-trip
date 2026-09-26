// ─────────────────────────────────────────────────────────────
// screens/community/Stars.jsx — 별점 표시·입력
//
//   Stars       읽기 전용 5개 묶음 (카드·상세에서 평균/후기 별점 표시)
//   StarPicker  입력용 — 누르면 그 개수만큼 채워진다 (후기 작성·코스 공유)
// ─────────────────────────────────────────────────────────────

/* 별 하나. 채움 여부만 다르고 모양은 같아서 색만 바꿔 쓴다. */
function Star({ filled, size = 14 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill={filled ? '#F5A524' : 'none'} stroke={filled ? '#F5A524' : '#C9C2B4'}
      strokeWidth="1.8" strokeLinejoin="round"
    >
      <path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1-5.4-2.9-5.4 2.9 1.1-6.1L3.2 9.9l6.1-.8z" />
    </svg>
  )
}

// 별점 표시용(읽기 전용) 5개 묶음.
export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="tw-inline-flex tw-items-center tw-gap-px" aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={value >= n - 0.25} size={size} />
      ))}
    </span>
  )
}

// 별점 입력용. 누르면 그 개수만큼 채워진다.
export function StarPicker({ value, onChange }) {
  return (
    <span className="tw-inline-flex tw-items-center tw-gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n} type="button" onClick={() => onChange(n)} aria-label={`${n}점`}
          className="tw-rounded tw-p-0.5 tw-transition-transform hover:tw-scale-110"
        >
          <Star filled={value >= n} size={22} />
        </button>
      ))}
    </span>
  )
}
