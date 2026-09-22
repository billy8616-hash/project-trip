// ─────────────────────────────────────────────────────────────
// screens/OriginScreen.jsx — 출발지·숙소 입력 (조건 선택 5단계)
//
// 자유 입력 텍스트를 좌표로 바꾸는(지오코딩) 화면. 좌표가 있어야 그 지점을
// 동선의 시작·끝으로 고정할 수 있다(lib/geo.js 의 anchors).
//
// 이 파일에서 눈여겨볼 부분은 "확인한 텍스트"를 좌표와 함께 저장해 두는 방식이다.
// 사용자가 주소를 고친 뒤 확인을 다시 누르지 않으면 예전 좌표가 그대로 쓰이는데,
// 입력값과 저장된 텍스트를 렌더 중에 비교해 그 좌표를 무효로 만든다.
// useEffect 로 지우는 방법보다 렌더가 한 번 덜 돈다.
//
// 건너뛸 수 있는 단계다 — 출발지가 없으면 첫 장소에서 시작하는 코스가 된다.
//
// 다음 화면: MustVisitScreen
// ─────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import { allDestinations } from '../data/destinations.js'
import { fetchGeocode, fetchLodgingSuggestions } from '../lib/api.js'

// 자동완성 검색을 시작하는 최소 글자 수와, 타이핑이 멈췄다고 보는 시간(ms).
// 글자마다 부르면 호출 수가 몇 배로 늘어나므로 입력이 멎은 뒤 한 번만 부른다.
const SUGGEST_MIN_CHARS = 2
const SUGGEST_DEBOUNCE_MS = 300

