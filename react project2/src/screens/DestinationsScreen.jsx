import { useState } from 'react'

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
