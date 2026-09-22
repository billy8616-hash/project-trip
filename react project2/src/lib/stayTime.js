// ─────────────────────────────────────────────────────────────
// lib/stayTime.js — 장소별 머무는 시간 추정
//
// 시간표를 만들려면 "이 장소에 얼마나 있을지"가 필요한데 그런 데이터를 주는
// API 는 없다. 그래서 종류별 평균치로 출발값을 주고, 사용자가 타임라인에서
// 직접 조정하는 것을 전제로 한다.
//
// 쓰는 곳: lib/schedule.js (도착 시각 누적) · ScheduleTimeline (표시)
// ─────────────────────────────────────────────────────────────

import { placeKindOf } from './placeKind.js'

// 장소 종류별 기본 체류시간(분). 코스 타임라인에 실제 시각을 찍을 때 쓴다.
// 대략적인 평균치 — 사용자가 타임라인에서 조정하는 걸 전제로 한 출발값.
const STAY_MINUTES = {
  restaurant: 70,
  cafe: 45,
  bar: 90,
  museum: 90,
  viewpoint: 35,
  market: 50,
  themepark: 150,
  spa: 100,
  nature: 60,
  history: 55,
  sight: 50,
}

// 목록에 없는 종류는 60분으로 본다.
export function stayMinutesFor(place) {
  return STAY_MINUTES[placeKindOf(place)] ?? 60
}

// "70분" / "1시간 30분" 같은 표기.
export function formatStay(minutes) {
  const m = Math.round(minutes)
  if (m < 60) return `${m}분`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}시간 ${rest}분` : `${h}시간`
}
