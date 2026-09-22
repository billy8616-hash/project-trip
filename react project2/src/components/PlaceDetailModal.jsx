// ─────────────────────────────────────────────────────────────
// components/PlaceDetailModal.jsx — 장소 상세 모달
//
// 코스의 장소 카드를 누르면 뜨는 창. 두 가지를 한 화면에 같이 보여 준다.
//   왼쪽  이 장소 하나의 정보 — 미니 지도·추천 이유·주의사항·영업시간·주차·대중교통
//   오른쪽 이 장소가 속한 날의 전체 일정 (오전·오후·저녁)
//
// 오른쪽을 같이 두는 이유: 장소 하나만 보면 "이걸 뺄까" 판단이 어렵다.
// 그날 흐름 속에서 봐야 결정할 수 있다.
//
// createPortal 로 body 에 직접 붙인다 — 부모의 overflow·z-index 에 갇혀
// 모달이 잘리는 일을 막기 위해서다.
//
// 쓰는 곳: App.jsx · CourseDetail
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { loadKakaoMaps, kakaoMapApiKey } from '../lib/kakaoMaps.js'
import { formatClock } from '../lib/schedule.js'
import { formatStay } from '../lib/stayTime.js'
import { feeLabelOf } from '../lib/cost.js'
import { transitLabelOf } from '../lib/transit.js'
import Icon from './Icon.jsx'

// App.jsx 의 PREVIEW_BUCKETS 와 동일 — 하루를 오전/오후/저녁 세 칸으로 접어서 보여준다.
const BUCKETS = [
  { key: '오전', label: '오전', icon: '☀️', slots: ['오전'] },
  { key: '오후', label: '오후', icon: '⛅', slots: ['점심 맛집', '오후 카페'] },
  { key: '저녁', label: '저녁', icon: '🌙', slots: ['저녁'] },
]

// 주소에서 "시/군/구/읍/면" 단위만 뽑는다.
function shortRegion(address, fallback = '') {
  const tokens = String(address || '').trim().split(/\s+/)
  return (
    tokens.find((token, index) => index > 0 && token.length <= 5 && /(시|군|구|읍|면)$/.test(token)) || fallback
  )
}

// "14:30 ~ 15:40" 처럼 머무는 시간대를 표기한다. 계산된 시각이 없으면 빈 문자열.
function clockRange(place) {
  if (!Number.isFinite(place.arriveMin)) return ''
  return Number.isFinite(place.departMin)
    ? `${formatClock(place.arriveMin)} ~ ${formatClock(place.departMin)}`
    : formatClock(place.arriveMin)
}

