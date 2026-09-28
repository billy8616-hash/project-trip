// ─────────────────────────────────────────────────────────────
// screens/community/PostView.jsx — 코스 상세
//
// 후기 작성·삭제, 추천, "내 여행에 담기"가 여기 모여 있다.
// 변경이 생기면 onChanged 로 목록 쪽에 알려 숫자를 맞춘다.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import {
  deleteMyReview,
  deletePost,
  getCommunityPost,
  toggleLike,
  writeReview,
} from '../../lib/communityApi.js'
import { saveTrip } from '../../lib/tripsApi.js'
import { journeyThemes } from '../../data/travelOptions.js'
import { fmtDate } from './fmtDate.js'
import { RoutePreview } from './RoutePreview.jsx'
import { Stars, StarPicker } from './Stars.jsx'

export function PostView({ postId, user, onRequireLogin, onClose, onChanged }) {
  const [post, setPost] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveState, setSaveState] = useState('내 여행에 담기')
  const [lightboxIndex, setLightboxIndex] = useState(null) // 사진을 크게 보는 중이면 그 인덱스

  // 받아온 글을 화면 상태에 반영한다. (첫 로드와 새로고침이 같은 처리를 쓰도록 분리)
  const apply = useCallback((data) => {
    setPost(data)
    const mine = data.reviews.find((review) => review.isMine)
    if (mine) {
      setRating(mine.rating)
      setBody(mine.body)
    }
    setStatus('ready')
  }, [])

  // 후기/추천 뒤에 다시 불러올 때 쓰는 새로고침 (핸들러에서 호출).
  const load = useCallback(
    () => getCommunityPost(postId).then(apply).catch((error) => setMessage(error.message)),
    [postId, apply],
  )

  // 첫 로드: setState 를 promise 콜백 안에서만 하고, 언마운트되면 버린다.
  useEffect(() => {
    let alive = true
    getCommunityPost(postId)
      .then((data) => { if (alive) apply(data) })
      .catch((error) => {
        if (!alive) return
        setMessage(error.message)
        setStatus('error')
      })
    return () => { alive = false }
  }, [postId, apply])

  // 라이트박스가 떠 있는 동안만 키보드로 넘기고 닫을 수 있게 한다.
  useEffect(() => {
    if (lightboxIndex === null) return undefined
    const images = post?.images || []
    const onKey = (event) => {
      if (event.key === 'Escape') setLightboxIndex(null)
      else if (event.key === 'ArrowRight') setLightboxIndex((i) => (i + 1) % images.length)
      else if (event.key === 'ArrowLeft') setLightboxIndex((i) => (i - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, post])

  // 로그인이 필요한 동작 앞에서 부른다. 로그인 안 됐으면 로그인 패널을 열고 true 반환.
  const needLogin = () => {
    if (user) return false
    onRequireLogin()
    return true
  }

  const like = async () => {
    if (needLogin()) return
    try {
      const result = await toggleLike(postId)
      setPost((prev) => (prev ? { ...prev, ...result } : prev))
      onChanged()
    } catch (error) {
      setMessage(error.message)
    }
  }

  // 마음에 든 동선을 그대로 "내 여행"으로 복사한다.
  // CoursePost.payload 가 SavedCourse.payload 와 같은 모양이라 그대로 넘기면 된다.
  const saveToMyTrips = async () => {
    if (needLogin()) return
    if (!post?.payload) {
      setSaveState('일정 정보 없음')
      setTimeout(() => setSaveState('내 여행에 담기'), 2000)
      return
    }
    setSaveState('담는 중…')
    try {
      await saveTrip({
        title: `${post.title} (${post.authorName} 님 코스)`.slice(0, 80),
        city: post.city,
        dayCount: post.dayCount,
        payload: post.payload,
      })
      setSaveState('담았어요 ✓')
    } catch (error) {
      setSaveState(error.status === 401 ? '로그인 필요' : error.message?.slice(0, 24) || '담기 실패')
    }
    setTimeout(() => setSaveState('내 여행에 담기'), 2200)
  }

  const submitReview = async (event) => {
    event.preventDefault()
    if (needLogin()) return
    if (!rating) {
      setMessage('별점을 먼저 매겨 주세요.')
      return
    }
    if (!body.trim()) {
      setMessage('후기 내용을 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      await writeReview(postId, { rating, body })
      setMessage('')
      await load()
      onChanged()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const removeReview = async () => {
    if (!window.confirm('내 후기를 삭제할까요?')) return
    setBusy(true)
    try {
      await deleteMyReview(postId)
      setBody('')
      setRating(0)
      await load()
      onChanged()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const removePost = async () => {
    if (!window.confirm('이 글을 삭제할까요? 삭제하면 다른 여행자가 남긴 후기·추천도 함께 사라져요.')) return
    setBusy(true)
    try {
      await deletePost(postId)
      onChanged()
      onClose()
    } catch (error) {
      setMessage(error.message)
      setBusy(false)
    }
  }

  const theme = journeyThemes.find((item) => item.id === post?.journeyTheme)

  return (
    <div className="tw-mx-auto tw-max-w-[820px] tw-px-5 tw-py-6">
      <button
        type="button" onClick={onClose}
        className="tw-mb-4 tw-inline-flex tw-items-center tw-gap-1 tw-text-[13px] tw-font-semibold tw-text-cink-muted hover:tw-text-cink"
      >
        ← 목록으로
      </button>

      {status === 'loading' && <p className="tw-py-16 tw-text-center tw-text-sm tw-text-cink-faint">불러오는 중…</p>}
      {status === 'error' && <p className="tw-py-16 tw-text-center tw-text-sm tw-text-cink-muted">{message}</p>}

      {status === 'ready' && post && (
        <>
        <div className="tw-space-y-4">
          {/* 헤더 */}
          <header className="tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-5 tw-shadow-ccard">
            <div className="tw-flex tw-items-center tw-gap-1.5">
              <span className="tw-rounded-md tw-bg-caccent-soft tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-caccent">
                {post.city}
              </span>
              <span className="tw-text-[11px] tw-text-cink-faint">{post.dayCount}일 코스</span>
              {theme && (
                <span className="tw-rounded-md tw-bg-surface-2 tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-cink-muted">
                  {theme.label}
                </span>
              )}
            </div>
            <h1 className="tw-mt-2 tw-text-[20px] tw-font-bold tw-text-cink">{post.title}</h1>
            <p className="tw-mt-1 tw-text-[12.5px] tw-text-cink-faint">
              {post.authorName} · {fmtDate(post.createdAt)}
            </p>

            <div className="tw-mt-3 tw-flex tw-flex-wrap tw-items-center tw-gap-3">
              <span className="tw-inline-flex tw-items-center tw-gap-1.5">
                <Stars value={post.avgRating} size={16} />
                <b className="tw-text-[13px] tw-tabular-nums tw-text-cink">{post.avgRating.toFixed(1)}</b>
                <span className="tw-text-[12px] tw-text-cink-faint">
                  후기 {post.reviewCount} · 글쓴이 평가 포함
                </span>
              </span>
              <button
                type="button" onClick={like}
                disabled={post.isMine}
                title={post.isMine ? '내가 올린 코스는 추천할 수 없어요.' : undefined}
                className={`tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-border tw-px-3 tw-py-1.5 tw-text-[13px] tw-font-semibold tw-tabular-nums tw-transition-colors disabled:tw-cursor-not-allowed disabled:tw-opacity-50 ${
                  post.liked
                    ? 'tw-border-caccent tw-bg-caccent tw-text-white'
                    : 'tw-border-cline tw-text-cink-muted hover:tw-border-caccent/50 hover:tw-text-caccent'
                }`}
              >
                ♥ 추천 {post.likeCount}
              </button>
              <button
                type="button" onClick={saveToMyTrips}
                className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-border tw-border-cline tw-bg-surface tw-px-3 tw-py-1.5 tw-text-[13px] tw-font-semibold tw-text-cink tw-transition-colors hover:tw-border-caccent hover:tw-text-caccent"
              >
                ⤓ {saveState}
              </button>
              {post.isMine && (
                <button
                  type="button" onClick={removePost} disabled={busy}
                  className="tw-ml-auto tw-rounded-lg tw-border tw-border-cline tw-px-2.5 tw-py-1.5 tw-text-[12px] tw-font-medium tw-text-cink-muted hover:tw-text-cink"
                >
                  글 삭제
                </button>
              )}
            </div>

            {post.images?.length > 0 && (
              <div className="tw-mt-4 tw-flex tw-gap-2 tw-overflow-x-auto tw-border-t tw-border-cline tw-pt-4">
                {post.images.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className="tw-shrink-0"
                    aria-label={`${post.title} 사진 ${index + 1} 크게 보기`}
                  >
                    <img
                      src={url}
                      alt={`${post.title} 사진 ${index + 1}`}
                      className="tw-h-40 tw-w-56 tw-rounded-xl tw-border tw-border-cline tw-object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {post.body && (
              <p className="tw-mt-4 tw-whitespace-pre-wrap tw-border-t tw-border-cline tw-pt-4 tw-text-[13.5px] tw-leading-relaxed tw-text-cink-muted">
                {post.body}
              </p>
            )}
          </header>

          {/* 동선 */}
          <section className="tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-5 tw-shadow-ccard">
            <h2 className="tw-mb-3 tw-text-[14px] tw-font-bold tw-text-cink">이 코스의 동선</h2>
            <RoutePreview payload={post.payload} />
          </section>

          {/* 후기 작성 (내 글에는 못 단다) */}
          {!post.isMine && (
            <section className="tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-5 tw-shadow-ccard">
              <h2 className="tw-mb-3 tw-text-[14px] tw-font-bold tw-text-cink">
                {post.myReviewId ? '내 후기 수정' : '후기 남기기'}
              </h2>
              <form onSubmit={submitReview} className="tw-space-y-3">
                <div className="tw-flex tw-items-center tw-gap-3">
                  <span className="tw-text-[13px] tw-text-cink-muted">별점</span>
                  <StarPicker value={rating} onChange={setRating} />
                  <span className="tw-text-[13px] tw-font-semibold tw-tabular-nums tw-text-cink">
                    {rating ? `${rating}.0` : '선택 안 함'}
                  </span>
                </div>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="이 동선 어땠나요? 좋았던 점이나 팁을 남겨 주세요."
                  className="tw-w-full tw-rounded-lg tw-border tw-border-cline tw-bg-cbg tw-p-3 tw-text-[13.5px] tw-leading-relaxed tw-text-cink placeholder:tw-text-cink-faint focus:tw-border-caccent focus:tw-outline-none"
                />
                <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                  <button
                    type="submit" disabled={busy}
                    className="tw-rounded-full tw-bg-caccent tw-px-4 tw-py-2 tw-text-[13px] tw-font-semibold tw-text-white disabled:tw-opacity-50"
                  >
                    {post.myReviewId ? '후기 수정' : '후기 등록'}
                  </button>
                  {post.myReviewId && (
                    <button
                      type="button" onClick={removeReview} disabled={busy}
                      className="tw-rounded-full tw-border tw-border-cline tw-px-4 tw-py-2 tw-text-[13px] tw-font-medium tw-text-cink-muted hover:tw-text-cink"
                    >
                      내 후기 삭제
                    </button>
                  )}
                  {message && <span className="tw-text-[12px] tw-text-[#C0522E]">{message}</span>}
                </div>
              </form>
            </section>
          )}

          {/* 후기 목록 */}
          <section className="tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-5 tw-shadow-ccard">
            <h2 className="tw-mb-3 tw-text-[14px] tw-font-bold tw-text-cink">후기 {post.reviewCount}개</h2>
            {post.reviews.length === 0 ? (
              <p className="tw-text-[13px] tw-text-cink-faint">아직 후기가 없어요. 첫 후기를 남겨 보세요.</p>
            ) : (
              <ul className="tw-divide-y tw-divide-cline">
                {post.reviews.map((review) => (
                  <li key={review.id} className="tw-py-3 first:tw-pt-0 last:tw-pb-0">
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <b className="tw-text-[13px] tw-text-cink">{review.authorName}</b>
                      {review.isMine && (
                        <span className="tw-rounded tw-bg-caccent-soft tw-px-1.5 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-text-caccent">
                          내 후기
                        </span>
                      )}
                      <Stars value={review.rating} size={13} />
                      <span className="tw-ml-auto tw-text-[11.5px] tw-text-cink-faint">{fmtDate(review.createdAt)}</span>
                    </div>
                    <p className="tw-mt-1.5 tw-whitespace-pre-wrap tw-text-[13px] tw-leading-relaxed tw-text-cink-muted">
                      {review.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {lightboxIndex !== null && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="사진 크게 보기"
            onClick={() => setLightboxIndex(null)}
            className="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-bg-black/85 tw-p-4"
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              aria-label="닫기"
              className="tw-absolute tw-right-4 tw-top-4 tw-grid tw-h-9 tw-w-9 tw-place-items-center tw-rounded-full tw-bg-white/10 tw-text-[20px] tw-text-white hover:tw-bg-white/20"
            >
              ×
            </button>
            {post.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setLightboxIndex((i) => (i - 1 + post.images.length) % post.images.length) }}
                  aria-label="이전 사진"
                  className="tw-absolute tw-left-3 tw-top-1/2 tw-grid tw-h-10 tw-w-10 tw--translate-y-1/2 tw-place-items-center tw-rounded-full tw-bg-white/10 tw-text-[18px] tw-text-white hover:tw-bg-white/20"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setLightboxIndex((i) => (i + 1) % post.images.length) }}
                  aria-label="다음 사진"
                  className="tw-absolute tw-right-3 tw-top-1/2 tw-grid tw-h-10 tw-w-10 tw--translate-y-1/2 tw-place-items-center tw-rounded-full tw-bg-white/10 tw-text-[18px] tw-text-white hover:tw-bg-white/20"
                >
                  ›
                </button>
              </>
            )}
            <img
              src={post.images[lightboxIndex]}
              alt={`${post.title} 사진 ${lightboxIndex + 1}`}
              onClick={(event) => event.stopPropagation()}
              className="tw-max-h-[85vh] tw-max-w-[90vw] tw-rounded-lg tw-object-contain"
            />
            {post.images.length > 1 && (
              <span className="tw-absolute tw-bottom-5 tw-left-1/2 tw--translate-x-1/2 tw-text-[12px] tw-tabular-nums tw-text-white/70">
                {lightboxIndex + 1} / {post.images.length}
              </span>
            )}
          </div>
        )}
        </>
      )}
    </div>
  )
}
