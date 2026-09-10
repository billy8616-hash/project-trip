import { SLOT_LABELS } from '../data/travelOptions.js'
import { budgetAdjust } from './cost.js'
import { optimizeRouteOrder } from './geo.js'
import { isClosedOnDate } from './openingHours.js'
import {
  placeKindOf,
  RAIN_EXPOSED_KINDS,
  RAIN_PARTLY_EXPOSED_KINDS,
  RAIN_SHELTERED_KINDS,
} from './placeKind.js'
import { arrivesAfterClose, DEFAULT_DAY_START_MIN, isOpenAround, scheduleDay } from './schedule.js'

// 비/눈 예보인 날의 장소 점수 보정. 야외 노출이 큰 곳은 감점, 실내 위주는 가점.
// (테마 가점 +4 와 비슷한 크기라, 필수 방문(+20)은 여전히 이긴다.)
export function rainScoreAdjust(place, wet) {
  if (!wet) return 0
  const kind = placeKindOf(place)
  if (RAIN_EXPOSED_KINDS.has(kind)) return -7
  if (RAIN_PARTLY_EXPOSED_KINDS.has(kind)) return -3
  if (RAIN_SHELTERED_KINDS.has(kind)) return 4
  return 0
}

// 교통편에 따라 장소 점수를 보정한다.
// - 자차: 주차 안내 텍스트가 부정적이면 감점, 가능하면 소폭 가점 (자유 텍스트라 신호는 약하게).
// - 도보/대중교통: 최근접 지하철역 등급(transitScore)으로 가감점.
export function transportAdjust(place, transport, cityHasTransit) {
  if (transport === '자차') {
    const info = place.parking || ''
    if (/불가|없[음습]|어려|만차|혼잡/.test(info)) return -3
    if (/가능|무료|유료|주차장/.test(info)) return 1
    return 0
  }
  // 지하철이 아예 없는 도시(경주 등)에서는 대중교통 감점이 무의미하므로 건너뛴다.
  if (!cityHasTransit) return 0
  switch (place.transitScore) {
    case 'good': return 3
    case 'ok': return 1
    case 'far': return -2
    case 'none': return -4
    default: return 0
  }
}

