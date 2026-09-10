import { useCallback, useEffect, useState } from 'react'
import { journeyThemes, SLOT_LABELS } from '../data/travelOptions.js'
import { deleteTrip, listTrips, renameTrip } from '../lib/tripsApi.js'
import { formatClock, parseClock, scheduleDay } from '../lib/schedule.js'
import { formatShortDate, nightsBetween, durationLabelFromNights } from '../lib/datetime.js'

const SLOT_EMOJI = { 오전: '🌤️', '점심 맛집': '🍽️', '오후 카페': '☕', 저녁: '🌙' }

function themeLabel(id) {
  return journeyThemes.find((item) => item.id === id)?.label || ''
}

// payload.days([[{name, assignedSlot}]]) 를 저장 당시 조건으로 다시 시간까지 매겨 하루 목록으로.
function scheduleFromPayload(payload) {
  const dayStartMin = parseClock(payload?.meta?.dayStartTime || '09:30')
  const transport = payload?.meta?.transport || '대중교통'
  return (payload?.days || []).map((dayPlaces) => {
    const merged = (dayPlaces || []).map((place, index) => ({
      ...place,
      assignedSlot: place.assignedSlot || SLOT_LABELS[Math.min(index, SLOT_LABELS.length - 1)],
    }))
    return scheduleDay(merged, { dayStartMin, transport })
  })
}

export default function MyTripsScreen({ user, onRequireLogin, onReplan, onBack, leaving }) {
  // trips: null = 아직 안 불러옴(로딩), 배열 = 결과. error 가 있으면 에러 표시.
  const [trips, setTrips] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [message, setMessage] = useState('')
  const [openId, setOpenId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  const reload = useCallback(() => {
    setTrips(null)
    setError('')
    setReloadKey((key) => key + 1)
  }, [])

  useEffect(() => {
    if (!user) return undefined
    let alive = true
    listTrips()
      .then((list) => {
        if (alive) setTrips(list)
      })
      .catch((err) => {
        if (alive) setError(err.message || '저장한 여행을 불러오지 못했어요.')
      })
    return () => {
      alive = false
    }
  }, [user, reloadKey])

  const handleDelete = async (id) => {
    if (!window.confirm('이 여행을 삭제할까요?')) return
    try {
      await deleteTrip(id)
      setTrips((list) => list.filter((trip) => trip.id !== id))
    } catch (error) {
      setMessage(error.message || '삭제하지 못했어요.')
    }
  }

  const startEdit = (trip) => {
    setEditingId(trip.id)
    setEditValue(trip.title)
  }

  const submitEdit = async (id) => {
    const next = editValue.trim()
    if (!next) return
    try {
      await renameTrip(id, next)
      setTrips((list) => list.map((trip) => (trip.id === id ? { ...trip, title: next } : trip)))
      setEditingId(null)
    } catch (error) {
      setMessage(error.message || '이름을 바꾸지 못했어요.')
    }
  }

  return (
    <section className={leaving ? 'mytrips-screen is-leaving' : 'mytrips-screen'}>
      <header className="dest-header">
        <button className="back-button" type="button" onClick={onBack}>← 홈으로</button>
        <h1>내 여행</h1>
        <p>저장해 둔 여행 동선을 다시 보고, 같은 조건으로 새로 계획할 수 있어요.</p>
      </header>

      {!user ? (
        <div className="mytrips-empty">
          <b>로그인이 필요해요</b>
          <span>로그인하면 만든 여행 코스를 저장하고 이 페이지에서 다시 볼 수 있어요.</span>
          <button type="button" className="mytrips-login" onClick={onRequireLogin}>로그인하기</button>
        </div>
      ) : error ? (
        <p className="mytrips-status">
          {error}{' '}
          <button type="button" className="mytrips-retry" onClick={reload}>다시 시도</button>
        </p>
      ) : trips === null ? (
        <p className="mytrips-status">불러오는 중이에요…</p>
      ) : trips.length === 0 ? (
        <div className="mytrips-empty">
          <b>아직 저장한 여행이 없어요</b>
          <span>코스 화면 오른쪽 위의 <b>저장</b> 버튼을 누르면 여기에 쌓여요.</span>
        </div>
      ) : (
        <>
          {message && <p className="mytrips-status">{message}</p>}
          <ul className="mytrips-list">
            {trips.map((trip) => {
              const meta = trip.payload?.meta || {}
              const nights = meta.tripStartDate && meta.tripEndDate
                ? nightsBetween(meta.tripStartDate, meta.tripEndDate)
                : Math.max(0, (trip.dayCount || 1) - 1)
              const durationText = durationLabelFromNights(nights)
              const days = openId === trip.id ? scheduleFromPayload(trip.payload) : null
              return (
                <li key={trip.id} className="mytrips-card">
                  <div className="mytrips-card-head">
                    <div className="mytrips-card-title">
                      {editingId === trip.id ? (
                        <form
                          className="mytrips-rename"
                          onSubmit={(event) => {
                            event.preventDefault()
                            submitEdit(trip.id)
                          }}
                        >
                          <input
                            value={editValue}
                            onChange={(event) => setEditValue(event.target.value)}
                            maxLength={80}
                            aria-label="여행 이름"
                            autoFocus
                          />
                          <button type="submit">저장</button>
                          <button type="button" onClick={() => setEditingId(null)}>취소</button>
                        </form>
                      ) : (
                        <>
                          <b>{trip.title}</b>
                          <button type="button" className="mytrips-edit" onClick={() => startEdit(trip)} aria-label="이름 수정">
                            ✎
                          </button>
                        </>
                      )}
                    </div>
                    <span className="mytrips-meta">
                      {trip.city}
                      {meta.journeyTheme ? ` · ${themeLabel(meta.journeyTheme)}` : ''}
                      {` · ${durationText}`}
                      {meta.budget ? ` · ${meta.budget}` : ''}
                      {meta.transport ? ` · ${meta.transport}` : ''}
                    </span>
                    <span className="mytrips-date">
                      {meta.tripStartDate ? `${formatShortDate(meta.tripStartDate)} 출발 · ` : ''}
                      {new Date(trip.updatedAt).toLocaleDateString('ko-KR')} 저장
                    </span>
                  </div>

                  <div className="mytrips-card-actions">
                    <button
                      type="button"
                      className="mytrips-toggle"
                      onClick={() => setOpenId((id) => (id === trip.id ? null : trip.id))}
                    >
                      {openId === trip.id ? '일정 접기 ⌃' : '일정 보기 ›'}
                    </button>
                    <button type="button" className="mytrips-replan" onClick={() => onReplan(trip.payload)}>
                      이 조건으로 다시 계획하기
                    </button>
                    <button type="button" className="mytrips-delete" onClick={() => handleDelete(trip.id)}>삭제</button>
                  </div>

                  {days && (
                    <div className="mytrips-itinerary">
                      {days.map((dayPlaces, d) => (
                        <div key={d} className="mytrips-day">
                          <b>Day {d + 1}</b>
                          {dayPlaces.length === 0 ? (
                            <p className="mytrips-day-empty">저장된 장소가 없어요.</p>
                          ) : (
                            <ol>
                              {dayPlaces.map((place, index) => (
                                <li key={`${place.name}-${index}`}>
                                  <span className="mytrips-time">{formatClock(place.arriveMin)}</span>
                                  <span className="mytrips-slot" aria-hidden="true">
                                    {SLOT_EMOJI[place.assignedSlot] || '📍'}
                                  </span>
                                  <span>{place.name}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
