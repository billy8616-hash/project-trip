// ─────────────────────────────────────────────────────────────
// screens/DestinationsScreen.jsx — 여행지 고르기 (조건 선택 1단계)
//
// 대표 여행지 10곳은 사진 카드로, 나머지 30곳은 지역 탭 아래 목록으로 보여 준다.
// 40곳을 한꺼번에 카드로 깔면 고르기가 더 어려워져서 둘로 나눴다.
//
// "🔥 지금 뜨는 중" 배지는 네이버 데이터랩 검색 트렌드로 붙인다 —
// 최근 검색량이 기준치(RISING_THRESHOLD) 이상 오른 도시에만 표시한다.
//
// 다음 화면: ThemeScreen
// ─────────────────────────────────────────────────────────────

import { useState } from 'react'

// 검색량이 평소의 1.15배를 넘으면 "뜨는 중"으로 본다. 너무 낮게 잡으면 모든 도시에
// 배지가 붙어 의미가 없어진다.
const RISING_THRESHOLD = 1.15

export default function DestinationsScreen({ items, groups = [], photos, trends, onBack, onPick, leaving }) {
  const [activeRegion, setActiveRegion] = useState(groups[0]?.region ?? '')
  const activeCities = groups.find((group) => group.region === activeRegion)?.cities ?? []

  return (
    <section className={leaving ? 'destinations-screen is-leaving' : 'destinations-screen'}>
      <header className="dest-header">
        <button className="back-button" type="button" onClick={onBack}>← 홈으로</button>
        <h1>가 볼 만한 국내 여행지</h1>
        <p>여행지를 하나 고르면 어떤 결로 떠날지 테마를 골라볼 수 있어요.</p>
      </header>

      <h2 className="dest-section-title">대표 여행지</h2>
      <div className="dest-grid">
        {items.map((item) => {
          const photoUrl = item.photo || photos?.[item.name]
          const isRising = (trends?.[item.name]?.risingRatio ?? 0) >= RISING_THRESHOLD
          return (
            <button className="dest-card" type="button" key={item.name} onClick={() => onPick(item.name)}>
              <span
                className={photoUrl ? 'photo has-real-image' : `photo photo-${item.tone}`}
                style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}
              >
                {isRising && <span className="trend-badge">🔥 지금 뜨는 중</span>}
              </span>
              <b>{item.name}</b>
              <small>{item.tag}</small>
            </button>
          )
        })}
      </div>

      {groups.length > 0 && (
        <>
          <h2 className="dest-section-title">지역별 여행지</h2>
          <div className="dest-region-tabs" role="tablist" aria-label="지역 선택">
            {groups.map((group) => (
              <button
                key={group.region}
                type="button"
                role="tab"
                aria-selected={activeRegion === group.region}
                className={activeRegion === group.region ? 'is-active' : undefined}
                onClick={() => setActiveRegion(group.region)}
              >
                {group.region}
              </button>
            ))}
          </div>
          <ul className="dest-region-list">
            {activeCities.map((city) => (
              <li key={city.name}>
                <button type="button" onClick={() => onPick(city.name)}>{city.name}</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
