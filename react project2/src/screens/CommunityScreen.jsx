// ─────────────────────────────────────────────────────────────
// screens/CommunityScreen.jsx — 커뮤니티 (코스 공유·후기·추천)
//
// 한 파일 안에 세 개의 화면이 들어 있고, 상태 하나로 전환한다.
//   목록   PostCard 격자 + 도시·정렬 필터
//   상세   PostView    — 코스 내용 + 후기 목록 + 후기 작성
//   작성   ComposeView — "내 여행"에 저장한 코스를 골라 공유
//
// 로그인 처리 방식이 이 화면의 특징이다. 보기는 누구나 할 수 있고,
// 추천·후기처럼 쓰기 동작을 눌렀을 때만 onRequireLogin 으로 로그인 창을 띄운다.
// 처음부터 로그인을 요구하면 둘러보지도 못하고 막히기 때문이다.
//
// 공유되는 것은 코스 payload(JSON) 통째다. 그래서 다른 사람의 코스를
// 그대로 "내 여행에 담기"로 가져올 수 있다.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { destinationCatalog } from '../data/destinations.js'
import {
  deleteMyReview,
  deletePost,
  getCommunityPost,
  listCommunityPosts,
  sharePost,
  toggleLike,
  writeReview,
} from '../lib/communityApi.js'
import { listTrips, saveTrip } from '../lib/tripsApi.js'

/* ============================================================================
 *  커뮤니티 — 다른 여행자가 공유한 코스를 보고, 별점·후기를 남기고, 추천하는 화면.
 *
 *  · 읽기는 비로그인도 가능. 쓰기(추천·후기)는 로그인이 필요해서 onRequireLogin 을 부른다.
 *  · 스타일은 코스 상세와 같은 톤 (Tailwind `tw-` 접두사 + course-detail-root 스코프 리셋).
 * ========================================================================== */

const SORTS = [
  { key: 'recent', label: '최신순' },
  { key: 'likes', label: '추천순' },
  { key: 'rating', label: '별점순' },
]

const fmtDate = (value) => {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/* ── 별점 ──────────────────────────────────────────────────────────── */
// 별 하나. 채움 여부만 다르고 모양은 같아서 색만 바꿔 쓴다.
function Star({ filled, size = 14 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill={filled ? '#F5A524' : 'none'} stroke={filled ? '#F5A524' : '#C9C2B4'}
      strokeWidth="1.8" strokeLinejoin="round"
    >
      <path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1-5.4-2.9-5.4 2.9 1.1-6.1L3.2 9.9l6.1-.8z" />
    </svg>
  )
}

// 별점 표시용(읽기 전용) 5개 묶음.
function Stars({ value = 0, size = 14 }) {
  return (
    <span className="tw-inline-flex tw-items-center tw-gap-px" aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={value >= n - 0.25} size={size} />
      ))}
    </span>
  )
}

/* 입력용 별점 */
// 별점 입력용. 누르면 그 개수만큼 채워진다.
function StarPicker({ value, onChange }) {
  return (
    <span className="tw-inline-flex tw-items-center tw-gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n} type="button" onClick={() => onChange(n)} aria-label={`${n}점`}
          className="tw-rounded tw-p-0.5 tw-transition-transform hover:tw-scale-110"
        >
          <Star filled={value >= n} size={22} />
        </button>
      ))}
    </span>
  )
}

