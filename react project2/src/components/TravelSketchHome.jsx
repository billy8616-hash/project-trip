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

import { useMemo, useState } from 'react'
import { formatClock } from '../lib/schedule.js'
import { allDestinations, destinationCatalog } from '../data/destinations.js'

// 자동완성 후보를 이 개수까지만 보여준다 — 다 보여주면 스크롤이 길어져 오히려 고르기 번거롭다.
const SUGGEST_LIMIT = 8

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
  destinationError,
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

  // ── 목적지 자동완성 ────────────────────────────────────────────────────
  // 지원하는 40개 여행지 중에서만 코스를 만들 수 있는데, 이전엔 입력창이 자유
  // 텍스트라 목록에 없는 이름을 적어도 그대로 다음 화면으로 넘어갔다(그러면
  // 코스 생성 단계에서 조용히 다른 도시로 대체됐다). 타이핑하는 동안 실제로
  // 되는 도시만 후보로 보여주고, 그중 하나를 정확히 골라야만 시작되게 한다.
  const [suggestOpen, setSuggestOpen] = useState(false)
  // 방금 후보에서 고른 이름은 다시 검색하지 않는다 — 고르자마자 같은 이름으로
  // 또 필터링해서 목록이 다시 펼쳐지는 것을 막는다.
  const [pickedName, setPickedName] = useState('')

  const trimmedDestination = destination.trim()
  const suggestions = useMemo(() => {
    if (!trimmedDestination || trimmedDestination === pickedName) return []
    return allDestinations.filter((city) => city.name.includes(trimmedDestination)).slice(0, SUGGEST_LIMIT)
  }, [trimmedDestination, pickedName])

  const changeDestination = (value) => {
    setPickedName('')
    onChangeDestination(value)
  }

  const pickSuggestion = (name) => {
    setPickedName(name)
    onChangeDestination(name)
    setSuggestOpen(false)
  }

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
          <div className="diary-dest-wrap">
            <label className="diary-field">
              <span>목적지</span>
              <input
                value={destination}
                onChange={(event) => changeDestination(event.target.value)}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => window.setTimeout(() => setSuggestOpen(false), 120)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSuggestOpen(false)
                }}
                placeholder="어디로 떠나볼까요? (예: 강릉)"
                aria-label="목적지"
                autoComplete="off"
              />
            </label>

            {suggestOpen && trimmedDestination && (
              <div className="origin-suggest diary-dest-suggest">
                {suggestions.length > 0 ? (
                  <ul className="origin-suggest-list">
                    {suggestions.map((city) => (
                      <li key={city.name}>
                        <button type="button" onMouseDown={() => pickSuggestion(city.name)}>
                          <b>{city.name}</b>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="origin-suggest-note">
                    아직 지원하지 않는 도시예요. 목록에 있는 여행지 중에서 골라주세요.
                  </p>
                )}
              </div>
            )}
          </div>
          <button type="button" className="diary-start" onClick={onStartCourse}>
            여행 시작하기 <span aria-hidden="true">→</span>
          </button>
        </div>
        {destinationError && <p className="origin-message diary-dest-error">{destinationError}</p>}

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
