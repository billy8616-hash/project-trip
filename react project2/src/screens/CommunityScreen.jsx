// ─────────────────────────────────────────────────────────────
// screens/CommunityScreen.jsx — 커뮤니티 (코스 공유·후기·추천)
//
// 한 파일 안에 세 개의 화면이 들어 있고, 상태 하나로 전환한다.
//   목록   PostCard 격자 + 도시·정렬 필터
//   상세   PostView    — 코스 내용 + 후기 목록 + 후기 작성
//   작성   ComposeView — "내 여행"에 저장한 코스를 골라 공유
// 세 화면 각각과 그 아래 조각(Stars·RoutePreview 등)은 screens/community/ 에
// 파일별로 나눠 뒀다 — 이 파일은 그 셋을 상태 하나로 갈아 끼우는 목록 화면(루트)만 맡는다.
//
// 로그인 처리 방식이 이 화면의 특징이다. 보기는 누구나 할 수 있고,
// 추천·후기처럼 쓰기 동작을 눌렀을 때만 onRequireLogin 으로 로그인 창을 띄운다.
// 처음부터 로그인을 요구하면 둘러보지도 못하고 막히기 때문이다.
//
// 공유되는 것은 코스 payload(JSON) 통째다. 그래서 다른 사람의 코스를
// 그대로 "내 여행에 담기"로 가져올 수 있다.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { allDestinations } from '../data/destinations.js'
import { budgets, journeyThemes, transports } from '../data/travelOptions.js'
import { listCommunityPosts, toggleLike } from '../lib/communityApi.js'
import { ComposeView } from './community/ComposeView.jsx'
import { CommunityMap } from './community/CommunityMap.jsx'
import { PostCard } from './community/PostCard.jsx'
import { PostView } from './community/PostView.jsx'

const SORTS = [
  { key: 'recent', label: '최신순' },
  { key: 'likes', label: '추천순' },
  { key: 'rating', label: '별점순' },
]

// 기간 조건. value 는 dayCount — 4는 "3박 4일 이상"(서버에서 4일 이상으로 거른다).
const DAY_OPTIONS = [
  { value: 1, label: '당일' },
  { value: 2, label: '1박 2일' },
  { value: 3, label: '2박 3일' },
  { value: 4, label: '3박 이상' },
]

const EMPTY_FILTERS = { city: '', theme: '', q: '', days: 0, budget: '', transport: '', photos: false }

// 목록 첫 페이지 크기이자 "더보기"를 누를 때마다 늘어나는 단위.
const PAGE_SIZE = 60

const selectClass =
  'tw-w-full tw-rounded-lg tw-border tw-border-cline tw-bg-surface tw-px-3 tw-py-2 tw-text-[13px] tw-text-cink focus:tw-border-caccent focus:tw-outline-none'

function chipClass(active) {
  return `tw-rounded-full tw-px-3 tw-py-1.5 tw-text-[13px] tw-font-semibold tw-transition-colors ${
    active ? 'tw-bg-cink tw-text-white' : 'tw-border tw-border-cline tw-text-cink-muted hover:tw-text-cink'
  }`
}

