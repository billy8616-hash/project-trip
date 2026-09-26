// ─────────────────────────────────────────────────────────────
// screens/course-detail/AddPlaceRow.jsx — "장소 추가" 검색·추가 줄
//
// 평소엔 작은 버튼 하나만 보이고, 누르면 검색창이 펼쳐진다.
// pool(도시 장소 풀)에서 이름이 겹치는 후보를 즉시 보여주고, 고르면 그 장소 그대로(영업시간·
// 사진·평점 포함) 일정에 붙는다. 목록에 없는 곳은 "추가"를 눌러 geocode 로 좌표만 찾아 붙인다 —
// 이 경우 영업시간·사진 같은 정보는 없이 이름과 위치만 가진 채로 들어간다.
// 추천 풀(pool)에서 먼저 찾아보고, 없으면 지오코딩으로 임의의 장소를 좌표까지 얻어서 추가한다.
// ─────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './icons.jsx'

export function AddPlaceRow({ pool = [], excludeNames, onAdd, onGeocode }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('idle') // idle | searching | error
  const [message, setMessage] = useState('')
  const inputRef = useRef(null)
  const rowRef = useRef(null)
  const overlayRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setQuery('')
    setStatus('idle')
    setMessage('')
  }

  const suggestions = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    return pool.filter((place) => !excludeNames?.has(place.name) && place.name.includes(q)).slice(0, 6)
  }, [pool, excludeNames, query])

  // 후보 목록/안내 문구를 입력창 아래 "떠 있는 패널"로 뺐다(문서 흐름에 안 끼움. 아래 렌더 참고).
  // 예전엔 목록이 입력창 바로 밑에서 실제 레이아웃을 밀어내는 방식이었는데, 그러면 타이핑할 때마다
  // 후보 개수(6→4→6…)가 바뀔 때 카드 높이가 같이 바뀌고, 모바일 브라우저가 "포커스된 입력창을
  // 계속 보이게" 하려고 그때마다 자체적으로 스크롤을 다시 계산해 화면이 튀는 원인이 됐다.
  // 오버레이로 빼면 후보가 몇 개든 카드 자체의 높이는 절대 안 바뀌어서, 그 문제가 아예 안 생긴다.
  const hasMessage = status === 'error' || (status !== 'error' && query.trim() && suggestions.length === 0)
  const showOverlay = suggestions.length > 0 || hasMessage

  // 검색창을 열 때 한 번 화면에 보이는 자리로 스크롤한다. 이 카드가 목록 맨 아래(장소 추가
  // 버튼 자리)에 있다 보니, 직접 스크롤해서 내리지 않으면 입력창 자체가 화면 밖에 가려질 수 있다.
  useEffect(() => {
    if (open) rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [open])

  // 오버레이가 "없다가 처음 뜰 때"만 한 번 더 스크롤해서 화면 밖에 가려지지 않게 한다. 오버레이라
  // 카드 높이엔 안 잡히므로(위 주석 참고) rowRef 만으로는 오버레이까지 보장이 안 돼 따로 잡는다.
  // 그 뒤로 후보 개수가 계속 바뀌어도(대부분 계속 showOverlay=true 상태라) 다시 스크롤하지 않는다.
  const hadOverlayRef = useRef(false)
  useEffect(() => {
    if (open && showOverlay && !hadOverlayRef.current) {
      overlayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    hadOverlayRef.current = showOverlay
  }, [open, showOverlay])

  const pick = (place) => {
    onAdd({ name: place.name, assignedSlot: place.slots?.[0] })
    close()
  }

  const submit = async (event) => {
    event.preventDefault()
    const value = query.trim()
    if (!value) {
      close()
      return
    }
    // 화면에 뜬 후보 중 이름이 정확히 같은 게 있으면 그걸 그대로 쓴다(직접 다 타이핑한 경우 대비).
    const exact = suggestions.find((place) => place.name === value)
    if (exact) {
      pick(exact)
      return
    }
    if (!onGeocode) {
      close()
      return
    }
    setStatus('searching')
    setMessage('')
    try {
      const { lat, lng } = await onGeocode(value)
      onAdd({ name: value, location: { lat, lng } })
      close()
    } catch (error) {
      setStatus('error')
      setMessage(error.message || '이 장소를 찾지 못했어요.')
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tw-mb-3 tw-flex tw-w-full tw-items-center tw-justify-center tw-gap-1.5 tw-rounded-cxl tw-border tw-border-dashed tw-border-cline tw-py-3 tw-text-[13px] tw-font-semibold tw-text-cink-muted tw-transition-colors hover:tw-border-caccent/50 hover:tw-text-caccent"
      >
        <Icon name="plus" size={15} /> 장소 추가
      </button>
    )
  }

  return (
    <div ref={rowRef} className="tw-relative tw-mb-3 tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-3 tw-shadow-ccard">
      <form onSubmit={submit} className="tw-flex tw-items-center tw-gap-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setStatus('idle')
            setMessage('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close()
          }}
          placeholder="가고 싶은 곳 이름을 입력하세요"
          className="tw-min-w-0 tw-flex-1 tw-rounded-lg tw-border tw-border-cline tw-bg-cbg tw-px-3 tw-py-2 tw-text-[14px] tw-text-cink tw-outline-none focus:tw-border-caccent"
        />
        <button
          type="submit"
          disabled={status === 'searching'}
          className="tw-shrink-0 tw-rounded-lg tw-bg-caccent tw-px-3 tw-py-2 tw-text-[13px] tw-font-semibold tw-text-white disabled:tw-opacity-50"
        >
          {status === 'searching' ? '찾는 중…' : '추가'}
        </button>
        <button type="button" onClick={close} aria-label="취소" className="tw-shrink-0 tw-rounded-lg tw-px-2 tw-py-2 tw-text-cink-faint hover:tw-text-cink">×</button>
      </form>

      {/* position: absolute 오버레이 — 문서 흐름 밖이라 후보가 몇 개든 위 카드 높이에 안 잡힌다. */}
      {showOverlay && (
        <div
          ref={overlayRef}
          className="tw-absolute tw-left-0 tw-right-0 tw-top-full tw-z-20 tw-mt-2 tw-max-h-64 tw-overflow-y-auto tw-rounded-lg tw-border tw-border-cline tw-bg-surface tw-p-1.5 tw-shadow-lg"
        >
          {suggestions.length > 0 && (
            <ul className="tw-flex tw-flex-col tw-gap-1">
              {suggestions.map((place) => (
                <li key={place.name}>
                  <button
                    type="button"
                    onClick={() => pick(place)}
                    className="tw-flex tw-w-full tw-items-center tw-justify-between tw-gap-2 tw-rounded-lg tw-px-2.5 tw-py-2 tw-text-left tw-text-[13px] tw-text-cink hover:tw-bg-surface-2"
                  >
                    <span className="tw-truncate">{place.name}</span>
                    <span className="tw-ml-2 tw-shrink-0 tw-text-[11px] tw-text-cink-faint">{place.category || place.slots?.[0] || ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {status === 'error' && <p className="tw-px-2 tw-py-1.5 tw-text-[12px] tw-text-red-500">{message}</p>}
          {status !== 'error' && query.trim() && suggestions.length === 0 && (
            <p className="tw-px-2 tw-py-1.5 tw-text-[12px] tw-text-cink-faint">추천 목록에 없으면 "추가"를 눌러 위치를 직접 찾아볼게요.</p>
          )}
        </div>
      )}
    </div>
  )
}
