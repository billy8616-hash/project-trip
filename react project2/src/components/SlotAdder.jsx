// ─────────────────────────────────────────────────────────────
// components/SlotAdder.jsx — 타임라인에 장소를 직접 추가하는 입력
//
// 평소에는 작은 "＋ 장소 추가" 글자만 있다가 누르면 입력창이 펼쳐진다.
// 타임라인은 이미 정보가 빽빽해서, 항상 열려 있는 입력창은 방해가 된다.
//
// 접고 펴는 동작에 잔손질이 들어가 있다 — 빈 채로 포커스를 잃거나 Esc 를
// 누르면 접히고, 연속 입력을 위해 추가 후에는 포커스를 유지한다.
//
// 쓰는 곳: ScheduleTimeline
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'

// 기본은 작은 "＋ 장소 추가" 텍스트 버튼만 보이고, 누르면 입력창이 펼쳐진다.
// 빈 채로 포커스를 잃거나 Esc 를 누르면 다시 접힌다.
export default function SlotAdder({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setValue('')
  }

  if (!open) {
    return (
      <button type="button" className="sch-add-toggle" onClick={() => setOpen(true)}>
        ＋ 장소 추가
      </button>
    )
  }

  return (
    <form
      className="sch-add"
      onSubmit={(event) => {
        event.preventDefault()
        const name = value.trim()
        if (!name) {
          close()
          return
        }
        onAdd(name)
        setValue('')
        inputRef.current?.focus()
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
        }}
        onBlur={() => {
          if (!value.trim()) close()
        }}
        placeholder="장소 이름 입력 후 Enter"
        maxLength={24}
        aria-label="새 장소 이름"
      />
      {/* mousedown 기본동작을 막아 input blur(→ 접힘)보다 클릭이 먼저 처리되게 한다. */}
      <button type="submit" aria-label="추가" onMouseDown={(event) => event.preventDefault()}>
        ＋
      </button>
    </form>
  )
}