// 여행지 + 테마 + 예산 + 교통편 조건에 맞춰 시간대별로 한 곳씩 골라 코스를 만든다.
// options:
// - tripDate(YYYY-MM-DD): 그날 정기 휴무인 장소는 후보에서 뺀다.
// - dayCount: 이 일수만큼 하루씩 코스를 만들고, 날짜가 달라도 같은 장소를 두 번 넣지 않는다.
// - dayStartMin: 하루 시작 시각(자정 기준 분). 이 시각부터 체류·이동시간을 누적해 각 장소 도착 시각을 매긴다.
// - wetDays: 일자별 비/눈 예보 여부 배열(예: [false, true, false]). 해당 날은 실내 장소를 우선한다.
export function buildCourse(base, themeId, budgetTier, mustVisit = [], anchors = {}, transport = '대중교통', options = {}) {
  const { tripDate = null, dayCount = 1, dayStartMin = DEFAULT_DAY_START_MIN, wetDays = [] } = options
  const totalDays = Math.max(1, Math.floor(dayCount) || 1)
  const keywords = mustVisit.map((word) => word.trim()).filter(Boolean)
  const used = new Set()
  const usesTransit = transport === '대중교통' || transport === '도보'

  // 여행 날짜에 문을 닫는 곳은 먼저 걸러낸다. 단, 그 바람에 후보가 슬롯 수보다 적어지면
  // (지방 소도시 등) 필터를 포기하고 원래 풀을 쓴다 — 빈 코스보다는 낫다.
  const openPool = base.pool.filter((place) => !isClosedOnDate(place, tripDate))
  const pool = openPool.length >= SLOT_LABELS.length ? openPool : base.pool
  const droppedForClosure = pool === openPool && openPool.length < base.pool.length

  const cityHasTransit = pool.some((place) => place.transitScore === 'good' || place.transitScore === 'ok')
  const scoreOf = (place, { wet = false } = {}) => {
    let score = 0
    if (themeId && place.themes.includes(themeId)) score += 4
    // 예산: LLM 이 붙인 예산대 태그는 약하게(+2), 실제 비용대(입장료·priceLevel) 대조가 주 신호.
    if (budgetTier && place.budgetTiers.includes(budgetTier)) score += 2
    score += budgetAdjust(budgetTier, place)
    if (keywords.some((word) => place.name.includes(word) || word.includes(place.name))) score += 20
    score += transportAdjust(place, transport, cityHasTransit)
    score += rainScoreAdjust(place, wet)
    return score
  }

  // 하루치 장소를 시간대별로 한 곳씩 고른다. 이미 다른 날에 쓴 장소(used)는 건너뛴다.
  const pickOneDay = (wet = false) =>
    SLOT_LABELS.map((slot) => {
      const candidates = pool
        .map((place, index) => ({ place, index }))
        .filter(({ place }) => !used.has(place.name) && place.slots.includes(slot))
        .sort((a, b) => scoreOf(b.place, { wet }) - scoreOf(a.place, { wet }) || a.index - b.index)
      const pick = candidates[0]?.place
      if (!pick) return null
      used.add(pick.name)
      // 한 장소가 여러 슬롯에 어울릴 수 있으므로, 실제로 배정된 슬롯을 따로 기록해 둔다.
      return { ...pick, assignedSlot: slot }
    }).filter(Boolean)

  const days = []
  let droppedForLateArrival = 0
  for (let d = 0; d < totalDays; d += 1) {
    let dayPicks = pickOneDay(Boolean(wetDays[d]))
    // 슬롯을 두 곳도 못 채웠으면 남은 풀에서 아무거나 끌어와 최소한의 하루는 만든다.
    if (dayPicks.length < 2) {
      const filler = pool
        .filter((place) => !used.has(place.name))
        .slice(0, SLOT_LABELS.length - dayPicks.length)
        .map((place, index) => ({ ...place, assignedSlot: SLOT_LABELS[dayPicks.length + index] || SLOT_LABELS[SLOT_LABELS.length - 1] }))
      filler.forEach((place) => used.add(place.name))
      dayPicks = [...dayPicks, ...filler]
    }

    // 시간대(오전→점심→오후→저녁)로 뽑은 뒤, 이동거리가 짧아지도록 순서를 다시 잡는다.
    // 출발지/숙소 앵커가 있으면 그 사이에서, 없으면 첫 장소를 고정한 채 최적화한다.
    // 하루 시작 시각부터 체류·이동시간을 누적해 각 장소에 실제 도착 시각을 매기고,
    // 그 도착 시각을 영업시간과 대조해 안 맞으면 hoursNote 를 붙인다.
    let scheduled = scheduleDay(optimizeRouteOrder(dayPicks, anchors), { dayStartMin, transport })

    // 늦게 출발하면 도착 시점에 이미 문을 닫는 곳이 생긴다. 그런 곳은 코스에서 빼고,
    // 그 슬롯에 그 시각에도 여는 다른 곳으로 교체한다. 한 곳 빼면 뒤 일정이 앞당겨지므로
    // 안정될 때까지(더 이상 마감 도착이 없을 때까지) 슬롯 수만큼 반복한다.
    for (let pass = 0; pass < SLOT_LABELS.length; pass += 1) {
      const closedIndex = scheduled.findIndex((place) => arrivesAfterClose(place))
      if (closedIndex === -1) break

      const dropped = scheduled[closedIndex]
      droppedForLateArrival += 1
      let remaining = scheduled.filter((_, index) => index !== closedIndex)

      const replacement = pool.find(
        (place) =>
          !used.has(place.name) &&
          place.slots.includes(dropped.assignedSlot) &&
          isOpenAround(place, dropped.arriveMin),
      )
      if (replacement) {
        used.add(replacement.name)
        remaining = [...remaining, { ...replacement, assignedSlot: dropped.assignedSlot }]
      }

      scheduled = scheduleDay(optimizeRouteOrder(remaining, anchors), { dayStartMin, transport })
    }

    days.push({ places: scheduled })
  }

  const notices = []
  if (usesTransit && !cityHasTransit) {
    notices.push('이 도시는 지하철이 없어 대중교통만으로 다니기엔 제한적이에요. 자차를 고려해보세요.')
  }
  if (droppedForClosure) {
    notices.push('여행 날짜에 쉬는 곳은 코스에서 빼고 짰어요.')
  }
  if (droppedForLateArrival > 0) {
    notices.push('출발이 늦어, 도착 시각엔 이미 문을 닫는 곳은 코스에서 뺐어요.')
  }
  if (wetDays.slice(0, totalDays).some(Boolean)) {
    notices.push('☔ 여행 날짜에 비·눈 예보가 있어, 그날은 실내 위주로 코스를 짰어요.')
  }
  if (days.some((day) => day.places.length < 2)) {
    notices.push('여행지 정보가 넉넉지 않아 일부 날은 코스를 다 채우지 못했어요. 타임라인에서 직접 추가해보세요.')
  }

  return {
    title: base.title,
    subtitle: base.subtitle,
    center: base.center,
    days,
    places: days.flatMap((day) => day.places), // 하위 호환: 공유 텍스트 등 전체 목록이 필요한 곳
    notice: notices[0] || null,
    notices,
  }
}
