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
import { destinationCatalog } from '../data/destinations.js'
import { listCommunityPosts, toggleLike } from '../lib/communityApi.js'
import { ComposeView } from './community/ComposeView.jsx'
import { PostCard } from './community/PostCard.jsx'
import { PostView } from './community/PostView.jsx'

const SORTS = [
  { key: 'recent', label: '최신순' },
  { key: 'likes', label: '추천순' },
  { key: 'rating', label: '별점순' },
]

// 목록 첫 페이지 크기이자 "더보기"를 누를 때마다 늘어나는 단위.
const PAGE_SIZE = 60

export default function CommunityScreen({ user, onRequireLogin, onBack, leaving }) {
  const [posts, setPosts] = useState([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [city, setCity] = useState('')
  const [sort, setSort] = useState('recent')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [openId, setOpenId] = useState(null)
  const [composing, setComposing] = useState(false)

  // 글을 올리거나 추천/후기 뒤에 목록을 다시 불러올 때 쓴다 (핸들러에서 호출).
  const load = useCallback(
    () =>
      listCommunityPosts({ city, sort, limit })
        .then(({ posts: rows, total: count }) => { setPosts(rows); setTotal(count); setStatus('ready') })
        .catch((error) => { setMessage(error.message); setStatus('error') }),
    [city, sort, limit],
  )

  // 여행지·정렬 필터를 바꿀 때 페이지 크기도 처음으로 되돌린다 — 안 그러면 필터를
  // 바꿔도 이전에 눌러 둔 "더보기" 만큼 계속 많이 불러오게 된다.
  const changeCity = (value) => {
    setCity(value)
    setLimit(PAGE_SIZE)
  }
  const changeSort = (value) => {
    setSort(value)
    setLimit(PAGE_SIZE)
  }

  // 목록 로드: setState 는 promise 콜백에서만, 언마운트/필터 변경 시 이전 응답은 버린다.
  useEffect(() => {
    let alive = true
    listCommunityPosts({ city, sort, limit })
      .then(({ posts: rows, total: count }) => {
        if (!alive) return
        setPosts(rows)
        setTotal(count)
        setStatus('ready')
      })
      .catch((error) => { if (!alive) return; setMessage(error.message); setStatus('error') })
    return () => { alive = false }
  }, [city, sort, limit])

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
              onChange={(event) => changeCity(event.target.value)}
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

            <span className="tw-ml-auto tw-text-[12px] tw-tabular-nums tw-text-cink-faint">{total}개</span>
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
                <PostCard key={post.id} post={post} user={user} onOpen={setOpenId} onLike={like} />
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
