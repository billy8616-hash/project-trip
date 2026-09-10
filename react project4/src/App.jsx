import collageUrl from './assets/travel-doodle-collage.png'
import './App.css'

const routeSteps = [
  {
    time: '09:30',
    place: '성수 골목 카페',
    memo: '느긋한 브런치와 첫 목적지 주변 산책',
    tone: 'pencil-blue',
  },
  {
    time: '11:20',
    place: '서울숲 피크닉',
    memo: '취향 키워드에 맞춘 사진 스팟과 쉬는 시간',
    tone: 'pencil-green',
  },
  {
    time: '14:10',
    place: '한강 자전거 루트',
    memo: '날씨와 이동 시간을 반영한 가벼운 액티비티',
    tone: 'pencil-coral',
  },
  {
    time: '18:00',
    place: '노을 맛집 거리',
    memo: '저녁 식사와 야경 코스를 한 번에 연결',
    tone: 'pencil-yellow',
  },
]

const chips = ['감성 카페', '걷기 좋은 길', '사진 명소', '현지 맛집']

function App() {
  return (
    <div className="app-shell">
      <img className="background-collage" src={collageUrl} alt="" aria-hidden="true" />
      <div className="paper-grain" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label="Route Diary home">
          <span className="brand__mark">RD</span>
          <span>
            <strong>Route Diary</strong>
            <small>AI travel scrapbook</small>
          </span>
        </a>

        <nav className="nav-links" aria-label="Main navigation">
          <a href="#planner">플래너</a>
          <a href="#route">추천 루트</a>
          <a href="#notes">다이어리</a>
        </nav>
      </header>

      <main id="top" className="scrapbook">
        <section className="hero-panel" aria-labelledby="hero-title">
          <span className="masking-tape masking-tape--hero" aria-hidden="true" />
          <p className="eyebrow">AI가 하루 동선을 스케치해요</p>
          <h1 id="hero-title">
            여행의 기분을 고르면,
            <br />
            루트가 다이어리처럼 펼쳐져요.
          </h1>
          <p className="hero-copy">
            목적지, 취향, 여행 시간을 적으면 AI가 이동 동선과 쉬는 포인트를 엮어
            따뜻한 스크랩북 스타일의 여행 계획으로 정리해줍니다.
          </p>

          <div className="hero-actions">
            <a className="primary-button" href="#planner">루트 만들기</a>
            <a className="secondary-button" href="#route">샘플 보기</a>
          </div>
        </section>

        <section id="planner" className="planner-card" aria-label="AI route planner">
          <span className="masking-tape masking-tape--form" aria-hidden="true" />
          <div className="section-title">
            <p>Trip request</p>
            <h2>AI 여행 루트 노트</h2>
          </div>

          <form className="planner-form">
            <label>
              <span>어디로 떠날까요?</span>
              <input type="text" defaultValue="서울 성수동" />
            </label>

            <div className="form-grid">
              <label>
                <span>여행 날짜</span>
                <input type="date" defaultValue="2026-10-12" />
              </label>
              <label>
                <span>여행 시간</span>
                <select defaultValue="one-day">
                  <option value="half-day">반나절</option>
                  <option value="one-day">하루</option>
                  <option value="two-days">1박 2일</option>
                </select>
              </label>
            </div>

            <label>
              <span>원하는 분위기</span>
              <textarea defaultValue="걷기 편하고 사진 찍기 좋은 코스, 중간에 조용한 카페가 있으면 좋아요." />
            </label>

            <div className="chip-list" aria-label="Preference tags">
              {chips.map((chip) => (
                <button key={chip} type="button">{chip}</button>
              ))}
            </div>

            <button className="generate-button" type="button">
              AI 루트 생성하기
            </button>
          </form>
        </section>

        <section id="route" className="route-board" aria-labelledby="route-title">
          <span className="paper-clip" aria-hidden="true" />
          <div className="section-title">
            <p>Suggested route</p>
            <h2 id="route-title">오늘의 추천 동선</h2>
          </div>

          <ol className="route-list">
            {routeSteps.map((step) => (
              <li key={step.time} className={step.tone}>
                <time>{step.time}</time>
                <div>
                  <h3>{step.place}</h3>
                  <p>{step.memo}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside id="notes" className="memory-stack" aria-label="Travel scrapbook notes">
          <article className="polaroid polaroid--map">
            <span className="masking-tape masking-tape--photo" aria-hidden="true" />
            <div className="map-doodle" aria-hidden="true">
              <span className="pin pin--a" />
              <span className="pin pin--b" />
              <span className="pin pin--c" />
            </div>
            <p>AI가 이동 순서와 휴식 포인트를 함께 계산해요.</p>
          </article>

          <article className="note-card">
            <h2>여행 전 체크</h2>
            <ul>
              <li>비 오는 날 대체 실내 코스</li>
              <li>도보 15분 이상 구간 표시</li>
              <li>사진 남기기 좋은 시간대 추천</li>
            </ul>
          </article>
        </aside>
      </main>
    </div>
  )
}

export default App
