import { useEffect, useRef, useState } from 'react'
import { SLOT_LABELS } from '../data/travelOptions.js'
import { makeId } from '../lib/ids.js'
import { formatClock, scheduleDay } from '../lib/schedule.js'
import SlotAdder from './SlotAdder.jsx'

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
  const storageKey = `walkalong:schedule:${cityKey}:${themeId || '-'}:${budgetTier || '-'}:${dayCount}`

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

  const cloneDays = (prev) => prev.map((slots) => slots.map((list) => list.slice()))

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
                <span className="sch-slot-label">{SLOT_LABELS[s]}</span>
                <div className="sch-cards">
                  {list.map((card, i) => (
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
                        <b>{card.name}</b>
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
                      </div>
                      {timedByCard[`${d}:${card.id}`]?.hoursNote && (
                        <span className="sch-hours-warn">⚠ {timedByCard[`${d}:${card.id}`].hoursNote}</span>
                      )}
                      {timedByCard[`${d}:${card.id}`]?.travelToNextMin ? (
                        <span className="sch-travel">↓ 약 {timedByCard[`${d}:${card.id}`].travelToNextMin}분</span>
                      ) : null}
                    </div>
                  ))}
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
