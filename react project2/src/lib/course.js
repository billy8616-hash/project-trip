// ─────────────────────────────────────────────────────────────
// lib/course.js — 코스 생성의 핵심 (장소 스코어링 + 시간대 배치)
//
// 이 앱에서 가장 중요한 파일. "도시의 장소 목록"을 받아
// "시간표가 붙은 하루 코스"로 바꾸는 일을 한다.
//
// 흐름 한눈에 보기
//   1) 여행 날짜에 휴무인 장소를 후보에서 제외          (openingHours.js)
//   2) 조건·맥락으로 장소마다 점수를 매김               (이 파일의 scoreOf)
//        테마 +4 / 예산 +2 / 필수방문 +20 / 교통편 ± / 비·눈 ±
//   3) 오전·점심·오후·저녁 슬롯마다 최고점 한 곳씩 선택 (pickOneDay)
//   4) 이동거리가 짧아지도록 순서 재배열                (geo.js)
//   5) 체류·이동시간을 누적해 도착 시각 계산            (schedule.js)
//   6) 도착 시각에 이미 닫는 곳은 빼고 다른 곳으로 교체 → 다시 4~5 반복
//
// 점수 크기를 일부러 이렇게 잡았다: 필수방문(+20)은 다른 어떤 가감점으로도
// 뒤집히지 않고, 나머지(테마·예산·날씨·교통)는 서로 경쟁할 수 있는 크기다.
//
// 쓰는 곳: App.jsx (코스 생성·다시 짜기)
// ─────────────────────────────────────────────────────────────

import { SLOT_LABELS } from '../data/travelOptions.js'
import { budgetAdjust } from './cost.js'
import { optimizeRouteOrderBySlot } from './geo.js'
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

