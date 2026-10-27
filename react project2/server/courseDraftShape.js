// ─────────────────────────────────────────────────────────────
// server/courseDraftShape.js — 작업 중인 코스(CourseDraft) payload 검사
//
// 브라우저가 보낸 스냅샷을 그대로 DB 에 넣지 않고, 복원에 필요한 필드만 골라
// 모양을 맞춘다. 깨진 값이 저장되면 다른 기기에서 복원할 때 화면이 엉뚱해지기
// 때문이다 — 그럴 바엔 저장을 거절하는 편이 낫다.
//
// DB 를 건드리지 않는 순수 함수라 테스트(courseDraftShape.test.js)에서 바로 부른다.
//
// 쓰는 곳: server/courseDraftStore.js
// ─────────────────────────────────────────────────────────────

const MAX_DAYS = 30
const MAX_PLACES_PER_DAY = 40
// express.json 기본 한도(100kb)보다 조금 작게 — 장소 객체에 필드가 붙어 커지는 걸 막는다.
const MAX_PAYLOAD_CHARS = 90_000

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

// 올바르면 { meta, edits, view } 를, 아니면 null 을 돌려준다.
export function normalizeDraftPayload(payload) {
  if (!isPlainObject(payload)) return null
  const { meta, edits, view } = payload
  if (!isPlainObject(meta) || typeof meta.destination !== 'string' || !meta.destination.trim()) return null

  const rawDays = Array.isArray(edits?.currentTimelineDays) ? edits.currentTimelineDays : []
  if (rawDays.length > MAX_DAYS) return null
  if (!rawDays.every((day) => Array.isArray(day) && day.length <= MAX_PLACES_PER_DAY)) return null
  if (!rawDays.every((day) => day.every((place) => isPlainObject(place) && typeof place.name === 'string'))) return null

  const manualOrderDays = (Array.isArray(edits?.manualOrderDays) ? edits.manualOrderDays : [])
    .filter((day) => Number.isInteger(day) && day >= 0 && day < MAX_DAYS)

  const selectedDay = Number.isInteger(view?.selectedDay) && view.selectedDay >= 0 ? view.selectedDay : 0
  const savedName = typeof view?.savedName === 'string' ? view.savedName.slice(0, 80) : ''

  const normalized = {
    meta,
    edits: { currentTimelineDays: rawDays, manualOrderDays },
    view: { selectedDay, savedName },
  }
  if (JSON.stringify(normalized).length > MAX_PAYLOAD_CHARS) return null
  return normalized
}

// 목록·배너에 보여 줄 도시 이름. 직접 고른 목적지가 우선이다(useTripPlan 과 같은 규칙).
export function draftCityOf(meta) {
  return String(meta.pickedDestination || meta.destination).trim().slice(0, 40)
}
