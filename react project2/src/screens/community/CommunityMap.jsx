// ─────────────────────────────────────────────────────────────
// screens/community/CommunityMap.jsx — 커뮤니티 상단 지도
//
// 한국 지도(점 격자) 위에 코스가 공유된 도시마다 주황 점을 띄운다.
//   점 크기   = 그 도시에 공유된 코스 수
//   점 클릭   = 부모의 여행지 필터(city)를 그 도시로 바꾼다 (다시 누르면 전체)
//   새 글     = 30초마다 확인해서, 새로 올라온 도시에 파문이 한 번 퍼진다
// 왼쪽에는 방금 공유된 코스 4개를 보여 준다.
//
// 필터(city)와 상관없이 전국 분포를 보여줘야 하므로 목록과 별도로 한 번 더 불러온다.
// 글이 많아지면 서버에 "도시별 개수" API를 따로 두는 게 좋다.
// ─────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import { allDestinations } from '../../data/destinations.js'
import { listCommunityPosts } from '../../lib/communityApi.js'
import './community-map.css'

// ── 게시글 필드 이름 ── 실제 post 객체와 다르면 여기만 고치면 된다.
const getCity = (post) => post.city
const getTitle = (post) => post.title
const getCreatedAt = (post) => post.createdAt ?? post.created_at

const POLL_MS = 30000
const LIVE_COUNT = 4

// 위경도 → 지도 좌표. 아래 윤곽선도 같은 좌표계로 그려져 있다.
const project = (lat, lng) => [(lng - 125.8) * 100, (38.8 - lat) * 120]

// destinations.js 에 위경도가 없을 때 쓰는 기본 좌표 [위도, 경도].
const FALLBACK_COORDS = {
  서울: [37.57, 126.98], 인천: [37.46, 126.71], 수원: [37.26, 127.03], 가평: [37.83, 127.51],
  춘천: [37.88, 127.73], 강릉: [37.75, 128.9], 속초: [38.2, 128.59], 양양: [38.08, 128.62],
  평창: [37.37, 128.39], 정선: [37.38, 128.66], 동해: [37.52, 129.11], 삼척: [37.45, 129.17],
  단양: [36.98, 128.37], 제천: [37.13, 128.19], 청주: [36.64, 127.49], 공주: [36.46, 127.12],
  부여: [36.28, 126.91], 태안: [36.75, 126.3], 보령: [36.33, 126.61], 대전: [36.35, 127.38],
  안동: [36.57, 128.73], 영주: [36.81, 128.62], 포항: [36.02, 129.36], 경주: [35.84, 129.22],
  대구: [35.87, 128.6], 울산: [35.54, 129.31], 부산: [35.18, 129.07], 거제: [34.88, 128.62],
  통영: [34.85, 128.43], 남해: [34.84, 127.89], 진주: [35.18, 128.11], 하동: [35.07, 127.75],
  전주: [35.82, 127.15], 군산: [35.97, 126.74], 남원: [35.42, 127.39], 광주: [35.16, 126.85],
  담양: [35.32, 126.99], 순천: [34.95, 127.49], 여수: [34.76, 127.66], 목포: [34.81, 126.39],
  보성: [34.77, 127.08], 제주: [33.5, 126.53], 서귀포: [33.25, 126.56], 울릉도: [37.48, 130.9],
}

function coordsOf(name) {
  const item = allDestinations.find((d) => d.name === name)
  const lat = item?.lat ?? item?.latitude
  const lng = item?.lng ?? item?.lon ?? item?.longitude
  if (lat != null && lng != null) return project(lat, lng)
  const fb = FALLBACK_COORDS[name]
  return fb ? project(fb[0], fb[1]) : null
}

// 남한 윤곽(단순화) — 점 격자를 찍을 영역.
const OUTLINE = [[30,132],[90,102],[130,72],[200,60],[255,24],[280,72],[315,126],[350,186],[365,252],[360,300],[377,330],[365,360],[355,396],[335,438],[280,456],[230,474],[180,492],[140,516],[80,540],[50,504],[55,444],[70,384],[80,336],[60,288],[35,240],[80,216],[80,168]]

function inside(x, y) {
  let hit = false
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [ax, ay] = OUTLINE[i]
    const [bx, by] = OUTLINE[j]
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) hit = !hit
  }
  return hit
}

// 지도 배경 점은 한 번만 계산한다.
const GRID = (() => {
  const dots = []
  for (let x = 20; x < 400; x += 11) for (let y = 20; y < 560; y += 11) if (inside(x, y)) dots.push([x, y, 3.2])
  for (let x = 35; x < 120; x += 11) for (let y = 625; y < 680; y += 11)
    if (((x - 75) / 40) ** 2 + ((y - 650) / 22) ** 2 < 1) dots.push([x, y, 3.2])
  dots.push([507, 156, 4], [600, 186, 3]) // 울릉도, 독도
  return dots
})()

function timeAgo(value) {
  if (!value) return ''
  const min = Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  if (min < 1440) return `${Math.floor(min / 60)}시간 전`
  return `${Math.floor(min / 1440)}일 전`
}