export default function OriginScreen({ destination, nights, initialOrigin, initialLodging, onConfirm, onBack, leaving }) {
  const [originInput, setOriginInput] = useState(initialOrigin?.label || '')
  const [lodgingInput, setLodgingInput] = useState(initialLodging?.label || '')
  const [status, setStatus] = useState('idle') // idle | resolving | error
  const [message, setMessage] = useState('')

  // 확정된 좌표와 "그 좌표를 만들어 낸 입력 텍스트"를 함께 들고 있는다.
  // 지금 입력이 그때와 다르면 좌표를 무효로 본다 — effect 로 지우면 렌더가 한 번 더 도는데,
  // 렌더 중에 판단하면 그럴 필요가 없다. (입력을 고치면 다시 "확인"을 눌러야 한다)
  const [resolved, setResolved] = useState({
    originText: initialOrigin?.label || '',
    origin: initialOrigin || null,
    lodgingText: initialLodging?.label || '',
    lodging: initialLodging || null,
  })
  const origin = originInput.trim() === resolved.originText ? resolved.origin : null
  const lodging = lodgingInput.trim() === resolved.lodgingText ? resolved.lodging : null

  // 입력이 달라지면 위 파생 계산이 알아서 좌표를 무효로 만든다.
  const useCityAsOrigin = () => {
    setOriginInput(destination || '')
  }

  // ── 숙소 자동완성 ──────────────────────────────────────────────────────
  // 숙소 이름을 적는 동안 그 지역의 숙박업소 후보를 찾아 입력칸 아래에 보여 준다.
  // 목록에서 고르면 좌표까지 함께 확정되므로, "다음"을 누를 때 지오코딩을 다시 하지 않는다.
  // (검색은 카카오 로컬의 숙박 카테고리 — server/kakaoLocal.js 의 searchLodging)

  // 여행지 좌표를 검색 중심으로 넘긴다. "신라"처럼 전국에 흔한 이름을 적었을 때
  // 엉뚱한 지역 숙소가 올라오는 것을 막아 준다.
  const cityCenter = useMemo(
    () => allDestinations.find((city) => city.name === destination) || null,
    [destination],
  )

  const [suggestions, setSuggestions] = useState([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)

  // 방금 목록에서 고른 이름. 이 값이 입력칸에 그대로 있는 동안에는 다시 검색하지 않는다 —
  // 고르자마자 그 이름으로 또 검색해서 목록이 다시 펼쳐지는 것을 막는다.
  const pickedNameRef = useRef(initialLodging?.label || '')

  useEffect(() => {
    const keyword = lodgingInput.trim()
    if (keyword.length < SUGGEST_MIN_CHARS || keyword === pickedNameRef.current) {
      setSuggestions([])
      setSuggestOpen(false)
      setSuggestLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setSuggestLoading(true)
    setSuggestOpen(true)

    const timer = window.setTimeout(() => {
      fetchLodgingSuggestions(keyword, cityCenter, { signal: controller.signal })
        .then((items) => setSuggestions(items))
        .catch(() => {
          // 취소된 요청이면 곧 새 결과가 오므로 건드리지 않는다.
          if (!controller.signal.aborted) setSuggestions([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggestLoading(false)
        })
    }, SUGGEST_DEBOUNCE_MS)

    // 다음 글자가 들어오면 예약된 호출을 취소하고, 이미 나간 요청도 중단한다.
    // 늦게 도착한 옛 응답이 새 결과를 덮어쓰지 않게 하려는 것이다.
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [lodgingInput, cityCenter])

  // 사용자가 직접 고쳐 쓰면 "고른 값"은 무효가 된다 — 다시 검색이 돌아야 한다.
  const changeLodging = (value) => {
    pickedNameRef.current = ''
    setLodgingInput(value)
  }

  // 후보를 고르면 이름과 좌표를 한꺼번에 확정한다. 이러면 handleConfirm 에서
  // 이 숙소를 다시 지오코딩하지 않는다(이미 lodging 이 채워져 있으므로).
  const pickLodging = (item) => {
    pickedNameRef.current = item.name
    setLodgingInput(item.name)
    setResolved((prev) => ({
      ...prev,
      lodgingText: item.name,
      lodging: { label: item.name, lat: item.lat, lng: item.lng, address: item.address },
    }))
    setSuggestions([])
    setSuggestOpen(false)
  }

  const handleConfirm = async () => {
    const originText = originInput.trim()
    if (!originText) {
      setStatus('error')
      setMessage('출발지를 입력해 주세요.')
      return
    }

    setStatus('resolving')
    setMessage('')
    try {
      const resolvedOrigin = origin || (await fetchGeocode(originText))
      let resolvedLodging = lodging
      const lodgingText = lodgingInput.trim()
      if (lodgingText && !resolvedLodging) {
        resolvedLodging = await fetchGeocode(lodgingText).catch(() => null)
        if (!resolvedLodging) {
          setStatus('error')
          setMessage('숙소 위치를 찾지 못했어요. 다시 입력하거나 비워 두세요.')
          return
        }
      }
      if (!lodgingText) resolvedLodging = null

      setResolved({
        originText,
        origin: resolvedOrigin,
        lodgingText,
        lodging: resolvedLodging,
      })
      setStatus('idle')
      onConfirm(resolvedOrigin, resolvedLodging)
    } catch (error) {
      setStatus('error')
      setMessage(error.message || '출발지 위치를 찾지 못했어요.')
    }
  }

  return (
    <section className={leaving ? 'origin-screen is-leaving' : 'origin-screen'}>
      <header className="dest-header">
        <button className="back-button" type="button" onClick={onBack}>← 날짜 다시 고르기</button>
        <h1>어디서 출발하세요?</h1>
        <p>출발지를 기준으로 동선을 그려요. 예약한 숙소가 있으면 함께 알려 주세요.</p>
      </header>

      <div className="origin-form">
        <label>
          <span>출발지 <b className="origin-required">필수</b></span>
          <input
            value={originInput}
            onChange={(event) => setOriginInput(event.target.value)}
            placeholder="예: 서울역, 인천공항, 우리집 주소"
            aria-label="출발지"
          />
          <button type="button" className="origin-quick" onClick={useCityAsOrigin}>
            그냥 {destination || '여행지'}에서 시작할래요
          </button>
        </label>

        <div className="origin-lodging">
          <label>
            <span>숙소 <b className="origin-optional">선택</b></span>
            <input
              value={lodgingInput}
              onChange={(event) => changeLodging(event.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setSuggestOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSuggestOpen(false)
              }}
              placeholder="숙소 이름을 적으면 아래에서 고를 수 있어요"
              aria-label="숙소"
              autoComplete="off"
            />

            <small>
              {nights >= 1
                ? '1박 이상이면 숙소를 기준으로 매일 왕복 동선을 잡습니다. (지금은 첫날 동선에 반영)'
                : '비워 두면 출발지에서 시작해 출발지로 돌아오는 왕복 동선으로 그려요.'}
            </small>
          </label>

          {/* 입력한 글자로 찾은 숙박업소 후보. 고르면 좌표까지 함께 확정된다.
              label 바깥에 두는 이유 — label 안에 버튼을 넣으면 클릭이 입력칸 포커스로
              넘어가면서, 방금 닫은 목록이 도로 열리는 문제가 생긴다. */}
          {suggestOpen && (
            <div className="origin-suggest">
              {suggestLoading && suggestions.length === 0 && (
                <p className="origin-suggest-note">숙소를 찾는 중이에요…</p>
              )}

              {!suggestLoading && suggestions.length === 0 && (
                <p className="origin-suggest-note">
                  검색 결과가 없어요. 이름 대신 주소를 적어도 괜찮아요.
                </p>
              )}

              {suggestions.length > 0 && (
                <ul className="origin-suggest-list">
                  {suggestions.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={lodging?.label === item.name ? 'is-picked' : ''}
                        onClick={() => pickLodging(item)}
                      >
                        <b>{item.name}</b>
                        {item.address && <small>{item.address}</small>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 좌표까지 확정된 숙소는 따로 표시해 준다 — 이 상태면 "다음"에서 위치를 다시 찾지 않는다. */}
          {lodging && !suggestOpen && (
            <p className="origin-picked">
              <b>{lodging.label}</b>
              {lodging.address && <span>{lodging.address}</span>}
              <button type="button" onClick={() => changeLodging('')} aria-label="숙소 지우기">
                ×
              </button>
            </p>
          )}
        </div>

        {status === 'error' && <p className="origin-message">{message}</p>}

        <button
          className="date-next-button"
          type="button"
          disabled={status === 'resolving' || !originInput.trim()}
          onClick={handleConfirm}
        >
          {status === 'resolving' ? '위치 확인 중...' : '다음'}
        </button>
      </div>
    </section>
  )
}
