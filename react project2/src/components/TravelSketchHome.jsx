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
  mustVisit,
  mustVisitInput,
  todayCity,
  todayCourse,
  todayStatus,
  onAddMustVisit,
  onChangeDestination,
  onChangeMustVisitInput,
  onPickCity,
  onRemoveMustVisit,
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
              placeholder="부산"
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

        <form
          className="diary-must"
          onSubmit={(event) => {
            event.preventDefault()
            onAddMustVisit()
          }}
        >
          <div className="diary-must-head">
            <b>꼭 들르고 싶은 장소</b>
            <span>가고 싶은 곳을 적어두면 코스에 함께 반영해요.</span>
          </div>
          <div className="diary-must-input">
            <input
              value={mustVisitInput}
              onChange={(event) => onChangeMustVisitInput(event.target.value)}
              placeholder="예: 해운대, 감천문화마을"
              maxLength={20}
              aria-label="꼭 들르고 싶은 장소"
            />
            <button type="submit">추가</button>
          </div>
          {mustVisit.length > 0 && (
            <ul className="diary-must-tags">
              {mustVisit.map((keyword) => (
                <li key={keyword}>
                  {keyword}
                  <button type="button" onClick={() => onRemoveMustVisit(keyword)} aria-label={`${keyword} 삭제`}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      </article>

      <footer className="diary-footer">
        <nav aria-label="하단 메뉴">
          <a href="#sitemap">사이트맵</a>
          <a href="#privacy">개인정보 처리방침</a>
          <a href="#terms">이용 약관</a>
          <a href="#dark">다크코드</a>
          <a href="#festival">축제</a>
        </nav>
      </footer>
    </section>
  )
}
