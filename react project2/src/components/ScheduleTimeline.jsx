// ─────────────────────────────────────────────────────────────
// components/ScheduleTimeline.jsx — 코스 타임라인 (드래그 편집 + 시각 표시)
//
// 화면에서 가장 상호작용이 많은 부분. 하루를 오전·점심·오후·저녁 네 칸으로
// 나눠 장소 카드를 보여 주고, 드래그로 순서를 바꾸거나 장소를 넣고 뺄 수 있다.
//
// 데이터 구조가 핵심이다:
//   days[일자][슬롯][순서] = { id, name, location }
// 3중 배열이라 "Day 2 의 점심 칸 두 번째 카드"를 좌표처럼 {d, s, i} 로 가리킬 수 있고,
// 드래그 이동은 그 좌표에서 빼서 저 좌표에 꽂는 일이 된다(moveCard).
//
// 카드에는 이름·좌표만 들어 있고, 카테고리·영업시간 같은 정보는 App 이 넘겨준
// placeInfoByName 에서 그때그때 끌어와 붙인다. 카드를 가볍게 유지해 localStorage
// 저장·복원을 단순하게 만들기 위해서다.
//
// 시각(도착·이동시간·마감 경고)은 저장하지 않고 매 렌더마다 lib/schedule.js 로
// 다시 계산한다 — 순서를 바꾸면 그 뒤 모든 시각이 달라지기 때문이다.
//
// 쓰는 곳: App.jsx (코스 화면)
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { SLOT_LABELS } from '../data/travelOptions.js'
import { makeId } from '../lib/ids.js'
import { placeKindOf } from '../lib/placeKind.js'
import { formatClock, scheduleDay } from '../lib/schedule.js'
import { formatDurationMin } from '../lib/travelTime.js'
import SlotAdder from './SlotAdder.jsx'
import { KakaoMark, NaverMark } from './MapMarks.jsx'

// 슬롯 라벨은 실제 배정 결과에 맞춰 느슨하게 — "점심 맛집"/"오후 카페"는 그 자리에
// 실제 음식점·카페(카카오 로컬 풀)가 들어왔을 때만 쓰고, 아니면 "점심"/"오후"로 표시한다.
function slotDisplayLabel(slotKey, list, placeInfoByName) {
  const hasFood = list.some((card) => placeInfoByName?.get(card.name)?.source === 'kakao')
  if (slotKey === '점심 맛집') return hasFood ? '점심 맛집' : '점심'
  if (slotKey === '오후 카페') return hasFood ? '오후 카페' : '오후'
  return slotKey // '오전', '저녁'
}

// 카드 카테고리 태그(#…) 라벨.
const KIND_TAG = {
  cafe: '카페',
  bar: '술집',
  museum: '전시·박물관',
  viewpoint: '전망대',
  market: '전통시장',
  themepark: '체험·테마파크',
  spa: '온천·스파',
  nature: '자연',
  history: '고궁·유적',
  restaurant: '맛집',
  sight: '명소',
}

