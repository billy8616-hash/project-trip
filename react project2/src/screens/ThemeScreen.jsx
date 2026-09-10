import Icon from '../components/Icon.jsx'

export default function ThemeScreen({ items, destination, selected, onSelect, onBack, leaving }) {
  return (
    <section className={leaving ? 'themes-screen is-leaving' : 'themes-screen'}>
      <header className="dest-header">
        <button className="back-button" type="button" onClick={onBack}>← 여행지 다시 고르기</button>
        <h1>{destination ? `${destination}, 어떤 결로 떠날까요?` : '어떤 결로 떠날까요?'}</h1>
        <p>테마를 고르면 그 결에 맞춰 하루 동선을 그려 드릴게요.</p>
      </header>
      <div className="theme-grid">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={selected === item.id ? 'theme-card selected' : 'theme-card'}
            onClick={() => onSelect(item.id)}
          >
            <span className="theme-ic"><Icon type={item.icon} /></span>
            <b>{item.label}</b>
            <small>{item.desc}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
