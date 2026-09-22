// ─────────────────────────────────────────────────────────────
// lib/transit.js — 대중교통 접근성 문구
//
// 서버가 붙여 준 최근접 지하철역 정보(transitStation·transitDistanceM)를
// "경복궁역 도보 약 5분" 같은 한 줄로 바꾼다. 도보 속도는 분당 67m 기준.
//
// 쓰는 곳: PlaceDetailModal · ScheduleTimeline
// ─────────────────────────────────────────────────────────────

// 대중교통 접근성 표시 문구. transitScore 가 없는 장소(정보 없음)는 null.
export function transitLabelOf(place) {
  if (!place?.transitScore) return null
  if (!place.transitStation) return '주변 지하철역 없음 · 차량 권장'
  const walkMin = Math.max(1, Math.round((place.transitDistanceM || 0) / 67))
  return `${place.transitStation} 도보 약 ${walkMin}분`
}
