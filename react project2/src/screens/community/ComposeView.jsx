// ─────────────────────────────────────────────────────────────
// screens/community/ComposeView.jsx — 글쓰기: '내 여행'에 저장한 코스를 골라 공유
//
// 새로 코스를 짜는 게 아니라 "내 여행"에 이미 저장해 둔 코스 중 하나를 골라
// 소개 글과 별점을 붙여 올린다.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { sharePost } from '../../lib/communityApi.js'
import { listTrips } from '../../lib/tripsApi.js'
import { RoutePreview } from './RoutePreview.jsx'
import { StarPicker } from './Stars.jsx'

export function ComposeView({ onClose, onDone }) {
  const [trips, setTrips] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [message, setMessage] = useState('')
  const [tripId, setTripId] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [rating, setRating] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    listTrips()
      .then((rows) => {
        if (!alive) return
        setTrips(rows)
        setStatus('ready')
        if (rows[0]) {
          setTripId(rows[0].id)
          setTitle(rows[0].title || rows[0].city + ' 여행 코스')
        }
      })
      .catch((error) => {
        if (!alive) return
        setMessage(error.message)
        setStatus('error')
      })
    return () => {
      alive = false
    }
  }, [])

  const picked = trips.find((t) => t.id === tripId) || null

  const submit = async (event) => {
    event.preventDefault()
    if (!picked) {
      setMessage('공유할 코스를 골라 주세요.')
      return
    }
    if (!title.trim()) {
      setMessage('제목을 입력해 주세요.')
      return
    }
    if (!rating) {
      setMessage('별점을 먼저 매겨 주세요.')
      return
    }
    setBusy(true)
    try {
      const post = await sharePost({
        title: title.trim(),
        city: picked.city,
        dayCount: picked.dayCount,
        summary: summary.trim(),
        body: body.trim(),
        rating,
        payload: picked.payload,
      })
      onDone(post)
    } catch (error) {
      setMessage(error.message)
      setBusy(false)
    }
  }

  return (
    <div className="tw-mx-auto tw-max-w-[720px] tw-px-5 tw-py-6">
      <button
        type="button"
        onClick={onClose}
        className="tw-mb-4 tw-inline-flex tw-items-center tw-gap-1 tw-text-[13px] tw-font-semibold tw-text-cink-muted hover:tw-text-cink"
      >
        ← 목록으로
      </button>
      <h1 className="tw-mb-1 tw-text-[20px] tw-font-bold tw-text-cink">코스 공유하기</h1>
      <p className="tw-mb-5 tw-text-[13px] tw-text-cink-muted">
        &lsquo;내 여행&rsquo;에 저장한 코스를 골라 다른 여행자에게 공유해요.
      </p>

      {status === 'loading' && <p className="tw-py-16 tw-text-center tw-text-sm tw-text-cink-faint">불러오는 중…</p>}
      {status === 'error' && <p className="tw-py-16 tw-text-center tw-text-sm tw-text-cink-muted">{message}</p>}

      {status === 'ready' && trips.length === 0 && (
        <div className="tw-rounded-2xl tw-border tw-border-dashed tw-border-cline tw-py-14 tw-text-center">
          <p className="tw-text-sm tw-text-cink-muted">아직 저장한 코스가 없어요.</p>
          <p className="tw-mt-1 tw-text-[13px] tw-text-cink-faint">
            코스를 만든 뒤 &lsquo;현재 여행 코스 저장&rsquo; 으로 &lsquo;내 여행&rsquo;에 담으면 여기서 공유할 수 있어요.
          </p>
        </div>
      )}

      {status === 'ready' && trips.length > 0 && (
        <form onSubmit={submit} className="tw-space-y-5">
          <div>
            <p className="tw-mb-2 tw-text-[13px] tw-font-bold tw-text-cink">공유할 코스</p>
            <div className="tw-space-y-2">
              {trips.map((t) => (
                <label
                  key={t.id}
                  className={`tw-flex tw-cursor-pointer tw-items-center tw-gap-3 tw-rounded-2xl tw-border tw-p-3 tw-transition-colors ${
                    t.id === tripId
                      ? 'tw-border-caccent tw-bg-caccent-soft'
                      : 'tw-border-cline tw-bg-surface hover:tw-border-caccent/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="trip"
                    value={t.id}
                    checked={t.id === tripId}
                    onChange={() => setTripId(t.id)}
                    className="tw-accent-caccent"
                  />
                  <span className="tw-min-w-0 tw-flex-1">
                    <span className="tw-block tw-truncate tw-text-[14px] tw-font-semibold tw-text-cink">{t.title}</span>
                    <span className="tw-text-[12px] tw-text-cink-faint">
                      {t.city} · {t.dayCount}일 코스
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {picked && (
            <div className="tw-rounded-2xl tw-border tw-border-cline tw-bg-surface tw-p-4">
              <p className="tw-mb-2 tw-text-[13px] tw-font-bold tw-text-cink">이 코스의 동선</p>
              <RoutePreview payload={picked.payload} />
            </div>
          )}

          <label className="tw-block">
            <span className="tw-mb-1.5 tw-block tw-text-[13px] tw-font-bold tw-text-cink">제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="예: 제주 감성 사진 코스 2박 3일"
              className="tw-w-full tw-rounded-2xl tw-border tw-border-cline tw-bg-cbg tw-px-3 tw-py-2.5 tw-text-[14px] tw-text-cink placeholder:tw-text-cink-faint focus:tw-border-caccent focus:tw-outline-none"
            />
          </label>

          <label className="tw-block">
            <span className="tw-mb-1.5 tw-block tw-text-[13px] tw-font-bold tw-text-cink">
              한 줄 소개 <span className="tw-font-normal tw-text-cink-faint">(선택)</span>
            </span>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={120}
              placeholder="예: 뚜벅이 기준 · 사진 스팟 위주"
              className="tw-w-full tw-rounded-2xl tw-border tw-border-cline tw-bg-cbg tw-px-3 tw-py-2.5 tw-text-[14px] tw-text-cink placeholder:tw-text-cink-faint focus:tw-border-caccent focus:tw-outline-none"
            />
          </label>

          <label className="tw-block">
            <span className="tw-mb-1.5 tw-block tw-text-[13px] tw-font-bold tw-text-cink">
              후기 <span className="tw-font-normal tw-text-cink-faint">(선택)</span>
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="이 동선의 좋았던 점, 팁, 주의할 점을 적어 주세요."
              className="tw-w-full tw-rounded-2xl tw-border tw-border-cline tw-bg-cbg tw-p-3 tw-text-[13.5px] tw-leading-relaxed tw-text-cink placeholder:tw-text-cink-faint focus:tw-border-caccent focus:tw-outline-none"
            />
          </label>

          <div className="tw-flex tw-items-center tw-gap-3">
            <span className="tw-text-[13px] tw-font-bold tw-text-cink">
              내 별점 <b className="tw-font-normal tw-text-cink-faint">(필수)</b>
            </span>
            <StarPicker value={rating} onChange={setRating} />
            <span className="tw-text-[13px] tw-font-semibold tw-tabular-nums tw-text-cink">
              {rating ? `${rating}.0` : '선택 안 함'}
            </span>
          </div>
          <p className="tw-text-[11.5px] tw-text-cink-faint">
            이 별점은 다른 여행자의 후기와 함께 평균 별점에 반영돼요.
          </p>

          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-pt-1">
            <button
              type="submit"
              disabled={busy}
              className="tw-rounded-full tw-bg-caccent tw-px-5 tw-py-2.5 tw-text-[13px] tw-font-semibold tw-text-white disabled:tw-opacity-50"
            >
              {busy ? '공유 중…' : '공유하기'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="tw-rounded-full tw-border tw-border-cline tw-px-5 tw-py-2.5 tw-text-[13px] tw-font-medium tw-text-cink-muted hover:tw-text-cink"
            >
              취소
            </button>
            {message && <span className="tw-text-[12px] tw-text-[#C0522E]">{message}</span>}
          </div>
        </form>
      )}
    </div>
  )
}