// optimizeRouteOrderBySlot 으로 거리 최적화를 끝낸 추천 코스 순서(ordered)에, 직접 추가한
// 장소(manual)를 각자의 assignedSlot(오전/점심/오후/저녁) 자리에 끼워 넣는다.
// (좌표가 없는 manual 장소는 애초에 거리 최적화 대상이 아니라서 별도로 삽입해야 한다.)
export function insertManualBySlot(ordered, manualPlaces) {
  if (manualPlaces.length === 0) return ordered
  const result = ordered.slice()
  for (const manual of manualPlaces) {
    const slotIndex = SLOT_LABELS.indexOf(manual.assignedSlot)
    // 이 장소보다 시간대가 늦은 첫 자리 앞에 끼워 넣는다. 그런 자리가 없으면(가장 늦은 시간대면) 맨 뒤.
    let insertAt = result.findIndex((place) => SLOT_LABELS.indexOf(place.assignedSlot) > slotIndex)
    if (insertAt === -1) insertAt = result.length
    result.splice(insertAt, 0, manual)
  }
  return result
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

  // 이 도시에 지하철이 있는지 판단한다. 한 곳이라도 역이 가까우면 지하철이 있는 도시로 본다.
  // 경주처럼 지하철이 아예 없는 도시에서 "역이 멀다"고 감점하면 모든 장소가 똑같이 깎여 의미가 없다.

  const cityHasTransit = pool.some((place) => place.transitScore === 'good' || place.transitScore === 'ok')
  // 장소 한 곳의 점수. 높을수록 코스에 먼저 들어간다.
  // wet = 그날 비·눈 예보 여부(날짜마다 다르므로 매번 넘겨받는다).
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

  // ── 꼭 가고 싶은 곳 확정 ────────────────────────────────────────────────
  // 점수 +20 만으로는 부족하다. 같은 시간대에 어울리는 곳을 여러 개 적으면 한 곳만 뽑히고,
  // 풀에 아예 없는 이름(작은 가게·신규 장소·상호 표기가 다른 곳)은 조용히 사라진다.
  // 사용자가 직접 적은 곳이므로 알고리즘이 빼는 일이 없도록 여기서 먼저 확정해 둔다.
  const matchesKeyword = (name, word) => name.includes(word) || word.includes(name)

  const forcedPlaces = []      // 풀에서 찾은 곳 (좌표·영업시간을 그대로 쓴다)
  const forcedMissing = []     // 풀에 없어서 이름만 아는 곳
  const forcedClosed = []      // 찾긴 했는데 그날 휴무일 수 있는 곳

  for (const word of keywords) {
    // 휴무로 걸러낸 곳이라도 원래 풀(base.pool)에서 찾는다 — 사용자가 굳이 적은 곳이라
    // 조용히 빼는 것보다 넣고 안내하는 편이 낫다.
    const found = base.pool.find((place) => !used.has(place.name) && matchesKeyword(place.name, word))
    if (!found) {
      forcedMissing.push(word)
      continue
    }
    used.add(found.name)
    if (isClosedOnDate(found, tripDate)) forcedClosed.push(found.name)
    forcedPlaces.push({ ...found, assignedSlot: found.slots?.[0] || SLOT_LABELS[0], mustVisit: true })
  }

  // 풀에 없는 곳은 이름만 가진 카드로 넣는다. 좌표가 없으니 거리 최적화에서 빼고(manual)
  // 시간대 자리에만 끼워 넣는다 — 사용자가 타임라인에서 직접 추가한 장소와 같은 취급이다.
  const forcedManual = forcedMissing.map((word) => ({
    name: word,
    manual: true,
    mustVisit: true,
    location: null,
    slots: [SLOT_LABELS[0]],
    assignedSlot: SLOT_LABELS[0],
    themes: [],
    budgetTiers: [],
  }))

  // 하루치 장소를 시간대별로 한 곳씩 고른다. 이미 다른 날에 쓴 장소(used)는 건너뛴다.
  // skipSlots: 필수 방문이 이미 차지한 시간대 — 그 자리는 새로 뽑지 않는다.
  //
  // 2단계로 나눠 고른다: 1단계에서 시간대 태그가 맞는 곳을 슬롯마다 먼저 다 확정해 두고,
  // 그래도 후보가 없어 비어 있는 슬롯만 2단계에서 태그와 무관하게 채운다. 한 번에 순서대로
  // 채우면, 아직 처리 안 한 뒤 슬롯(예: 저녁)에 정확히 맞는 곳이 앞 슬롯(오후 카페)의
  // 대체용으로 먼저 가로채질 수 있기 때문이다.
  const pickOneDay = (wet = false, skipSlots = new Set()) => {
    const rankAndPick = (candidates) => {
      const sorted = candidates
        .map((place, index) => ({ place, index }))
        .sort((a, b) => scoreOf(b.place, { wet }) - scoreOf(a.place, { wet }) || a.index - b.index)
      return sorted[0]?.place || null
    }

    const slots = SLOT_LABELS.filter((slot) => !skipSlots.has(slot))
    const picks = slots.map((slot) => {
      const pick = rankAndPick(pool.filter((place) => !used.has(place.name) && place.slots.includes(slot)))
      if (pick) used.add(pick.name)
      return { slot, place: pick }
    })

    // 슬롯을 그냥 비워두면 뒤 시간대(특히 저녁 앵커, schedule.js)와의 사이에 몇 시간짜리
    // 빈 시간이 생겨버리므로, 태그 후보가 없는 슬롯은 남은 곳 중 최고점으로 채운다.
    return picks
      .map(({ slot, place }) => {
        const pick = place || rankAndPick(pool.filter((p) => !used.has(p.name)))
        if (!pick) return null
        if (!place) used.add(pick.name)
        // 한 장소가 여러 슬롯에 어울릴 수 있으므로, 실제로 배정된 슬롯을 따로 기록해 둔다.
        return { ...pick, assignedSlot: slot }
      })
      .filter(Boolean)
  }

  const days = []
  let droppedForLateArrival = 0
  for (let d = 0; d < totalDays; d += 1) {
    // 꼭 가고 싶은 곳은 첫날에 모아 넣는다. 며칠짜리 여행이라도 "언제 갈지"를 알 수 없으니,
    // 가장 확실하게 지켜지는 첫날에 두고 사용자가 원하면 다른 날로 옮기게 한다.
    const forcedToday = d === 0 ? [...forcedPlaces, ...forcedManual] : []
    const takenSlots = new Set(forcedToday.map((place) => place.assignedSlot))
    let dayPicks = [...forcedToday, ...pickOneDay(Boolean(wetDays[d]), takenSlots)]
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
    // 좌표가 없는 곳(이름만 아는 필수 방문)은 거리 최적화에 넣을 수 없다. 추천 장소만 최적화하고,
    // 그 결과에 시간대가 맞는 자리를 찾아 끼워 넣는다.
    const orderPicks = (list) => {
      const located = list.filter((place) => !place.manual)
      const manual = list.filter((place) => place.manual)
      return insertManualBySlot(optimizeRouteOrderBySlot(located, anchors), manual)
    }

    let scheduled = scheduleDay(orderPicks(dayPicks), { dayStartMin, transport })

    // 늦게 출발하면 도착 시점에 이미 문을 닫는 곳이 생긴다. 그런 곳은 코스에서 빼고,
    // 그 슬롯에 그 시각에도 여는 다른 곳으로 교체한다. 한 곳 빼면 뒤 일정이 앞당겨지므로
    // 안정될 때까지(더 이상 마감 도착이 없을 때까지) 슬롯 수만큼 반복한다.
    for (let pass = 0; pass < SLOT_LABELS.length; pass += 1) {
      // 꼭 가고 싶다고 적은 곳은 여기서 빼지 않는다. 사용자가 직접 고른 곳을 앱이 대신
      // 지워 버리면 안 되고, 마감 관련 경고는 hoursNote 로 카드에 이미 표시된다.
      const closedIndex = scheduled.findIndex((place) => !place.mustVisit && arrivesAfterClose(place))
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

      scheduled = scheduleDay(orderPicks(remaining), { dayStartMin, transport })
    }

    days.push({ places: scheduled })
  }

  // 코스를 짜면서 사용자에게 알려야 할 일이 생겼으면 안내 문구로 모은다.
  // "왜 이 코스가 이렇게 나왔는지"를 설명해 주는 장치다 — 조용히 빼 버리면
  // 사용자는 앱이 장소를 빠뜨린 것으로 오해한다.

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
  if (forcedMissing.length > 0) {
    notices.push(
      `적어 주신 ${forcedMissing.map((word) => `'${word}'`).join('·')}은(는) 여행지 정보에 없어서 위치 없이 코스에 넣었어요. 타임라인에서 시간대를 옮길 수 있어요.`,
    )
  }
  if (forcedClosed.length > 0) {
    notices.push(`${forcedClosed.join('·')}은(는) 여행 날짜에 쉬는 날일 수 있지만, 꼭 가고 싶다고 하셔서 그대로 넣었어요.`)
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