// 지도 밑 장소 카드를 누르면 뜨는 상세 모달.
// 왼쪽: 미니 카카오 지도 + 이 장소 정보(추천 이유·주의사항·영업시간·주차·대중교통).
// 오른쪽: 이 장소가 속한 날의 오전/오후/저녁 전체 일정.
export default function PlaceDetailModal({ place, index, dayNumber, daySchedule = [], cityKey = '', onClose }) {
  const mapElRef = useRef(null)

  // ESC 로 닫기 + 열려 있는 동안 배경 스크롤 잠금.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  // 미니 지도: 이 장소를 번호 배지로, 같은 날 다른 장소는 옅은 점으로.
  useEffect(() => {
    if (!kakaoMapApiKey || !place?.location || !mapElRef.current) return undefined
    let cancelled = false
    const host = mapElRef.current
    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !mapElRef.current) return
        host.innerHTML = '' // 이전 렌더의 지도·오버레이 잔재 제거 후 다시 그린다.
        const center = new kakao.maps.LatLng(place.location.lat, place.location.lng)
        const map = new kakao.maps.Map(mapElRef.current, { center, level: 5 })

        const withLocation = daySchedule.filter((stop) => stop.location)
        const bounds = new kakao.maps.LatLngBounds()
        bounds.extend(center)

        withLocation.forEach((stop) => {
          const original = daySchedule.indexOf(stop)
          const isHere = original === index
          const position = new kakao.maps.LatLng(stop.location.lat, stop.location.lng)
          bounds.extend(position)
          const marker = document.createElement('div')
          marker.className = isHere ? 'mini-map-pin' : 'mini-map-dot'
          marker.textContent = String(original + 1)
          new kakao.maps.CustomOverlay({ map, position, content: marker, yAnchor: isHere ? 1 : 0.5 })
        })

        // 모달이 막 열린 직후엔 컨테이너 크기가 잡히기 전이라 한 번 relayout 후 범위를 맞춘다.
        window.requestAnimationFrame(() => {
          if (cancelled) return
          map.relayout()
          if (withLocation.length > 1) map.setBounds(bounds, 40, 40, 40, 40)
          else map.setCenter(center)
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [place, index, daySchedule])

  const buckets = BUCKETS.map((bucket) => ({
    ...bucket,
    items: daySchedule.filter((stop) => bucket.slots.includes(stop.assignedSlot || '오전')),
  })).filter((bucket) => bucket.items.length)

  const dayTitle = (() => {
    const regions = [...new Set(daySchedule.map((stop) => shortRegion(stop.address, '')).filter(Boolean))]
    const span = regions.slice(0, 2).join(' · ') || cityKey || '여행'
    return `DAY ${dayNumber}: ${span} 일대`
  })()

  const fee = feeLabelOf(place)
  const transit = transitLabelOf(place)

  // 코스 화면(.course-screen)은 슬라이드 애니메이션 때문에 transform 이 남아 있어
  // position: fixed 의 기준이 뷰포트가 아니게 된다. transform 이 없는 .app 으로 포털한다.
  // (.app 에 디자인 토큰과 다크모드 클래스가 걸려 있어 색·테마도 그대로 따라온다.)
  const portalTarget = (typeof document !== 'undefined' && document.querySelector('.app')) || document.body
  return createPortal(
    <div className="place-modal-backdrop" onClick={onClose}>
      <div
        className="place-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${place.name} 상세 정보`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="place-modal-head">
          <span className="place-modal-no">{index + 1}</span>
          <h2>
            코스 상세 정보: {index + 1}. {place.name}
          </h2>
          <button type="button" className="place-modal-x" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="place-modal-body">
          <div className="place-modal-left">
            {kakaoMapApiKey && place.location ? (
              <div className="place-modal-map" ref={mapElRef} />
            ) : (
              <div className="place-modal-map place-modal-map-empty">지도를 표시할 수 없어요</div>
            )}

            <div className="pm-place-line">
              <Icon type="pin" />
              <div>
                <b>{place.name}</b>
                <span>{place.address || shortRegion(place.address, cityKey)}</span>
              </div>
            </div>

            <dl className="pm-dl">
              {Number.isFinite(place.arriveMin) && (
                <>
                  <dt>방문 시간</dt>
                  <dd>{clockRange(place)}</dd>
                </>
              )}
              <dt>머무는 시간</dt>
              <dd>약 {formatStay(place.stayMin ?? 60)}</dd>
              {fee && (
                <>
                  <dt>입장·비용</dt>
                  <dd>{fee}</dd>
                </>
              )}
              {place.reason && (
                <>
                  <dt>추천 이유</dt>
                  <dd>{place.reason}</dd>
                </>
              )}
              {place.caution && (
                <>
                  <dt>주의사항</dt>
                  <dd>{place.caution}</dd>
                </>
              )}
              {place.openHoursText && (
                <>
                  <dt>영업시간</dt>
                  <dd>{place.openHoursText}</dd>
                </>
              )}
              {place.closedDayText && (
                <>
                  <dt>휴무일</dt>
                  <dd>{place.closedDayText}</dd>
                </>
              )}
              {place.parking && (
                <>
                  <dt>주차</dt>
                  <dd>{place.parking}</dd>
                </>
              )}
              {transit && (
                <>
                  <dt>대중교통</dt>
                  <dd>{transit}</dd>
                </>
              )}
              {place.hoursNote && (
                <>
                  <dt>참고</dt>
                  <dd className="pm-warn">⚠ {place.hoursNote}</dd>
                </>
              )}
            </dl>
          </div>

          <div className="place-modal-right">
            <div className="pm-day-tag">{dayTitle}</div>
            {buckets.length === 0 ? (
              <p className="pm-empty">이 날의 일정 정보가 없어요.</p>
            ) : (
              buckets.map((bucket) => (
                <div key={bucket.key} className="pm-slot">
                  <div className="pm-slot-head">
                    <span aria-hidden="true">{bucket.icon}</span> {bucket.label}
                  </div>
                  <ul>
                    {bucket.items.map((stop) => (
                      <li key={stop.name} className={stop.name === place.name ? 'is-current' : ''}>
                        <span className="pm-slot-time">{clockRange(stop)}</span>
                        <span className="pm-slot-name">{stop.name}</span>
                        {stop.reason && <span className="pm-slot-sub">{stop.reason}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>

        <footer className="place-modal-foot">
          <button type="button" className="pm-close-btn" onClick={onClose}>
            닫기
          </button>
        </footer>
      </div>
    </div>,
    portalTarget,
  )
}
