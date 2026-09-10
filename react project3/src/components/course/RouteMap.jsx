/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/components/course/RouteMap.jsx
   [화면의 어디?]  코스 상세 화면 왼쪽의 "경로 그림" (격자 배경 위에 번호 점들이 선으로 이어짐).
   [중요]  진짜 지도(구글 지도 같은)가 아니다. 인터넷 지도 없이, 장소들의 위도·경도만 가지고
           "대략 이런 모양으로 이동한다"를 직접 그림(SVG)으로 그린 것이다.
   [연결]  CourseDetailScreen.jsx 가 spots(장소 목록)를 넘겨주면 여기서 그림을 만든다.
   ─────────────────────────────────────────────────────────────── */

import styles from './RouteMap.module.css'

// 그림판 크기(가로 W, 세로 H)와 가장자리 여백(PAD). 단위는 화면 픽셀 비슷하게 생각하면 됨.
const W = 480
const H = 360
const PAD = 46

/**
 * 장소들의 위도·경도(lat/lng)를 그림판 안의 x, y 위치로 바꾼다.
 * - 위도/경도 값의 범위를 재서, 가장 서쪽=왼쪽 / 가장 동쪽=오른쪽 에 오도록 비율로 환산한다.
 * - 지도는 북쪽이 위이므로 y 는 뒤집어 준다(1 - ...).
 * - 실제 거리 축척은 아니고, 경로의 '모양'만 보여 주는 그림이다.
 */
function project(spots) {
  const lats = spots.map((s) => s.lat)
  const lngs = spots.map((s) => s.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const spanLat = maxLat - minLat || 1
  const spanLng = maxLng - minLng || 1

  return spots.map((s) => ({
    ...s,
    x: PAD + ((s.lng - minLng) / spanLng) * (W - PAD * 2),
    y: PAD + (1 - (s.lat - minLat) / spanLat) * (H - PAD * 2),
  }))
}

// props: spots = [{ name, lat, lng }, ...] 형태의 장소 목록
export default function RouteMap({ spots }) {
  const points = project(spots) // 각 장소의 화면 위치(x, y)를 계산
  const line = points.map((p) => `${p.x},${p.y}`).join(' ') // 점들을 잇는 선의 좌표 문자열

  return (
    // svg = 코드로 그리는 그림. viewBox 는 이 그림의 좌표계 크기.
    <svg
      className={styles.map}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="여행 경로 지도"
    >
      {/* 배경 사각형 + 세로/가로 격자선 (지도처럼 보이게 하는 장식) */}
      <rect x="0" y="0" width={W} height={H} rx="16" className={styles.bg} />
      {[...Array(5)].map((_, i) => (
        <line
          key={`v${i}`}
          x1={(W / 5) * (i + 1)}
          y1="0"
          x2={(W / 5) * (i + 1)}
          y2={H}
          className={styles.grid}
        />
      ))}
      {[...Array(4)].map((_, i) => (
        <line
          key={`h${i}`}
          x1="0"
          y1={(H / 4) * (i + 1)}
          x2={W}
          y2={(H / 4) * (i + 1)}
          className={styles.grid}
        />
      ))}

      {/* 장소들을 순서대로 이은 경로 선 */}
      <polyline points={line} className={styles.route} />

      {/* 각 장소 위치에 동그란 번호 표시 (장소 이름은 오른쪽 타임라인에서 같은 번호로 확인) */}
      {points.map((p, i) => (
        <g key={p.name} transform={`translate(${p.x} ${p.y})`}>
          <circle r="15" className={styles.pin} />
          <text className={styles.pinNum} textAnchor="middle" dy="4">
            {i + 1}
          </text>
        </g>
      ))}

      {/* 오른쪽 위 나침반 (N = 북쪽) */}
      <g transform={`translate(${W - 26} 26)`} className={styles.compass}>
        <circle r="12" />
        <text textAnchor="middle" dy="-3">
          N
        </text>
        <path d="M0 -9 L3 2 L0 -1 L-3 2 Z" />
      </g>
    </svg>
  )
}