export default function ScheduleTimeline({
  cityKey,
  seedDays,
  dayCount,
  transport,
  themeId,
  budgetTier,
  dayStartMin,
  placeInfoByName,
  onDaysChange,
  selectedDay = 0,
  selectedPlace,
  onSelectPlace,
}) {
  // 저장 키에 도시·테마·예산·일수를 전부 넣는다. 조건이 다르면 다른 일정이므로
  // 서로의 편집 결과를 덮어쓰지 않게 하려는 것이다.
  const storageKey = `walkalong:schedule:${cityKey}:${themeId || '-'}:${budgetTier || '-'}:${dayCount}`

  // 추천 코스를 편집 가능한 카드 배열로 바꾼다. 화면을 처음 열 때와
  // "추천 코스로 초기화"를 눌렀을 때 쓴다.
  const buildSeed = () => {
    const emptyDay = () => SLOT_LABELS.map(() => [])
    const nextDays = Array.from({ length: dayCount }, emptyDay)
    // seedDays[d] = 그 날의 추천 장소 목록. 날짜별로 각자의 오전/점심/오후/저녁 슬롯에 순서대로 담는다.
    ;(seedDays || []).forEach((dayPlaces, d) => {
      if (d >= dayCount) return
      dayPlaces.forEach((place, index) => {
        const slot = Math.min(index, SLOT_LABELS.length - 1)
        nextDays[d][slot].push({ id: makeId(), name: place.name, location: place.location || null })
      })
    })
    return nextDays
  }

  // 저장해 둔 편집 결과를 읽는다. 일수가 안 맞으면(조건이 바뀐 것) 버리고 새로 만든다.
  const readStore = () => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === dayCount) return parsed
    } catch {
      /* localStorage 접근 불가(사생활 모드 등) */
    }
    return null
  }

  const [days, setDays] = useState(() => readStore() || buildSeed())
  const dragRef = useRef(null)

  // 한 날 안에서 (슬롯 s, i번째) 카드가 그 날 전체 방문 순서로 몇 번째인지. 지도·상세보기의 selectedPlace 와 맞춘다.
  const dayIndexOf = (targetDay, targetSlot, targetIndex) => {
    let index = 0
    for (let s = 0; s < days[targetDay].length; s += 1) {
      if (s === targetSlot) return index + targetIndex
      index += days[targetDay][s].length
    }
    return targetIndex
  }

  // 도시/테마/예산/기간이 바뀌면 일정도 처음부터 다시 잡아야 하는데,
  // effect 안에서 setDays 로 되돌리면 렌더가 한 번 더 돈다. 대신 App 이 같은 조합으로
  // 만든 key 를 넘겨서 이 컴포넌트를 통째로 새로 마운트한다 — useState 초기값이 그때 다시 계산된다.

  // 변경될 때마다 저장 -> 새로고침해도 유지
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(days))
    } catch {
      /* 저장 실패는 무시 */
    }
  }, [storageKey, days])

  // 날짜별 방문 목록(각 날의 슬롯을 순서대로 평탄화)을 App 으로 올려보낸다.
  useEffect(() => {
    onDaysChange?.(days.map((slots) => slots.flat()))
  }, [days, onDaysChange])

  // 3중 배열을 통째로 복사한다. React 상태는 직접 고치면 안 되므로,
  // 카드를 옮기거나 지우기 전에 항상 이걸 거친다.
  const cloneDays = (prev) => prev.map((slots) => slots.map((list) => list.slice()))

  // 드래그로 카드를 옮긴다. 같은 칸 안에서 뒤로 옮길 때 인덱스를 1 빼는 부분이 요점인데,
  // 원래 자리에서 카드를 먼저 빼고 나면 그 뒤 항목들이 한 칸씩 당겨지기 때문이다.
  const moveCard = (to) => {
    const from = dragRef.current
    dragRef.current = null
    if (!from) return
    setDays((prev) => {
      const next = cloneDays(prev)
      const [card] = next[from.d][from.s].splice(from.i, 1)
      if (!card) return prev
      let index = to.i
      if (to.d === from.d && to.s === from.s && from.i < index) index -= 1
      next[to.d][to.s].splice(index, 0, card)
      return next
    })
  }

  // 사용자가 직접 입력한 장소를 추가한다. 추천 풀에 없는 곳이라 좌표가 없고(location: null),
  // 그래서 이동시간은 교통편별 기본값으로 추정된다(lib/travelTime.js).
  const addPlace = (d, s, name) => {
    const value = name.trim()
    if (!value) return
    setDays((prev) => {
      const next = cloneDays(prev)
      next[d][s].push({ id: makeId(), name: value, location: null })
      return next
    })
  }

  const removePlace = (d, s, i) => {
    setDays((prev) => {
      const next = cloneDays(prev)
      next[d][s].splice(i, 1)
      return next
    })
  }

  // 편집 내용을 버리고 처음 추천받은 코스로 되돌린다.
  const resetSchedule = () => {
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      /* 무시 */
    }
    setDays(buildSeed())
  }

  // 각 날을 방문 순서로 펼쳐, 하루 시작 시각 기준으로 도착 시각·다음까지 이동시간·영업시간 경고를 계산한다.
  // 카드에는 이름밖에 없으므로 추천 풀 정보(placeInfoByName)에서 카테고리·영업시간을 끌어와 붙인다.
  const timedByCard = {}
  days.forEach((slots, d) => {
    const sequence = []
    slots.forEach((list, s) => {
      list.forEach((card) => {
        const info = placeInfoByName?.get(card.name) || {}
        sequence.push({
          ...card,
          location: card.location || info.location || null,
          category: info.category,
          source: info.source,
          opensAt: info.opensAt,
          closesAt: info.closesAt,
          alwaysOpen: info.alwaysOpen,
          assignedSlot: SLOT_LABELS[s],
        })
      })
    })
    scheduleDay(sequence, { dayStartMin, transport }).forEach((place) => {
      timedByCard[`${d}:${place.id}`] = {
        arriveMin: place.arriveMin,
        travelToNextMin: place.travelToNextMin,
        hoursNote: place.hoursNote,
      }
    })
  })

  return (
    <section className="schedule">
      <div className="schedule-head">
        <h2>추천 코스 타임라인</h2>
        <div>
          <span className="schedule-mode">{transport} 기준 이동시간 · 자동 저장</span>
          <button type="button" onClick={resetSchedule}>추천 코스로 초기화</button>
        </div>
      </div>
      <div className="schedule-days">
        {days.map((slots, d) => (
          <div className="sch-day" key={d}>
            <h3>Day {d + 1}</h3>
            {slots.map((list, s) => (
              <div
                className="sch-slot"
                key={s}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveCard({ d, s, i: list.length })}
              >
                <span className="sch-slot-label">{slotDisplayLabel(SLOT_LABELS[s], list, placeInfoByName)}</span>
                <div className="sch-cards">
                  {list.map((card, i) => {
                    const info = placeInfoByName?.get(card.name) || {}
                    const kind = placeKindOf({
                      category: info.category,
                      source: info.source,
                      name: card.name,
                      assignedSlot: SLOT_LABELS[s],
                    })
                    const query = encodeURIComponent(`${cityKey} ${card.name}`)
                    return (
                    <div className="sch-card-wrap" key={card.id}>
                      <div
                        className={selectedDay === d && selectedPlace === dayIndexOf(d, s, i) ? 'sch-card selected' : 'sch-card'}
                        draggable
                        onClick={() => onSelectPlace?.(d, dayIndexOf(d, s, i))}
                        onDragStart={() => {
                          dragRef.current = { d, s, i }
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.stopPropagation()
                          moveCard({ d, s, i })
                        }}
                      >
                        <span className="sch-grip" aria-hidden="true">⠿</span>
                        <time className="sch-clock">{formatClock(timedByCard[`${d}:${card.id}`]?.arriveMin ?? dayStartMin ?? 0)}</time>
                        <span className="sch-card-main">
                          <b>{card.name}</b>
                          <span className="sch-tag">#{KIND_TAG[kind] || '명소'}</span>
                        </span>
                        <span className="sch-card-actions">
                          <a
                            className="sch-map-link"
                            href={`https://map.kakao.com/link/search/${query}`}
                            target="_blank"
                            rel="noreferrer"
                            draggable={false}
                            aria-label={`${card.name} 카카오맵에서 보기`}
                            title="카카오맵에서 보기"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <KakaoMark />
                          </a>
                          <a
                            className="sch-map-link"
                            href={`https://map.naver.com/p/search/${query}`}
                            target="_blank"
                            rel="noreferrer"
                            draggable={false}
                            aria-label={`${card.name} 네이버지도에서 보기`}
                            title="네이버지도에서 보기"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <NaverMark />
                          </a>
                          <button
                            type="button"
                            className="sch-del"
                            onClick={(event) => {
                              event.stopPropagation()
                              removePlace(d, s, i)
                            }}
                            aria-label={`${card.name} 삭제`}
                          >
                            ×
                          </button>
                        </span>
                      </div>
                      {timedByCard[`${d}:${card.id}`]?.hoursNote && (
                        <span className="sch-hours-warn">⚠ {timedByCard[`${d}:${card.id}`].hoursNote}</span>
                      )}
                      {timedByCard[`${d}:${card.id}`]?.travelToNextMin ? (
                        <span className="sch-travel">↓ 약 {formatDurationMin(timedByCard[`${d}:${card.id}`].travelToNextMin)}</span>
                      ) : null}
                    </div>
                    )
                  })}
                  {list.length === 0 && <span className="sch-empty">카드를 끌어다 놓거나 아래에서 추가</span>}
                </div>
                <SlotAdder onAdd={(name) => addPlace(d, s, name)} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

// 마커/구간 라벨용: 정류장 종류별 짧은 이름.