export function CommunityMap({ city, onSelectCity, onOpenPost }) {
  const [all, setAll] = useState([])
  const [burst, setBurst] = useState(null)
  const [hover, setHover] = useState(null)
  const knownIds = useRef(null)

  // 전국 최신 글을 불러오고, 이전에 없던 글이 생기면 그 도시에 파문을 띄운다.
  useEffect(() => {
    let alive = true
    const fetchAll = () =>
      listCommunityPosts({ city: '', sort: 'recent', limit: 200 })
        .then(({ posts }) => {
          if (!alive) return
          if (knownIds.current) {
            const fresh = posts.find((p) => !knownIds.current.has(p.id))
            if (fresh) setBurst({ city: getCity(fresh), key: fresh.id })
          }
          knownIds.current = new Set(posts.map((p) => p.id))
          setAll(posts)
        })
        .catch(() => {}) // 지도는 부가 기능이라 실패해도 목록은 그대로 쓸 수 있게 조용히 넘긴다.
    fetchAll()
    const timer = setInterval(fetchAll, POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [])

  const pins = useMemo(() => {
    const counts = {}
    all.forEach((p) => { const c = getCity(p); if (c) counts[c] = (counts[c] || 0) + 1 })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, xy: coordsOf(name) }))
      .filter((p) => p.xy)
  }, [all])

  const live = all.slice(0, LIVE_COUNT)
  const label = hover || city
  const labelPin = pins.find((p) => p.name === label)
  const toggle = (name) => onSelectCity(city === name ? '' : name)

  return (
    <div className="tw-mb-5 tw-grid tw-gap-4 tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-4 md:tw-grid-cols-[1fr_1.1fr]">
      <div>
        <p className="tw-flex tw-items-center tw-gap-1.5 tw-text-[12px] tw-font-semibold cmap-accent-text">
          <span className="cmap-live-dot" aria-hidden="true" />
          실시간 발자국
        </p>
        <h2 className="tw-mb-3 tw-mt-1 tw-text-[17px] tw-font-bold tw-text-cink">방금 공유된 여행 코스</h2>

        {live.length === 0 ? (
          <p className="tw-text-[13px] tw-text-cink-faint">아직 공유된 코스가 없어요. 첫 코스를 공유해 보세요.</p>
        ) : (
          <ul className="tw-space-y-1">
            {live.map((post) => (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => onOpenPost(post.id)}
                  onMouseEnter={() => setHover(getCity(post))}
                  onMouseLeave={() => setHover(null)}
                  className="cmap-live-item tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-rounded-lg tw-px-2.5 tw-py-2 tw-text-left"
                >
                  {post.images?.[0] ? (
                    <img src={post.images[0]} alt="" className="cmap-thumb" />
                  ) : (
                    <span className="cmap-thumb cmap-thumb-empty" aria-hidden="true" />
                  )}
                  <span className="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-1.5">
                    <span className="cmap-tag">{getCity(post)}</span>
                    <span className="tw-min-w-0 tw-flex-1 tw-truncate tw-text-[13px] tw-font-semibold tw-text-cink">{getTitle(post)}</span>
                  </span>
                  <span className="tw-flex tw-shrink-0 tw-flex-col tw-items-end tw-gap-1">
                    <span className="tw-text-[11px] tw-text-cink-faint">{timeAgo(getCreatedAt(post))}</span>
                    <span className="cmap-like">♥ {post.likeCount ?? 0}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="tw-mt-3 tw-text-[12px] tw-text-cink-faint">지도의 점을 누르면 그 지역 코스만 모아 볼 수 있어요.</p>
      </div>

      <svg viewBox="10 10 610 690" className="tw-block tw-w-full" role="group" aria-label="지역별 공유 코스 지도">
        {GRID.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} className="cmap-grid" />
        ))}

        {pins.map(({ name, count, xy: [x, y] }) => {
          const r = Math.min(7 + count * 1.5, 22)
          const dim = city && city !== name
          const active = city === name || hover === name
          return (
            <g
              key={name}
              role="button"
              tabIndex={0}
              aria-label={`${name} 코스 ${count}개 보기`}
              aria-pressed={city === name}
              className="cmap-pin"
              opacity={dim ? 0.25 : 1}
              onClick={() => toggle(name)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(name) } }}
              onMouseEnter={() => setHover(name)}
              onMouseLeave={() => setHover(null)}
            >
              {!dim && <circle cx={x} cy={y} r={r} className="cmap-ring" style={{ animationDelay: `${((x * 7) % 26) / 10}s` }} />}
              {burst?.city === name && (
                <circle key={burst.key} cx={x} cy={y} r={r} className="cmap-burst" onAnimationEnd={() => setBurst(null)} />
              )}
              <circle cx={x} cy={y} r={active ? r + 4 : r} className="cmap-dot" strokeWidth={active ? 5 : 2.5} />
              <circle cx={x} cy={y} r={Math.max(r, 20)} fill="transparent" />
            </g>
          )
        })}

        {labelPin && (
          <text x={labelPin.xy[0]} y={labelPin.xy[1] - 30} textAnchor="middle" className="cmap-label">
            {labelPin.name} · 코스 {labelPin.count}개
          </text>
        )}
      </svg>
    </div>
  )
}
