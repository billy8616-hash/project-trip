// ─────────────────────────────────────────────────────────────
// lib/ids.js — 화면에서만 쓰는 임시 식별자 생성
//
// 타임라인에서 장소를 추가·교체할 때 React 의 key 로 쓸 고유 값이 필요하다.
// DB 에 저장되는 id 가 아니라 브라우저 안에서만 사는 값이다.
//
// 쓰는 곳: components/ScheduleTimeline.jsx
// ─────────────────────────────────────────────────────────────

// crypto.randomUUID 가 있으면 그걸 쓰고, 없는 환경(구형 브라우저·비보안 컨텍스트)에서는
// 시각(36진수) + 난수를 이어 붙여 충돌 가능성이 낮은 문자열을 만든다.
export function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}
