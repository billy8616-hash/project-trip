// ─────────────────────────────────────────────────────────────
// screens/course-detail/FallbackMap.jsx — mapSlot 을 안 넘겼을 때 쓰는 내장 일러스트 지도
//
// (mock 미리보기용)
// ─────────────────────────────────────────────────────────────

import { useMemo } from 'react'

export function FallbackMap({ places, routes, onPick }) {
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
