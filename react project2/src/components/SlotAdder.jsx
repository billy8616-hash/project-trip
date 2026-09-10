import { useState } from 'react'

export default function SlotAdder({ onAdd }) {
  const [value, setValue] = useState('')
  return (
    <form
      className="sch-add"
      onSubmit={(event) => {
        event.preventDefault()
        onAdd(value)
        setValue('')
      }}
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="장소 추가"
        maxLength={24}
        aria-label="새 장소 이름"
      />
      <button type="submit" aria-label="장소 추가">＋</button>
    </form>
  )
}

// 추천 코스 타임라인 + 드래그앤드롭 재배치 + LocalStorage 유지