/* ── 목록 카드 ─────────────────────────────────────────────────────── */
// 목록에 뿌려지는 코스 카드 한 장. 카드에서 바로 추천을 누를 수 있어서
// 상세를 열지 않고도 반응을 남길 수 있다.
function PostCard({ post, onOpen, onLike }) {
  return (
    <article
      onClick={() => onOpen(post.id)}
      className="tw-cursor-pointer tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-4 tw-shadow-ccard tw-transition-colors hover:tw-border-caccent/40"
    >
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
        <div className="tw-min-w-0">
          <div className="tw-flex tw-items-center tw-gap-1.5">
            <span className="tw-rounded-md tw-bg-caccent-soft tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-caccent">
              {post.city}
            </span>
            <span className="tw-text-[11px] tw-text-cink-faint">{post.dayCount}일 코스</span>
          </div>
          <h3 className="tw-mt-1.5 tw-truncate tw-text-[15px] tw-font-semibold tw-text-cink">{post.title}</h3>
          {post.summary && (
            <p className="tw-mt-1 tw-text-[13px] tw-leading-relaxed tw-text-cink-muted">{post.summary}</p>
          )}
        </div>
        <div className="tw-shrink-0 tw-text-right">
          <Stars value={post.avgRating} />
          <p className="tw-mt-0.5 tw-text-[11px] tw-font-semibold tw-tabular-nums tw-text-cink-muted">
            {post.avgRating.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="tw-mt-3 tw-flex tw-items-center tw-justify-between tw-gap-2 tw-border-t tw-border-cline tw-pt-2.5">
        <span className="tw-truncate tw-text-[12px] tw-text-cink-faint">
          {post.authorName} · {fmtDate(post.createdAt)}
        </span>
        <div className="tw-flex tw-shrink-0 tw-items-center tw-gap-1.5">
          <span className="tw-text-[12px] tw-tabular-nums tw-text-cink-faint">후기 {post.reviewCount}</span>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onLike(post.id) }}
            className={`tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-border tw-px-2.5 tw-py-1 tw-text-[12px] tw-font-semibold tw-tabular-nums tw-transition-colors ${
              post.liked
                ? 'tw-border-caccent tw-bg-caccent tw-text-white'
                : 'tw-border-cline tw-text-cink-muted hover:tw-border-caccent/50 hover:tw-text-caccent'
            }`}
          >
            ♥ {post.likeCount}
          </button>
        </div>
      </div>
    </article>
  )
}

