// ─────────────────────────────────────────────────────────────
// components/Segment.jsx — 여러 개 중 하나를 고르는 버튼 묶음
//
// 예산·교통편·정렬처럼 선택지가 적을 때 쓰는 공용 컨트롤.
// 드롭다운과 달리 선택지가 한눈에 보여서 조건 선택 화면에 적합하다.
//
// role="group" 과 aria-label 을 준 이유: 버튼 여러 개가 하나의 선택을
// 이룬다는 걸 화면 낭독기에도 알려 주기 위해서다.
// ─────────────────────────────────────────────────────────────

export default function Segment({ title, options, value, onChange }) {
  return (
    <div className="segment" role="group" aria-label={title}>
      {title && <span className="segment-label">{title}</span>}
      <div className="segment-control">
        {options.map((option) => (
          <button
            key={option}
            className={value === option ? 'selected' : ''}
            type="button"
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
