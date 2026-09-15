import { useState } from 'react'
import DateRangeField from '../components/DateRangeField.jsx'
import { destinationCatalog } from '../data/destinations.js'
import { fetchWeatherForecast } from '../lib/api.js'
import { durationLabelFromNights, formatShortDate, nightsBetween } from '../lib/datetime.js'

export default function DatesScreen({
  destination,
  startDate,
  endDate,
  startTime,
  onChangeStart,
  onChangeEnd,
  onChangeStartTime,
  onNext,
  onBack,
  leaving,
}) {
  const nights = nightsBetween(startDate, endDate)
  const isValid = nights >= 0
  const cityCoord = destinationCatalog.find((item) => item.name === destination)

  const [forecastDays, setForecastDays] = useState([])
  const [forecastStatus, setForecastStatus] = useState('idle') // idle | loading | ready | error

  // "확인"을 누른 시점의 날짜 구간을 기억해 두고, 지금 고른 구간과 같을 때만 패널을 연다.
  // 날짜를 다시 바꾸면 패널이 저절로 접히므로 effect 로 되돌릴 필요가 없다.
  const [confirmedRange, setConfirmedRange] = useState('')
  const confirmed = confirmedRange !== '' && confirmedRange === `${startDate}~${endDate}`

  // 캘린더가 (출발, 도착) 두 날짜를 함께 넘겨 준다. 각각 상태에 반영.
  const handleRangeChange = (nextStart, nextEnd) => {
    onChangeStart(nextStart)
    onChangeEnd(nextEnd && nextEnd >= nextStart ? nextEnd : nextStart)
  }

  const handleConfirm = () => {
    if (!isValid) return
    setConfirmedRange(`${startDate}~${endDate}`)
    if (!cityCoord) {
      setForecastStatus('error')
      return
    }

    setForecastStatus('loading')
    fetchWeatherForecast(cityCoord.lat, cityCoord.lng, startDate, endDate)
      .then((days) => {
        setForecastDays(days)
        setForecastStatus('ready')
      })
      .catch(() => setForecastStatus('error'))
  }

  return (
    <section className={leaving ? 'dates-screen is-leaving' : 'dates-screen'}>
      <header className="dest-header">
        <button className="back-button" type="button" onClick={onBack}>← 예산 다시 고르기</button>
        <h1>{destination ? `${destination}, 언제 떠날까요?` : '언제 떠날까요?'}</h1>
        <p>출발하는 날과 돌아오는 날, 그리고 매일 아침 몇 시부터 움직일지 정해 주세요.</p>
      </header>
      <div className="date-form">
        <div className="date-form-range">
          <DateRangeField
            startDate={startDate}
            endDate={endDate}
            onChange={handleRangeChange}
          />
        </div>
        <label className="date-form-time">
          <span>하루를 시작하는 시각</span>
          <input
            type="time"
            value={startTime || '09:30'}
            onChange={(event) => onChangeStartTime?.(event.target.value || '09:30')}
          />
        </label>
      </div>
      <p className="date-summary">
        {isValid ? `${durationLabelFromNights(nights)} 일정이에요.` : '돌아오는 날은 출발일 이후여야 해요.'}
      </p>
      <button className="date-next-button" type="button" disabled={!isValid} onClick={handleConfirm}>확인</button>

      {confirmed && (
        <div className="date-weather-panel">
          {forecastStatus === 'loading' && <p className="date-weather-status">날씨를 불러오는 중이에요...</p>}
          {forecastStatus === 'error' && <p className="date-weather-status">날씨 예보를 가져오지 못했어요.</p>}
          {forecastStatus === 'ready' && (
            <>
              <h2>{destination ? `${destination} 여행 기간 날씨` : '여행 기간 날씨'}</h2>
              <div className="date-weather-grid">
                {forecastDays.map((day) => (
                  <div className="date-weather-day" key={day.date}>
                    <b>{formatShortDate(day.date)}</b>
                    {day.available ? (
                      <>
                        <span className="date-weather-emoji">{day.emoji}</span>
                        <small>{day.minC}° / {day.maxC}°</small>
                      </>
                    ) : (
                      <small>예보 범위 밖</small>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <button className="date-next-button" type="button" onClick={onNext}>출발지 정하러 가기</button>
        </div>
      )}
    </section>
  )
}

// 날짜 다음 단계: 동선의 기준점이 되는 출발지(필수)와 숙소(선택)를 정한다.
// 입력한 텍스트는 /api/geocode 로 좌표를 받아 확정하고, 확정된 것만 다음으로 넘긴다.
