// ─────────────────────────────────────────────────────────────
// lib/travelTime.js — 장소 사이 이동시간 추정
//
// 직선거리(haversine)를 교통편별 평균 속도로 나누고, 출발·대기에 드는
// 고정 시간을 더한다. 도보 4.5km/h, 대중교통 17km/h, 자차 26km/h —
// 도심 신호·환승을 감안해 실제 최고속도보다 낮게 잡았다.
//
// 길찾기 API 를 쓰지 않는 이유: 순서를 바꿀 때마다 다시 계산해야 하는데
// 그때마다 외부 호출을 하면 느리고 비싸다. 실측 경로는 자차 모드에서
// 지도를 그릴 때만 따로 받는다.
//
// 쓰는 곳: lib/schedule.js · ScheduleTimeline · KakaoRouteMap
// ─────────────────────────────────────────────────────────────

import { haversineKm } from './geo.js'

// 좌표가 없는(사용자가 새로 추가한) 장소용 이동시간 기본값(분)
export const TRAVEL_FALLBACK = { 도보: 18, 대중교통: 22, 자차: 13 }

// 순서가 바뀔 때마다 두 장소 사이 예상 이동시간(분)을 다시 계산한다.
export function estimateTravelMin(from, to, transport) {
  if (from?.location && to?.location) {
    const km = haversineKm(from.location, to.location)
    const speed = transport === '도보' ? 4.5 : transport === '자차' ? 26 : 17
    const base = transport === '도보' ? 2 : transport === '자차' ? 4 : 6
    return Math.max(1, Math.round(base + (km / speed) * 60))
  }
  return TRAVEL_FALLBACK[transport] ?? 20
}

// 길찾기 API가 주는 초 단위 소요시간을 화면 표기용 "N분"으로.
export const formatMinutes = (seconds) => `${Math.max(1, Math.round(seconds / 60))}분`

// 분 단위 소요시간을 사람이 읽기 좋은 문자열로.
// 47 -> "47분", 60 -> "1시간", 136 -> "2시간 16분".
export function formatDurationMin(minutes) {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}분`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`
}