export default function CommunityScreen({ user, onRequireLogin, onBack, leaving, initialTripId, onConsumedInitialTrip }) {
  const [posts, setPosts] = useState([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  // 검색창에 치는 글자. 한 글자마다 서버를 부르지 않도록 잠깐 멈췄을 때만 filters.q 에 반영한다.
  const [queryInput, setQueryInput] = useState('')
  const [sort, setSort] = useState('recent')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [openId, setOpenId] = useState(null)
  // '내 여행'에서 "커뮤니티에 공유" 버튼으로 넘어온 경우, 그 코스를 미리 골라 둔 채로
  // 글쓰기 화면부터 바로 연다. initialTripId 는 한 번만 쓰고, 다시 이 화면에 들어와도
  // 글쓰기가 계속 자동으로 열리지 않도록 상위(App)에 소비했다고 바로 알린다.
  const [composing, setComposing] = useState(() => Boolean(initialTripId))
  useEffect(() => {
    if (initialTripId) onConsumedInitialTrip?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 글을 올리거나 추천/후기 뒤에 목록을 다시 불러올 때 쓴다 (핸들러에서 호출).
  const load = useCallback(
    () =>
      listCommunityPosts({ ...filters, sort, limit })
        .then(({ posts: rows, total: count }) => { setPosts(rows); setTotal(count); setStatus('ready') })
        .catch((error) => { setMessage(error.message); setStatus('error') }),
    [filters, sort, limit],
  )

  // 조건·정렬을 바꿀 때 페이지 크기도 처음으로 되돌린다 — 안 그러면 조건을
  // 바꿔도 이전에 눌러 둔 "더보기" 만큼 계속 많이 불러오게 된다.
  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setLimit(PAGE_SIZE)
  }
  const changeCity = (value) => setFilter('city', value)
  const toggleTheme = (value) => setFilter('theme', filters.theme === value ? '' : value)
  const changeSort = (value) => {
    setSort(value)
    setLimit(PAGE_SIZE)
  }
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS)
    setQueryInput('')
    setLimit(PAGE_SIZE)
  }
  const activeCount = Object.keys(EMPTY_FILTERS).filter((key) => filters[key] !== EMPTY_FILTERS[key]).length

  // 검색어는 입력을 멈추고 0.3초 뒤에 반영한다.
  useEffect(() => {
    const next = queryInput.trim()
    if (next === filters.q) return undefined
    const timer = window.setTimeout(() => {
      setFilters((prev) => ({ ...prev, q: next }))
      setLimit(PAGE_SIZE)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [queryInput, filters.q])

  // 목록 로드: setState 는 promise 콜백에서만, 언마운트/필터 변경 시 이전 응답은 버린다.
  useEffect(() => {
    let alive = true
    listCommunityPosts({ ...filters, sort, limit })
      .then(({ posts: rows, total: count }) => {
        if (!alive) return
        setPosts(rows)
        setTotal(count)
        setStatus('ready')
      })
      .catch((error) => { if (!alive) return; setMessage(error.message); setStatus('error') })
    return () => { alive = false }
  }, [filters, sort, limit])

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
          initialTripId={initialTripId}
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

          <CommunityMap city={filters.city} onSelectCity={changeCity} onOpenPost={setOpenId} />

          {/* 조건 검색 패널: 검색어 + 여행지·기간·예산·교통편 + 테마 + 사진 유무. 모두 AND 로 걸린다. */}
          <section
            aria-label="코스 검색"
            className="tw-mb-4 tw-space-y-3 tw-rounded-cxl tw-border tw-border-cline tw-bg-surface tw-p-4 tw-shadow-ccard"
          >
            <label className="tw-relative tw-block">
              <span className="tw-sr-only">검색어</span>
              <svg
                viewBox="0 0 24 24" aria-hidden="true"
                className="tw-pointer-events-none tw-absolute tw-left-3 tw-top-1/2 tw-h-4 tw-w-4 tw--translate-y-1/2 tw-text-cink-faint"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
              <input
                id="community-search"
                type="search"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                maxLength={40}
                placeholder="제목·소개·후기·여행지로 검색 (예: 야경, 카페, 속초)"
                className="tw-w-full tw-rounded-lg tw-border tw-border-cline tw-bg-cbg tw-py-2.5 tw-pl-9 tw-pr-3 tw-text-[14px] tw-text-cink placeholder:tw-text-cink-faint focus:tw-border-caccent focus:tw-outline-none"
              />
            </label>

            <div className="tw-grid tw-grid-cols-2 tw-gap-2 sm:tw-grid-cols-4">
              <select
                id="community-city" aria-label="여행지" value={filters.city}
                onChange={(event) => changeCity(event.target.value)} className={selectClass}
              >
                <option value="">여행지 전체</option>
                {allDestinations.map((item) => (
                  <option key={item.name} value={item.name}>{item.name}</option>
                ))}
              </select>
              <select
                id="community-days" aria-label="기간" value={filters.days}
                onChange={(event) => setFilter('days', Number(event.target.value))} className={selectClass}
              >
                <option value={0}>기간 전체</option>
                {DAY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <select
                id="community-budget" aria-label="예산" value={filters.budget}
                onChange={(event) => setFilter('budget', event.target.value)} className={selectClass}
              >
                <option value="">예산 전체</option>
                {budgets.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select
                id="community-transport" aria-label="교통편" value={filters.transport}
                onChange={(event) => setFilter('transport', event.target.value)} className={selectClass}
              >
                <option value="">교통편 전체</option>
                {transports.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-1.5">
              <button type="button" onClick={() => setFilter('theme', '')} className={chipClass(filters.theme === '')}>
                전체 테마
              </button>
              {journeyThemes.map((item) => (
                <button key={item.id} type="button" onClick={() => toggleTheme(item.id)} className={chipClass(filters.theme === item.id)}>
                  {item.label}
                </button>
              ))}
              <span className="tw-mx-1 tw-h-5 tw-w-px tw-bg-cline" aria-hidden="true" />
              <button
                type="button" aria-pressed={filters.photos}
                onClick={() => setFilter('photos', !filters.photos)} className={chipClass(filters.photos)}
              >
                사진 있는 글만
              </button>
            </div>
          </section>

          {/* 결과 줄: 개수 + 초기화 + 정렬 */}
          <div className="tw-mb-4 tw-flex tw-flex-wrap tw-items-center tw-gap-3">
            <span className="tw-text-[13px] tw-text-cink-muted">
              <b className="tw-tabular-nums tw-text-cink">{total}</b>개 코스
            </span>
            {activeCount > 0 && (
              <button
                type="button" onClick={resetFilters}
                className="tw-text-[12.5px] tw-font-semibold tw-text-caccent hover:tw-underline"
              >
                조건 {activeCount}개 초기화
              </button>
            )}
            <div className="tw-ml-auto tw-flex tw-gap-1">
              {SORTS.map((item) => (
                <button
                  key={item.key} type="button" onClick={() => changeSort(item.key)}
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
          </div>

          {status === 'loading' && <p className="tw-py-16 tw-text-center tw-text-sm tw-text-cink-faint">불러오는 중…</p>}
          {status === 'error' && <p className="tw-py-16 tw-text-center tw-text-sm tw-text-cink-muted">{message}</p>}
          {status === 'ready' && posts.length === 0 && (
            <div className="tw-rounded-cxl tw-border tw-border-dashed tw-border-cline tw-py-16 tw-text-center">
              {activeCount > 0 ? (
                <>
                  <p className="tw-text-sm tw-text-cink-muted">조건에 맞는 코스가 없어요.</p>
                  <button
                    type="button" onClick={resetFilters}
                    className="tw-mt-2 tw-text-[13px] tw-font-semibold tw-text-caccent hover:tw-underline"
                  >
                    조건 초기화하고 전체 보기
                  </button>
                </>
              ) : (
                <>
                  <p className="tw-text-sm tw-text-cink-muted">아직 공유된 코스가 없어요.</p>
                  <p className="tw-mt-1 tw-text-[13px] tw-text-cink-faint">
                    오른쪽 위 &lsquo;글쓰기&rsquo; 버튼으로 첫 코스를 공유해 보세요.
                  </p>
                </>
              )}
            </div>
          )}

          {status === 'ready' && posts.length > 0 && (
            <div className="tw-grid tw-gap-3 sm:tw-grid-cols-2">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onOpen={setOpenId} onLike={like} />
              ))}
            </div>
          )}

          {status === 'ready' && posts.length < total && (
            <div className="tw-mt-5 tw-text-center">
              <button
                type="button"
                onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                className="tw-rounded-full tw-border tw-border-cline tw-px-5 tw-py-2 tw-text-[13px] tw-font-semibold tw-text-cink-muted tw-transition-colors hover:tw-border-caccent hover:tw-text-caccent"
              >
                더보기 ({posts.length}/{total})
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
