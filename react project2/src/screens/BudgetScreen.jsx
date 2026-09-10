const BUDGET_DESC = {
  저예산: '무료·저렴한 코스 위주로 가볍게',
  보통: '적당한 식사와 입장료까지 여유 있게',
  프리미엄: '좋은 식당·체험 위주로 알차게',
}

export default function BudgetScreen({ options, destination, theme, selected, onSelect, onBack, leaving }) {
  return (
    <section className={leaving ? 'budget-screen is-leaving' : 'budget-screen'}>
      <header className="dest-header">
        <button className="back-button" type="button" onClick={onBack}>← 테마 다시 고르기</button>
        <h1>{destination ? `${destination}, 예산은 어느 정도로?` : '예산을 골라주세요'}</h1>
        <p>{theme ? `${theme} 코스에 맞춰 ` : ''}예산에 맞는 하루 동선을 그려 드릴게요.</p>
      </header>
      <div className="theme-grid">
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            className={selected === option ? 'theme-card selected' : 'theme-card'}
            onClick={() => onSelect(option)}
          >
            <span className="theme-ic budget-mark">{'₩'.repeat(index + 1)}</span>
            <b>{option}</b>
            <small>{BUDGET_DESC[option] || ''}</small>
          </button>
        ))}
      </div>
    </section>
  )
}
