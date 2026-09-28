// ─────────────────────────────────────────────────────────────
// components/FootprintTrail.jsx — 조건 선택 화면들 배경에 깔리는 발자국 애니메이션
//
// 세 겹으로 구성된다.
//   1) 점선 가이드   경로 전체를 옅은 점선으로 살짝 비쳐 보여줘 "길"이라는 게 읽히게 한다.
//   2) 발자국        경로를 일정 간격(GAP)으로 밟아 나가며, 각자 STEP_MS 만큼 시차를 두고
//                    찍혔다 사라지길 반복한다. 좌우 발을 번갈아 찍도록 경로에 수직인
//                    방향으로 살짝 어긋나게 그린다.
//   3) 안내 빛       발자국과 별개로, 같은 경로를 따라 은은하게 빛나며 계속 앞서 걷는
//                    작은 빛 하나(animateMotion) — "발길따라"라는 이름처럼 길을 이끄는
//                    느낌을 준다.
//
// themeId를 주면 세 겹 모두 그 여행 테마 색(data/travelOptions.js의 journeyThemes)으로
// 물든다 — CSS 변수 하나(--footprint-accent)로 색을 흘려보내고 transition으로 부드럽게
// 바뀌게 한다. 안 주거나 모르는 id면 기본 색(#c8702a, '발길따라')을 쓴다.
//
// 화면을 가리면 안 되므로 pointer-events: none 에 z-index로 맨 뒤에 깐다(FootprintTrail.css).
// 쓰는 곳: App.jsx (목적지~꼭 가고 싶은 곳까지, 조건 선택 화면 + 내 여행 + 커뮤니티 배경)
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { journeyThemes } from '../data/travelOptions.js'
import './FootprintTrail.css'

const DEFAULT_ACCENT = '#c8702a'

// 발자국이 지나갈 길 (1600x820 기준 좌표). 왼쪽 위에서 시작해 위쪽을 따라 오른쪽으로,
// 오른쪽 가장자리를 크게 돌아 아래로, 다시 아래쪽을 따라 왼쪽으로 빠져나간다.
const TRAIL =
  'M40 200 C 400 180, 900 190, 1250 320 S 1580 560, 1300 700 S 500 760, 120 715'

const GAP = 46 // 발자국 간격(px)
const STEP_MS = 320 // 한 걸음 찍히는 간격(ms)

export default function FootprintTrail({ themeId }) {
  const pathRef = useRef(null)
  const [steps, setSteps] = useState([])
  const accent = journeyThemes.find((theme) => theme.id === themeId)?.color || DEFAULT_ACCENT

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
    <div className="footprint-trail" style={{ '--footprint-accent': accent }} aria-hidden="true">
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
        {/* 1) 점선 가이드: 길이 측정에도 쓰는 그 path를, 이번엔 눈에 옅게 보이게 */}
        <path id="bf-trail" ref={pathRef} d={TRAIL} className="footprint-guide" />

        {/* 2) 발자국 */}
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

        {/* 3) 안내 빛: 발자국과 같은 한 바퀴(cycle) 동안 경로를 따라 계속 앞서 걷는다 */}
        {cycle > 0 && (
          <circle r="7" className="footprint-light">
            <animateMotion dur={`${cycle}ms`} repeatCount="indefinite">
              <mpath href="#bf-trail" />
            </animateMotion>
          </circle>
        )}
      </svg>
    </div>
  )
}
