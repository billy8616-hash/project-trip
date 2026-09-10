import { estimateTravelMin } from './travelTime.js'
import { stayMinutesFor } from './stayTime.js'

// 하루 일정을 실제 시각으로 계산한다.
// 하루 시작 시각부터 (체류시간 + 다음 장소까지 이동시간)을 누적해 각 장소의 도착/출발 시각을 매긴다.
// 식사 슬롯은 점심/저녁 시간대에 맞춰 앵커링하고, 도착 시각을 영업시간과 대조해 안 맞으면 안내를 붙인다.

export const DEFAULT_DAY_START_MIN = 9 * 60 + 30 // 09:30
export const LUNCH_ANCHOR_MIN = 12 * 60 // 점심 식당엔 12:00 이후 도착
export const DINNER_ANCHOR_MIN = 18 * 60 // 저녁 식당엔 18:00 이후 도착
const OPEN_WAIT_LIMIT_MIN = 75 // 개장까지 이 시간 이내면 기다렸다 입장, 넘으면 안내만

// 분(자정 기준) -> "HH:MM". 자정을 넘겨도(1440+) 감아서 표시.
export function formatClock(minutes) {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// "09:30" -> 570. 형식이 이상하면 fallback.
export function parseClock(text, fallback = DEFAULT_DAY_START_MIN) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim())
  if (!match) return fallback
  const min = Number(match[1]) * 60 + Number(match[2])
  return min >= 0 && min < 24 * 60 ? min : fallback
}

// places: 방문 순서대로 정렬된 배열 (assignedSlot / category / opensAt·closesAt·alwaysOpen 포함).
// -> 각 장소에 arriveMin / departMin / stayMin / travelToNextMin / hoursNote 를 붙인 새 배열.
export function scheduleDay(places, { dayStartMin = DEFAULT_DAY_START_MIN, transport = '대중교통' } = {}) {
  let cursor = dayStartMin

  return places.map((place, index) => {
    const stayMin = stayMinutesFor(place)

    // 식사 앵커: 너무 이르면 식당 앞에서 기다린다. (앞 일정이 이미 밀렸으면 그대로 진행)
    if (place.assignedSlot === '점심 맛집' && cursor < LUNCH_ANCHOR_MIN) cursor = LUNCH_ANCHOR_MIN
    if (place.assignedSlot === '저녁' && cursor < DINNER_ANCHOR_MIN) cursor = DINNER_ANCHOR_MIN

    let arriveMin = cursor
    let hoursNote = null

    const hasHours =
      !place.alwaysOpen && Number.isFinite(place.opensAt) && Number.isFinite(place.closesAt)
    if (hasHours) {
      if (arriveMin < place.opensAt) {
        if (place.opensAt - arriveMin <= OPEN_WAIT_LIMIT_MIN) {
          arriveMin = place.opensAt // 곧 여니까 기다렸다 입장
          cursor = place.opensAt
        } else {
          hoursNote = `${formatClock(place.opensAt)} 개장 · 도착 예정 ${formatClock(arriveMin)}`
        }
      }
      if (arriveMin >= place.closesAt) {
        hoursNote = `도착 예정 ${formatClock(arriveMin)}엔 이미 마감 (~${formatClock(place.closesAt)})`
      } else if (arriveMin + stayMin > place.closesAt) {
        hoursNote = `${formatClock(place.closesAt)} 마감 · 머물 시간이 짧아요`
      }
    }

    const departMin = arriveMin + stayMin
    const next = places[index + 1]
    const travelToNextMin = next ? estimateTravelMin(place, next, transport) : 0
    cursor = departMin + travelToNextMin

    return { ...place, arriveMin, departMin, stayMin, travelToNextMin, hoursNote }
  })
}

// scheduleDay 를 거친 장소(arriveMin 있음)가 도착 시점에 이미 마감이라 방문 자체가 불가능한지.
// (도착은 영업 중이지만 체류 중에 마감되는 경우는 여기 해당 안 됨 — 그건 경고로만 남긴다.)
export function arrivesAfterClose(place) {
  if (!place || place.alwaysOpen) return false
  if (!Number.isFinite(place.opensAt) || !Number.isFinite(place.closesAt)) return false
  return place.arriveMin >= place.closesAt
}

// 대체 후보(원본 풀 장소)가 대략 그 시각에 열려 있는지. 영업시간 정보가 없으면 낙관적으로 true.
export function isOpenAround(place, minute) {
  if (!place || place.alwaysOpen) return true
  if (!Number.isFinite(place.opensAt) || !Number.isFinite(place.closesAt)) return true
  return minute >= place.opensAt && minute < place.closesAt
}
