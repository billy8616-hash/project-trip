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
