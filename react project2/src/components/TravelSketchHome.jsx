// ─────────────────────────────────────────────────────────────
// components/TravelSketchHome.jsx — 첫 화면(홈)
//
// 앱을 열면 보이는 종이 다이어리 느낌의 화면. 두 갈래 진입로를 준다.
//   1) 여행지를 직접 고르기 → 조건 선택 흐름으로
//   2) "오늘의 추천" 코스를 바로 보기 → 조건 없이 완성된 코스로
//
// 2번이 있는 이유: 처음 온 사람에게 "조건 고르기"부터 시키면 이 앱이
// 무엇을 만들어 주는지 보기까지 단계가 너무 많다. 결과를 먼저 보여 준다.
//
// 쓰는 곳: App.jsx (screen === 'home')
// ─────────────────────────────────────────────────────────────

import { formatClock } from '../lib/schedule.js'
import { destinationCatalog } from '../data/destinations.js'

const FEATURED_NAMES = ['서울', '제주', '경주', '부산']
const featuredCities = FEATURED_NAMES.map((name) => {
  const entry = destinationCatalog.find((city) => city.name === name)
  return { name, label: name, photo: entry?.photo }
})

// "오늘의 추천" 스트립 아이콘 — 시간대별로.
const SLOT_ICON = {
  오전: '🌤️',
  '점심 맛집': '🍽️',
  '오후 카페': '☕',
  저녁: '🌙',
}

export default function TravelSketchHome({
  cityPhotos,
  destination,
  leaving,
  todayCity,
  todayCourse,
  todayStatus,
  onChangeDestination,
  onPickCity,
  onRetryToday,
  onStartCourse,
  onStartToday,
}) {
  const todaySteps = todayCourse?.days?.[0]?.places || []
  return (
    <section className={leaving ? 'sketch-home is-leaving' : 'sketch-home'}>
      <article className="diary-page">
        <span className="diary-clip" aria-hidden="true" />
        <span className="diary-doodle star-one" aria-hidden="true">☆</span>
        <span className="diary-doodle heart-one" aria-hidden="true">♥</span>
        <span className="diary-doodle heart-two" aria-hidden="true">♡</span>

        <p className="diary-eyebrow">AI 국내 여행 코스 큐레이터</p>
        <h1 className="diary-title">
          AI가 당신만을 위한
          <br />
          <mark>맞춤형 국내 여행 코스</mark>를 그립니다.
        </h1>
        <p className="diary-sub">
          예산, 이동수단, 여행 스타일을 입력하면
          <br />
          하루 동선을 가볍고 알차게 추천해요.
        </p>

        <div className="diary-search">
          <label className="diary-field">
            <span>목적지</span>
            <input
              value={destination}
              onChange={(event) => onChangeDestination(event.target.value)}
              placeholder="어디로 떠나볼까요? (예: 강릉)"
              aria-label="목적지"
            />
          </label>
          <button type="button" className="diary-start" onClick={onStartCourse}>
            여행 시작하기 <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="diary-cards">
          {featuredCities.map((city) => (
            <button
              key={city.name}
              type="button"
              className="diary-card"
              onClick={() => onPickCity(city.name)}
            >
              <span
                className={(city.photo || cityPhotos[city.name]) ? 'diary-card-photo has-photo' : 'diary-card-photo'}
                style={
                  city.photo || cityPhotos[city.name]
                    ? { backgroundImage: `url(${city.photo || cityPhotos[city.name]})` }
                    : undefined
                }
              />
              <b>{city.label}</b>
              <span className="diary-card-heart" aria-hidden="true">♡</span>
            </button>
          ))}
        </div>

        <hr className="diary-rule" />

        <h2 className="diary-h2">
          <mark>오늘의 추천 AI 코스</mark>
        </h2>
        {todayCity && <p className="diary-today-city">오늘은 · {todayCity} 하루 코스</p>}
        {todaySteps.length > 0 ? (
          <>
            <ol className="diary-route">
              {todaySteps.map((step) => (
                <li key={step.name} className="diary-step">
                  <span className="diary-step-icon" aria-hidden="true">
                    {SLOT_ICON[step.assignedSlot] || '📍'}
                  </span>
                  <b>{formatClock(step.arriveMin)}</b>
                  <span>{step.name}</span>
                </li>
              ))}
            </ol>
            <button type="button" className="diary-today-go" onClick={onStartToday}>
              이 코스로 시작하기 <span aria-hidden="true">→</span>
            </button>
          </>
        ) : todayStatus === 'error' ? (
          <p className="diary-today-loading">
            오늘의 추천 코스를 불러오지 못했어요.{' '}
            <button type="button" className="diary-today-retry" onClick={onRetryToday}>다시 시도</button>
          </p>
        ) : (
          <p className="diary-today-loading">
            {todayCity ? `${todayCity} ` : ''}추천 코스를 준비하고 있어요… (처음이면 조금 걸려요)
          </p>
        )}

      </article>
    </section>
  )
}
