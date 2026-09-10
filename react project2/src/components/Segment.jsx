export default function Segment({ title, options, value, onChange }) {
  return (
    <fieldset className="segment">
      <legend>{title}</legend>
      <div>
        {options.map((option) => (
          <button key={option} className={value === option ? 'selected' : ''} type="button" onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
