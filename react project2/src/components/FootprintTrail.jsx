// ─────────────────────────────────────────────────────────────
// components/FootprintTrail.jsx — 조건 선택 화면들 배경에 깔리는 발자국 애니메이션
//
// 경로(TRAIL)를 따라 발자국을 일정 간격(GAP)으로 배치하고, 각 발자국이
// STEP_MS 만큼 시차를 두고 찍혔다 사라지길 반복해 걸어가는 느낌을 낸다.
// 좌우 발을 번갈아 찍도록 경로에 수직인 방향으로 살짝 어긋나게 그린다.
//
// 화면을 가리면 안 되므로 pointer-events: none 에 z-index로 맨 뒤에 깐다(FootprintTrail.css).
// 쓰는 곳: App.jsx (목적지~꼭 가고 싶은 곳까지, 조건 선택 화면 배경)
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import './FootprintTrail.css'

// 발자국이 지나갈 길 (1600x820 기준 좌표). 왼쪽 위에서 시작해 위쪽을 따라 오른쪽으로,
// 오른쪽 가장자리를 크게 돌아 아래로, 다시 아래쪽을 따라 왼쪽으로 빠져나간다.
const TRAIL =
  'M40 200 C 400 180, 900 190, 1250 320 S 1580 560, 1300 700 S 500 760, 120 715'

const GAP = 46 // 발자국 간격(px)
const STEP_MS = 320 // 한 걸음 찍히는 간격(ms)

export default function FootprintTrail() {
  const pathRef = useRef(null)
  const [steps, setSteps] = useState([])

  useEffect(() => {
    const path = pathRef.current
    const len = path.getTotalLength()
    const list = []
    for (let d = 30, i = 0; d < len - 1; d += GAP, i++) {
      const a = path.getPointAtLength(d)
      const b = path.getPointAtLength(d + 1)
      const dx = b.x - a.x, dy = b.y - a.y
      const n = Math.hypot(dx, dy) || 1
      const side = i % 2 ? 1 : -1 // 왼발/오른발 번갈아
      list.push({
        x: a.x + (-dy / n) * 9 * side,
        y: a.y + (dx / n) * 9 * side,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
        right: side === 1,
      })
    }
    // path.getTotalLength() 는 실제로 그려진 SVG를 읽어야 하는 값이라(DOM 측정),
    // 마운트 뒤 effect 에서 한 번 재는 것 말고는 다른 방법이 없다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSteps(list)
  }, [])

  const cycle = steps.length * STEP_MS

  return (
    <div className="footprint-trail" aria-hidden="true">
      <svg viewBox="0 0 1600 820" preserveAspectRatio="xMidYMax slice">
        <defs>
          <g id="bf-foot">
            <ellipse cx="0" cy="2" rx="5.2" ry="8.5" />
            <circle cx="-3.6" cy="-10.5" r="2" />
            <circle cx="-0.6" cy="-12.3" r="1.8" />
            <circle cx="2.4" cy="-11.8" r="1.6" />
            <circle cx="4.8" cy="-10" r="1.4" />
          </g>
        </defs>
        <path ref={pathRef} d={TRAIL} fill="none" stroke="none" />
        {steps.map((s, i) => (
          <g
            key={i}
            transform={`translate(${s.x} ${s.y}) rotate(${s.angle}) scale(${s.right ? -1 : 1} 1)`}
          >
            <use
              href="#bf-foot"
              className="footprint"
              style={{ animationDelay: `${i * STEP_MS}ms`, animationDuration: `${cycle}ms` }}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
