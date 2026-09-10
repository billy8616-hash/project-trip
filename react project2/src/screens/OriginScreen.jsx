import { useState } from 'react'
import { fetchGeocode } from '../lib/api.js'

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

        <label>
          <span>숙소 <b className="origin-optional">선택</b></span>
          <input
            value={lodgingInput}
            onChange={(event) => setLodgingInput(event.target.value)}
            placeholder="예약한 호텔·게스트하우스 이름이나 주소"
            aria-label="숙소"
          />
          <small>
            {nights >= 1
              ? '1박 이상이면 숙소를 기준으로 매일 왕복 동선을 잡습니다. (지금은 첫날 동선에 반영)'
              : '비워 두면 출발지에서 시작해 출발지로 돌아오는 왕복 동선으로 그려요.'}
          </small>
        </label>

        {status === 'error' && <p className="origin-message">{message}</p>}

        <button
          className="date-next-button"
          type="button"
          disabled={status === 'resolving' || !originInput.trim()}
          onClick={handleConfirm}
        >
          {status === 'resolving' ? '위치 확인 중...' : '여행 코스 만들기'}
        </button>
      </div>
    </section>
  )
}