/* ── 동선 미리보기 (payload.days) ──────────────────────────────────── */
// 공유된 코스의 동선을 한 줄로 미리 보여 준다(장소1 → 장소2 → …).
// 상세를 열기 전에 "이 코스가 내 취향인지" 판단할 근거를 주는 부분이다.
function RoutePreview({ payload }) {
  const days = Array.isArray(payload?.days) ? payload.days : []
  if (days.length === 0) {
    return <p className="tw-text-[13px] tw-text-cink-faint">저장된 일정 정보가 없어요.</p>
  }
  return (
    <div className="tw-space-y-3">
      {days.map((places, d) => (
        <div key={d}>
          <p className="tw-mb-1.5 tw-text-[12px] tw-font-bold tw-text-caccent">Day {d + 1}</p>
          <ol className="tw-flex tw-flex-wrap tw-items-center tw-gap-1.5">
            {(places || []).map((place, i) => (
              <li key={`${place?.name}-${i}`} className="tw-flex tw-items-center tw-gap-1.5">
                {i > 0 && <span className="tw-text-cink-faint">→</span>}
                <span className="tw-rounded-md tw-bg-surface-2 tw-px-2 tw-py-1 tw-text-[12.5px] tw-text-cink">
                  {place?.name || '알 수 없음'}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

/* ── 상세 ──────────────────────────────────────────────────────────── */
// 코스 상세. 후기 작성·삭제, 추천, "내 여행에 담기"가 여기 모여 있다.
// 변경이 생기면 onChanged 로 목록 쪽에 알려 숫자를 맞춘다.
function PostView({ postId, user, onRequireLogin, onClose, onChanged }) {
  const [post, setPost] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveState, setSaveState] = useState('내 여행에 담기')

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
    setBusy(true)
    try {
      await deleteMyReview(postId)
      setBody('')
      setRating(5)
      await load()
      onChanged()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const removePost = async () => {
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
        <div className="tw-space-y-4">
          {/* 헤더 */}
          <header className="tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-5 tw-shadow-ccard">
            <div className="tw-flex tw-items-center tw-gap-1.5">
              <span className="tw-rounded-md tw-bg-caccent-soft tw-px-1.5 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-caccent">
                {post.city}
              </span>
              <span className="tw-text-[11px] tw-text-cink-faint">{post.dayCount}일 코스</span>
            </div>
            <h1 className="tw-mt-2 tw-text-[20px] tw-font-bold tw-text-cink">{post.title}</h1>
            <p className="tw-mt-1 tw-text-[12.5px] tw-text-cink-faint">
              {post.authorName} · {fmtDate(post.createdAt)}
            </p>

            <div className="tw-mt-3 tw-flex tw-flex-wrap tw-items-center tw-gap-3">
              <span className="tw-inline-flex tw-items-center tw-gap-1.5">
                <Stars value={post.avgRating} size={16} />
                <b className="tw-text-[13px] tw-tabular-nums tw-text-cink">{post.avgRating.toFixed(1)}</b>
                <span className="tw-text-[12px] tw-text-cink-faint">후기 {post.reviewCount}</span>
              </span>
              <button
                type="button" onClick={like}
                className={`tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-border tw-px-3 tw-py-1.5 tw-text-[13px] tw-font-semibold tw-tabular-nums tw-transition-colors ${
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
                  <span className="tw-text-[13px] tw-font-semibold tw-tabular-nums tw-text-cink">{rating}.0</span>
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
      )}
    </div>
  )
}

/* ── 글쓰기 — '내 여행'에 저장한 코스를 골라 커뮤니티에 공유 ─────────── */
// 공유 작성 화면. 새로 코스를 짜는 게 아니라 "내 여행"에 이미 저장해 둔 코스 중
// 하나를 골라 소개 글과 별점을 붙여 올린다.
function ComposeView({ onClose, onDone }) {
  const [trips, setTrips] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [message, setMessage] = useState('')
  const [tripId, setTripId] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [rating, setRating] = useState(5)
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
            <span className="tw-text-[13px] tw-font-bold tw-text-cink">내 별점</span>
            <StarPicker value={rating} onChange={setRating} />
            <span className="tw-text-[13px] tw-font-semibold tw-tabular-nums tw-text-cink">{rating}.0</span>
          </div>

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

/* ── 화면 루트 ─────────────────────────────────────────────────────── */
export default function CommunityScreen({ user, onRequireLogin, onBack, leaving }) {
  const [posts, setPosts] = useState([])
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [city, setCity] = useState('')
  const [sort, setSort] = useState('recent')
  const [openId, setOpenId] = useState(null)
  const [composing, setComposing] = useState(false)

  // 글을 올리거나 추천/후기 뒤에 목록을 다시 불러올 때 쓴다 (핸들러에서 호출).
  const load = useCallback(
    () =>
      listCommunityPosts({ city, sort })
        .then((rows) => { setPosts(rows); setStatus('ready') })
        .catch((error) => { setMessage(error.message); setStatus('error') }),
    [city, sort],
  )

  // 목록 로드: setState 는 promise 콜백에서만, 언마운트/필터 변경 시 이전 응답은 버린다.
  useEffect(() => {
    let alive = true
    listCommunityPosts({ city, sort })
      .then((rows) => { if (!alive) return; setPosts(rows); setStatus('ready') })
      .catch((error) => { if (!alive) return; setMessage(error.message); setStatus('error') })
    return () => { alive = false }
  }, [city, sort])

  const like = async (postId) => {
    if (!user) {
      onRequireLogin()
      return
    }
    try {
      const result = await toggleLike(postId)
      setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, ...result } : post)))
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <section className={leaving ? 'course-detail-root community-screen is-leaving' : 'course-detail-root community-screen'}>
      {composing ? (
        <ComposeView
          onClose={() => setComposing(false)}
          onDone={(post) => {
            setComposing(false)
            load()
            if (post && post.id) setOpenId(post.id)
          }}
        />
      ) : openId ? (
        <PostView
          postId={openId}
          user={user}
          onRequireLogin={onRequireLogin}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      ) : (
        <div className="tw-mx-auto tw-max-w-[980px] tw-px-5 tw-py-6">
          <header className="tw-mb-5">
            <button
              type="button" onClick={onBack}
              className="tw-mb-3 tw-inline-flex tw-items-center tw-gap-1 tw-text-[13px] tw-font-semibold tw-text-cink-muted hover:tw-text-cink"
            >
              ← 홈으로
            </button>
            <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-3">
              <div>
                <h1 className="tw-text-[22px] tw-font-bold tw-text-cink">여행자 커뮤니티</h1>
                <p className="tw-mt-1 tw-text-[13px] tw-text-cink-muted">
                  다른 여행자가 다녀온 동선을 보고, 별점과 후기를 남겨 보세요.
                </p>
              </div>
              {/* 로그인해야 글을 쓸 수 있다. 비로그인이면 로그인 패널을 연다. */}
              <button
                type="button"
                onClick={() => (user ? setComposing(true) : onRequireLogin())}
                className="tw-inline-flex tw-shrink-0 tw-items-center tw-gap-1.5 tw-rounded-full tw-bg-caccent tw-px-4 tw-py-2.5 tw-text-[13px] tw-font-semibold tw-text-white tw-transition-transform hover:tw--translate-y-0.5"
              >
                <span aria-hidden="true" className="tw-text-[15px] tw-leading-none">＋</span>
                글쓰기
              </button>
            </div>
          </header>

          {/* 필터: 여행지 + 정렬 */}
          <div className="tw-mb-4 tw-flex tw-flex-wrap tw-items-center tw-gap-3">
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              aria-label="여행지 필터"
              className="tw-rounded-lg tw-border tw-border-cline tw-bg-surface tw-px-3 tw-py-2 tw-text-[13px] tw-text-cink focus:tw-border-caccent focus:tw-outline-none"
            >
              <option value="">전체 여행지</option>
              {destinationCatalog.map((item) => (
                <option key={item.name} value={item.name}>{item.name}</option>
              ))}
            </select>

            <div className="tw-flex tw-gap-1">
              {SORTS.map((item) => (
                <button
                  key={item.key} type="button" onClick={() => setSort(item.key)}
                  className={`tw-rounded-full tw-px-3 tw-py-1.5 tw-text-[13px] tw-font-semibold tw-transition-colors ${
                    sort === item.key
                      ? 'tw-bg-caccent tw-text-white'
                      : 'tw-border tw-border-cline tw-text-cink-muted hover:tw-text-cink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <span className="tw-ml-auto tw-text-[12px] tw-tabular-nums tw-text-cink-faint">{posts.length}개</span>
          </div>

          {status === 'loading' && <p className="tw-py-16 tw-text-center tw-text-sm tw-text-cink-faint">불러오는 중…</p>}
          {status === 'error' && <p className="tw-py-16 tw-text-center tw-text-sm tw-text-cink-muted">{message}</p>}
          {status === 'ready' && posts.length === 0 && (
            <div className="tw-rounded-cxl tw-border tw-border-dashed tw-border-cline tw-py-16 tw-text-center">
              <p className="tw-text-sm tw-text-cink-muted">아직 공유된 코스가 없어요.</p>
              <p className="tw-mt-1 tw-text-[13px] tw-text-cink-faint">
                오른쪽 위 &lsquo;글쓰기&rsquo; 버튼으로 첫 코스를 공유해 보세요.
              </p>
            </div>
          )}

          {status === 'ready' && posts.length > 0 && (
            <div className="tw-grid tw-gap-3 sm:tw-grid-cols-2">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onOpen={setOpenId} onLike={like} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
