/* ───────────────────────────────────────────────────────────────
   손그림 스타일 SVG 일러스트 모음.
   전부 선(stroke) 위주로 그리고, filter="url(#rough)" 로 흔들림을 준다.
   색은 index.css 의 CSS 변수(--ink, --blue ...)를 currentColor 로 받는다.
   ─────────────────────────────────────────────────────────────── */

const ink = 'var(--ink)'
const blueFill = 'var(--blue-fill)'

/* 공통 선 스타일 */
const S = {
  fill: 'none',
  stroke: ink,
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

/* ===== 카메라 (레인지파인더) ===== */
export function Camera({ className = '', style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 300 210"
      role="img"
      aria-label="손으로 그린 카메라"
    >
      <g filter="url(#rough-lg)">
        {/* 몸통 */}
        <path
          {...S}
          d="M26 62 q-6 0 -6 8 v104 q0 8 8 8 h244 q8 0 8 -8 V70 q0 -8 -8 -8 h-40 l-14 -20 q-4 -6 -12 -6 h-92 q-8 0 -12 6 l-14 20 z"
        />
        {/* 가죽 질감 라인 */}
        <path {...S} strokeWidth={1.4} d="M20 96 h260 M20 150 h260" />
        {/* 큰 렌즈 */}
        <circle cx="150" cy="128" r="46" fill={blueFill} stroke={ink} strokeWidth={2.6} />
        <circle {...S} cx="150" cy="128" r="34" />
        <circle {...S} cx="150" cy="128" r="20" />
        <circle {...S} cx="150" cy="128" r="9" />
        <path {...S} strokeWidth={1.6} d="M120 108 q10 -8 22 -9" />
        {/* 오른쪽 작은 렌즈/센서 */}
        <circle {...S} cx="234" cy="86" r="9" />
        {/* 뷰파인더 창 */}
        <rect x="48" y="74" width="34" height="24" rx="4" fill={blueFill} stroke={ink} strokeWidth={2.4} />
        {/* 상단 다이얼 2개 */}
        <path {...S} d="M92 42 h34 q4 0 4 4 v14 h-42 v-14 q0 -4 4 -4z" />
        <path {...S} d="M150 40 h30 q4 0 4 4 v16 h-38 v-16 q0 -4 4 -4z" />
        <path {...S} strokeWidth={1.6} d="M99 46 v10 M108 46 v10 M117 46 v10" />
        {/* 셔터 버튼 */}
        <circle {...S} cx="70" cy="52" r="7" />
      </g>
    </svg>
  )
}

/* ===== 백팩 ===== */
export function Backpack({ className = '', style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 240 270"
      role="img"
      aria-label="손으로 그린 배낭"
    >
      <g filter="url(#rough-lg)">
        {/* 어깨끈 */}
        <path {...S} d="M78 40 q-34 26 -30 92" />
        <path {...S} d="M162 40 q34 26 30 92" />
        {/* 몸통 */}
        <path
          {...S}
          d="M64 66 q-26 8 -26 60 v96 q0 22 22 22 h120 q22 0 22 -22 v-96 q0 -52 -26 -60 q-24 -8 -56 -8 q-32 0 -56 8z"
          fill={blueFill}
        />
        {/* 상단 뚜껑 */}
        <path {...S} d="M60 92 q60 -30 120 0 q4 26 -4 40 q-56 -22 -112 0 q-8 -14 -4 -40z" fill="#fff8e8" />
        {/* 뚜껑 버클 끈 */}
        <path {...S} d="M112 96 v34 M128 96 v34" />
        <rect {...S} x="108" y="126" width="10" height="12" rx="2" />
        <rect {...S} x="124" y="126" width="10" height="12" rx="2" />
        {/* 앞주머니 */}
        <path {...S} d="M74 162 q46 -16 92 0 v44 q0 8 -8 8 H82 q-8 0 -8 -8z" fill="#fff8e8" />
        <path {...S} strokeWidth={1.6} d="M74 178 q46 -14 92 0" />
        {/* 옆주머니 살짝 */}
        <path {...S} d="M40 150 q-8 20 0 54" />
        <path {...S} d="M200 150 q8 20 0 54" />
        {/* 바닥 스티치 */}
        <path {...S} strokeWidth={1.4} d="M58 236 h124" />
        {/* 손잡이 고리 */}
        <path {...S} d="M104 44 q16 -14 32 0" />
      </g>
    </svg>
  )
}

/* ===== 첨성대(관측대) ===== */
export function Tower({ className = '', style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 160 240"
      role="img"
      aria-label="손으로 그린 첨성대"
    >
      <g filter="url(#rough-lg)">
        {/* 바닥 기단 */}
        <path {...S} d="M28 224 h104 M20 214 h120" />
        {/* 병 모양 몸통 */}
        <path
          {...S}
          d="M40 214 q-6 -70 18 -128 q10 -22 22 -22 q12 0 22 22 q24 58 18 128z"
          fill={blueFill}
        />
        {/* 벽돌 가로줄 */}
        <path {...S} strokeWidth={1.4} d="M38 196 h84 M40 176 h80 M43 156 h74 M46 136 h68 M50 116 h60 M55 96 h50" />
        {/* 벽돌 세로줄 (엇갈리게) */}
        <path {...S} strokeWidth={1.1} d="M60 196 v-20 M82 196 v-20 M104 196 v-20 M71 176 v-20 M93 176 v-20 M60 156 v-20 M82 156 v-20 M104 156 v-20" />
        {/* 가운데 창 */}
        <rect x="66" y="118" width="28" height="26" rx="2" fill="#7d6a4f" stroke={ink} strokeWidth={2.4} />
        {/* 꼭대기 우물 정(井) 틀 */}
        <path {...S} d="M58 64 h44 M60 52 h40" />
        <path {...S} d="M70 66 v-18 M90 66 v-18" />
      </g>
    </svg>
  )
}

/* ===== 모험 지도 (한반도 남부 + 경로) ===== */
export function MiniMap({ className = '', style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 360 240"
      role="img"
      aria-label="손으로 그린 여행 경로 지도"
    >
      <g filter="url(#rough)">
        {/* 육지 외곽선 */}
        <path
          {...S}
          strokeWidth={2}
          d="M150 26 q34 -6 52 14 q18 18 40 20 q20 2 24 24 q4 24 -10 44 q-16 22 -12 44 q4 22 -18 30 q-26 10 -50 -2 q-22 -12 -44 -6 q-26 8 -44 -10 q-16 -16 -10 -40 q6 -26 -6 -46 q-12 -20 4 -40 q16 -20 44 -22 q22 -2 30 -6z"
          fill="rgba(127,177,211,0.10)"
        />
        {/* 제주도 */}
        <path {...S} strokeWidth={1.8} d="M70 210 q22 -12 40 -2 q10 8 -4 16 q-22 8 -38 -2 q-8 -6 2 -12z" fill="rgba(127,177,211,0.10)" />

        {/* 경로: 왼쪽 → 경주 → 부산 → 제주 (점선) */}
        <path
          fill="none"
          stroke={ink}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="1 9"
          d="M40 96 q60 -34 150 -22"
        />
        <path
          fill="none"
          stroke={ink}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="1 9"
          d="M214 96 q34 40 34 78"
        />
        <path
          fill="none"
          stroke={ink}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="1 9"
          d="M238 182 q-70 34 -128 26"
        />

        {/* 위치 핀 (왼쪽 출발) */}
        <path fill="var(--blue)" stroke={ink} strokeWidth={2} d="M40 78 q12 0 12 12 q0 10 -12 20 q-12 -10 -12 -20 q0 -12 12 -12z" />
        <circle cx="40" cy="90" r="4" fill="#fff8e8" stroke="none" />

        {/* 경주 / 부산 점 */}
        <circle cx="214" cy="94" r="6" fill="var(--blue-deep)" stroke={ink} strokeWidth={1.6} />
        <circle cx="248" cy="176" r="6" fill="var(--blue-deep)" stroke={ink} strokeWidth={1.6} />

        {/* 비행기 글리프 */}
        <path {...S} strokeWidth={1.8} d="M262 60 l22 -8 l-6 12 l14 6 l-16 4 l-4 12 l-8 -12 l-14 2z" />
        {/* 기차 글리프 */}
        <g stroke={ink} strokeWidth={1.8} fill="none" strokeLinecap="round">
          <rect x="34" y="150" width="34" height="20" rx="4" />
          <path d="M40 170 v6 M62 170 v6 M34 160 h34" />
          <circle cx="42" cy="180" r="3" />
          <circle cx="60" cy="180" r="3" />
        </g>
        {/* 하이커 글리프 */}
        <g stroke={ink} strokeWidth={1.8} fill="none" strokeLinecap="round">
          <circle cx="300" cy="150" r="5" />
          <path d="M300 155 v18 M300 160 l-10 8 M300 160 l12 6 M300 173 l-8 14 M300 173 l8 14 M312 150 v22" />
        </g>
      </g>
    </svg>
  )
}

/* ===== 사진 썸네일 (산 + 해) ===== */
export function PhotoThumb({ className = '', style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 90 70"
      role="img"
      aria-label="여행 사진 썸네일"
    >
      <g filter="url(#rough)">
        <rect x="5" y="5" width="80" height="60" rx="3" fill={blueFill} stroke={ink} strokeWidth={2.2} />
        <circle cx="64" cy="24" r="7" fill="#fff8e8" stroke={ink} strokeWidth={1.8} />
        <path {...S} strokeWidth={2} d="M9 52 l18 -22 l12 14 l14 -18 l24 26z" fill="#b9895e" />
      </g>
    </svg>
  )
}

/* ===== 작은 카메라 아이콘 (흩뿌리는 장식용) ===== */
export function CameraTiny({ className = '', style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 40 32"
      aria-hidden="true"
    >
      <g filter="url(#rough)">
        <path {...S} strokeWidth={2} d="M5 10 h7 l3 -5 h10 l3 5 h7 v18 h-40 v-18z M5 10 v18 h30 v-18" />
        <circle {...S} strokeWidth={2} cx="20" cy="19" r="7" />
        <circle {...S} strokeWidth={1.6} cx="20" cy="19" r="3" />
      </g>
    </svg>
  )
}

/* ===== 별 (5각) ===== */
export function Star({ className = '', style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
      <g filter="url(#rough)">
        <path
          {...S}
          strokeWidth={2}
          d="M12 2 l3 6 l7 1 l-5 5 l1 7 l-6 -3 l-6 3 l1 -7 l-5 -5 l7 -1z"
        />
      </g>
    </svg>
  )
}

/* ===== 지구본 (네비게이션 양옆) ===== */
export function Globe({ className = '', style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 40 40" aria-hidden="true">
      <g filter="url(#rough)">
        <circle {...S} cx="20" cy="20" r="16" />
        <ellipse {...S} strokeWidth={1.8} cx="20" cy="20" rx="7" ry="16" />
        <path {...S} strokeWidth={1.8} d="M4 20 h32 M6 12 h28 M6 28 h28" />
        <path {...S} strokeWidth={1.8} d="M12 8 q6 8 0 24 M28 8 q-6 8 0 24" fill="none" />
      </g>
    </svg>
  )
}

/* ===== 곡선 점선 화살표 (가운데 흐름) ===== */
export function DashArrow({ className = '', style, d, flip = false }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 120 120"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <g filter="url(#rough)" transform={flip ? 'scale(-1,1) translate(-120,0)' : undefined}>
        <path
          fill="none"
          stroke={ink}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="2 12"
          d={d || 'M10 20 q70 10 78 78'}
        />
        {/* 화살촉 */}
        <path
          fill="none"
          stroke={ink}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M74 96 l14 4 l-2 -16"
        />
      </g>
    </svg>
  )
}
