// ─────────────────────────────────────────────────────────────
// screens/MustVisitScreen.jsx — 꼭 가고 싶은 곳 입력 (조건 선택 6단계, 마지막)
//
// 여기 적은 장소 이름은 코스 생성에서 +20 점을 받는다. 다른 가감점이 최대 ±8 이라
// 사실상 "반드시 포함"에 가깝다 — 사용자가 직접 지정한 것을 알고리즘이
// 이기지 못하게 하려는 의도적인 점수 설계다(lib/course.js).
//
// 이 화면을 지나면 코스가 생성된다.
// ─────────────────────────────────────────────────────────────

export default function MustVisitScreen({
  destination,
  mustVisit,
  mustVisitInput,
  onAddMustVisit,
  onChangeMustVisitInput,
  onRemoveMustVisit,
  onNext,
  onBack,
  leaving,
}) {
  return (
    <section className={leaving ? 'origin-screen is-leaving' : 'origin-screen'}>
      <header className="dest-header">
        <button className="back-button" type="button" onClick={onBack}>← 출발지 다시 입력</button>
        <h1>꼭 들르고 싶은 곳이 있나요?</h1>
        <p>
          {destination ? `${destination}에서 ` : ''}빼놓고 싶지 않은 장소를 적어 두면 코스에 함께 반영해요.
          없으면 그냥 넘어가도 좋아요.
        </p>
      </header>

      <div className="origin-form">
        <form
          className="diary-must"
          onSubmit={(event) => {
            event.preventDefault()
            onAddMustVisit()
          }}
        >
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

        <button className="date-next-button" type="button" onClick={onNext}>
          여행 코스 만들기
        </button>
      </div>
    </section>
  )
}
