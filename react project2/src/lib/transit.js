// 대중교통 접근성 표시 문구. transitScore 가 없는 장소(정보 없음)는 null.
export function transitLabelOf(place) {
  if (!place?.transitScore) return null
  if (!place.transitStation) return '주변 지하철역 없음 · 차량 권장'
  const walkMin = Math.max(1, Math.round((place.transitDistanceM || 0) / 67))
  return `${place.transitStation} 도보 약 ${walkMin}분`
}
