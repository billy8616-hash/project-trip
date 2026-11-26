import { beforeEach, describe, expect, it, vi } from 'vitest'

// DB 없이 정렬 로직만 보도록 Prisma 를 메모리 가짜로 바꾼다.
const db = vi.hoisted(() => ({ posts: [], likes: [], reviews: [] }))

vi.mock('./db.js', () => {
  const inList = (where, key) => where?.[key]?.in
  return {
    prisma: {
      coursePost: {
        findMany: async ({ where, orderBy, take } = {}) => {
          let rows = [...db.posts]
          const ids = inList(where, 'id')
          if (ids) rows = rows.filter((row) => ids.includes(row.id))
          if (orderBy?.createdAt === 'desc') rows.sort((a, b) => b.createdAt - a.createdAt)
          return take ? rows.slice(0, take) : rows
        },
        count: async () => db.posts.length,
      },
      courseLike: {
        groupBy: async ({ where }) => {
          const ids = inList(where, 'postId')
          const counts = new Map()
          for (const like of db.likes) if (ids.includes(like.postId)) counts.set(like.postId, (counts.get(like.postId) || 0) + 1)
          return [...counts].map(([postId, n]) => ({ postId, _count: { _all: n } }))
        },
        findMany: async () => [],
      },
      courseReview: {
        groupBy: async ({ where }) => {
          const ids = inList(where, 'postId')
          const agg = new Map()
          for (const review of db.reviews) {
            if (!ids.includes(review.postId)) continue
            const cur = agg.get(review.postId) || { n: 0, sum: 0 }
            agg.set(review.postId, { n: cur.n + 1, sum: cur.sum + review.rating })
          }
          return [...agg].map(([postId, v]) => ({ postId, _count: { _all: v.n }, _sum: { rating: v.sum } }))
        },
      },
    },
  }
})

const { listPosts } = await import('./communityStore.js')

// p0 이 가장 최근 글, p{n-1} 이 가장 오래된 글.
function seed(count, overrides = {}) {
  db.posts = Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, userId: `u${i}`, authorName: '여행자', title: `코스${i}`, city: '제주', journeyTheme: '',
    dayCount: 1, summary: '', body: '', rating: 3, payload: '{}', images: '[]',
    createdAt: new Date(Date.UTC(2026, 0, 1) + (count - i) * 60_000), // i 가 클수록 오래됨
    ...(overrides[i] || {}),
  }))
  db.likes = []
  db.reviews = []
}
const like = (postId, n) => { for (let i = 0; i < n; i += 1) db.likes.push({ postId, userId: `liker-${postId}-${i}` }) }
const review = (postId, rating) => db.reviews.push({ postId, userId: `r-${postId}-${db.reviews.length}`, rating })
const ids = (result) => result.posts.map((post) => post.id)

beforeEach(() => seed(0))

describe('listPosts 인기순', () => {
  it('최근 글 밖의 오래된 인기 글도 상위에 나온다 (최근 limit 개 안에서만 정렬하지 않는다)', async () => {
    seed(100)
    like('p99', 5) // 가장 오래된 글이 가장 인기
    like('p50', 3)

    const result = await listPosts({ sort: 'likes', limit: 10 })

    expect(ids(result).slice(0, 2)).toEqual(['p99', 'p50'])
    expect(result.posts).toHaveLength(10)
    expect(result.total).toBe(100)
  })

  it('좋아요가 같으면 최근 글이 앞', async () => {
    seed(5)
    like('p3', 2)
    like('p1', 2)
    expect(ids(await listPosts({ sort: 'likes', limit: 3 }))).toEqual(['p1', 'p3', 'p0'])
  })
})

describe('listPosts 별점순', () => {
  it('최근 글 밖의 오래된 고평점 글도 상위에 나온다', async () => {
    seed(100, { 80: { rating: 5 } })
    const result = await listPosts({ sort: 'rating', limit: 5 })
    expect(ids(result)[0]).toBe('p80')
  })

  it('후기 별점까지 합친 평균(작성자 본인 별점 포함)으로 정렬한다', async () => {
    seed(100, { 70: { rating: 4 }, 90: { rating: 5 } })
    review('p70', 5) // p70 평균 (4+5)/2 = 4.5
    review('p90', 3) // p90 평균 (5+3)/2 = 4.0
    const result = await listPosts({ sort: 'rating', limit: 3 })
    expect(ids(result).slice(0, 2)).toEqual(['p70', 'p90'])
    expect(result.posts[0].avgRating).toBe(4.5)
    expect(result.posts[0].reviewCount).toBe(1)
  })
})

describe('listPosts 최신순과 limit', () => {
  it('최신순은 기존처럼 최근 글부터 limit 개', async () => {
    seed(100)
    const result = await listPosts({ sort: 'recent', limit: 3 })
    expect(ids(result)).toEqual(['p0', 'p1', 'p2'])
  })

  it('limit 이 숫자가 아니거나 0 이면 기본 60개 (500 이 나거나 1개만 나오지 않는다)', async () => {
    seed(100)
    expect(await listPosts({ sort: 'recent', limit: Number.NaN })).toHaveProperty('posts.length', 60)
    expect(await listPosts({ sort: 'likes', limit: 0 })).toHaveProperty('posts.length', 60)
  })

  it('limit 이 너무 크면 300 으로 제한한다', async () => {
    seed(400)
    expect((await listPosts({ sort: 'recent', limit: 100000 })).posts).toHaveLength(300)
  })

  it('글이 없으면 빈 목록', async () => {
    expect(await listPosts({ sort: 'likes' })).toEqual({ posts: [], total: 0 })
  })
})
