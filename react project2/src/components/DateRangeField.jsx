import { useEffect, useMemo, useRef, useState } from 'react'
import { WEEKDAYS, formatShortDate, nightsBetween, durationLabelFromNights, todayISO } from '../lib/datetime.js'

/* ============================================================================
 *  기간 선택 캘린더 (Date Range Picker) — 숙소 예약 앱 스타일.
 *
 *  · 인풋을 누르면 아래로 달력 팝오버가 열린다.
 *  · 첫 클릭 = 출발일, 두 번째 클릭 = 도착일(출발일 이후만). 완료되면 자동으로 닫히고
 *    onChange(출발ISO, 도착ISO) 가 호출된다.
 *  · 외부 의존성 없음. 스타일은 index.css 의 .daterange-* (기존 베이지/손글씨 무드).
 *
 *  props
 *    startDate, endDate : 현재 선택값 (YYYY-MM-DD). 이게 곧 "확정된" 구간이다.
 *    minDate            : 이 날짜 이전은 못 고름 (기본: 오늘)
 *    onChange(start,end): 도착일까지 정해지면 호출. 진행 중에는 부르지 않는다.
 * ========================================================================== */

// YYYY-MM-DD → { y, m }  (m 은 0-based)
function ym(iso) {
  const [y, m] = iso.split('-').map(Number)
  return { y, m: m - 1 }
}
function isoOf(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function addMonths(view, delta) {
  const total = view.y * 12 + view.m + delta
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 }
}

// 그 달의 6주(42칸) 격자. 앞뒤로 인접 달 날짜를 채워 준다.
function monthCells(view) {
  const first = new Date(view.y, view.m, 1)
  const startOffset = first.getDay() // 0=일
  const cells = []
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(view.y, view.m, 1 - startOffset + i)
    cells.push({
      iso: isoOf(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      adjacent: date.getMonth() !== view.m,
    })
  }
  return cells
}

export default function DateRangeField({ startDate, endDate, minDate, onChange }) {
  const min = minDate || todayISO()
  const today = todayISO()

  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => ym(startDate || min))
  // 출발일만 고르고 도착일을 기다리는 중이면 anchor 에 그 출발일이 들어간다. (null = 진행 중 아님)
  const [anchor, setAnchor] = useState(null)
  const [hover, setHover] = useState('')
  const rootRef = useRef(null)

  const selecting = anchor !== null
  // 화면에 그릴 구간: 진행 중이면 anchor~(호버), 아니면 확정된 props 구간.
  const rangeStart = selecting ? anchor : startDate
  const rangeEnd = selecting ? (hover && hover > anchor ? hover : '') : endDate

  // 바깥 클릭 · Esc 로 닫기 (진행 중이었다면 취소하고 확정 구간으로 되돌린다)
  useEffect(() => {
    if (!open) return undefined
    const close = () => {
      setOpen(false)
      setAnchor(null)
      setHover('')
    }
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) close()
    }
    const onKey = (event) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openPop = () => {
    setView(ym(startDate || min))
    setAnchor(null)
    setHover('')
    setOpen(true)
  }

  const pick = (iso) => {
    if (iso < min) return
    if (!selecting) {
      // 첫 클릭: 출발일 후보를 잡고 도착일을 기다린다
      setAnchor(iso)
      return
    }
    if (iso <= anchor) {
      // 출발일 이전(또는 같은 날)을 누르면 → 그 날을 새 출발일로
      setAnchor(iso)
      return
    }
    // 두 번째 클릭: 도착일 확정 → 부모에 반영하고 닫기
    onChange(anchor, iso)
    setAnchor(null)
    setHover('')
    setOpen(false)
  }

  const cells = useMemo(() => monthCells(view), [view])
  const nights = rangeStart && rangeEnd ? nightsBetween(rangeStart, rangeEnd) : null
  const monthLabel = `${view.y}년 ${view.m + 1}월`
  const inBand = (iso) => rangeEnd && iso > rangeStart && iso < rangeEnd

  // 트리거(인풋) 표시값
  const sameDay = !endDate || endDate === startDate
  const startLabel = startDate ? formatShortDate(startDate) : '날짜 선택'
  const endLabel = startDate ? (sameDay ? '당일' : formatShortDate(endDate)) : '날짜 선택'

  return (
    <div className={open ? 'daterange is-open' : 'daterange'} ref={rootRef}>
      <button
        type="button"
        className="daterange-trigger"
        onClick={() => (open ? setOpen(false) : openPop())}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="dr-field">
          <span className="dr-label">여행 출발하는 날</span>
          <span className={startDate ? 'dr-value' : 'dr-value is-dim'}>{startLabel}</span>
        </span>
        <span className="dr-arrow" aria-hidden="true">→</span>
        <span className="dr-field">
          <span className="dr-label">집에 돌아오는 날</span>
          <span className={startDate && !sameDay ? 'dr-value' : 'dr-value is-dim'}>{endLabel}</span>
        </span>
      </button>

      {open && (
        <div className="daterange-pop" role="dialog" aria-label="여행 기간 선택">
          <div className="dr-caption">
            <span>
              <b>출발</b> {rangeStart ? formatShortDate(rangeStart) : '—'}
            </span>
            <span>
              <b>도착</b>{' '}
              {rangeEnd ? formatShortDate(rangeEnd) : selecting ? '날짜를 골라 주세요' : '—'}
            </span>
            {nights != null && <span className="dr-nights">{durationLabelFromNights(nights)}</span>}
          </div>

          <div className="dr-nav">
            <button type="button" onClick={() => setView((v) => addMonths(v, -1))} aria-label="이전 달">‹</button>
            <strong>{monthLabel}</strong>
            <button type="button" onClick={() => setView((v) => addMonths(v, 1))} aria-label="다음 달">›</button>
          </div>

          <div className="dr-weekdays" aria-hidden="true">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="dr-grid" onMouseLeave={() => setHover('')}>
            {cells.map((cell) => {
              const past = cell.iso < min
              const isStart = cell.iso === rangeStart
              const isEnd = Boolean(rangeEnd) && cell.iso === rangeEnd
              const cls = ['dr-day']
              if (cell.adjacent) cls.push('is-adjacent')
              if (past) cls.push('is-past')
              if (cell.iso === today) cls.push('is-today')
              if (inBand(cell.iso)) cls.push('is-band')
              if (isStart) cls.push('is-start')
              if (isEnd) cls.push('is-end')
              if (isStart && isEnd) cls.push('is-single')
              return (
                <button
                  key={cell.iso}
                  type="button"
                  className={cls.join(' ')}
                  disabled={past}
                  onClick={() => pick(cell.iso)}
                  onMouseEnter={() => selecting && setHover(cell.iso)}
                >
                  <span>{cell.day}</span>
                </button>
              )
            })}
          </div>

          <div className="dr-actions">
            <button
              type="button"
              className="dr-reset"
              onClick={() => {
                setAnchor(null)
                setHover('')
                setView(ym(startDate || min))
              }}
            >
              다시 선택
            </button>
            <button
              type="button"
              className="dr-done"
              onClick={() => {
                // 진행 중이면(출발일만 고른 상태) 당일치기로 확정, 아니면 그냥 닫기
                if (selecting) onChange(anchor, anchor)
                setAnchor(null)
                setHover('')
                setOpen(false)
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
