import { prisma } from './db.js'

// 커뮤니티 — 사용자가 공개한 코스(CoursePost) + 후기(CourseReview) + 추천(CourseLike).
//
// 별점 표기 규칙: 글쓴이 본인 별점도 한 표로 같이 계산한다.
//   avgRating = (작성자 별점 + 후기 별점 합) / (1 + 후기 수)
// 후기가 하나도 없어도 별점이 비어 보이지 않게 하려는 것.

const MAX_POSTS_PER_USER = 30
const LIMITS = { title: 80, city: 40, summary: 120, body: 2000, review: 1000 }

const clampRating = (value) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 5
}
const cut = (text, max) => String(text ?? '').trim().slice(0, max)

function parsePayload(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null // 저장된 JSON 이 깨졌으면 null (상세 화면에서 "일정 정보 없음" 처리)
  }
}

const iso = (value) => (value instanceof Date ? value.toISOString() : value)

/* ── 목록 ──────────────────────────────────────────────────────────── */
export async function listPosts({ city = '', sort = 'recent', viewerId = null, limit = 60 } = {}) {
  const posts = await prisma.coursePost.findMany({
    where: city ? { city } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(100, Math.max(1, limit)),
  })
  if (posts.length === 0) return []

  const ids = posts.map((post) => post.id)
  const [likeGroups, reviewGroups, myLikes] = await Promise.all([
    prisma.courseLike.groupBy({ by: ['postId'], where: { postId: { in: ids } }, _count: { _all: true } }),
    prisma.courseReview.groupBy({
      by: ['postId'],
      where: { postId: { in: ids } },
      _count: { _all: true },
      _sum: { rating: true },
    }),
    viewerId
      ? prisma.courseLike.findMany({ where: { postId: { in: ids }, userId: viewerId }, select: { postId: true } })
      : Promise.resolve([]),
  ])

  const likeCountBy = new Map(likeGroups.map((g) => [g.postId, g._count._all]))
  const reviewBy = new Map(reviewGroups.map((g) => [g.postId, { count: g._count._all, sum: g._sum.rating || 0 }]))
  const likedSet = new Set(myLikes.map((row) => row.postId))

  const rows = posts.map((post) => summarize(post, {
    likeCount: likeCountBy.get(post.id) || 0,
    review: reviewBy.get(post.id) || { count: 0, sum: 0 },
    liked: likedSet.has(post.id),
  }))

  if (sort === 'likes') rows.sort((a, b) => b.likeCount - a.likeCount || b.createdAt.localeCompare(a.createdAt))
  else if (sort === 'rating') rows.sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount)
  return rows
}

function summarize(post, { likeCount, review, liked }) {
  const count = 1 + review.count // 작성자 본인 별점 포함
  return {
    id: post.id,
    userId: post.userId,
    authorName: post.authorName,
    title: post.title,
    city: post.city,
    dayCount: post.dayCount,
    summary: post.summary,
    rating: post.rating,
    avgRating: Math.round(((post.rating + review.sum) / count) * 10) / 10,
    reviewCount: review.count,
    likeCount,
    liked,
    createdAt: iso(post.createdAt),
  }
}

/* ── 상세 ──────────────────────────────────────────────────────────── */
export async function getPost(id, viewerId = null) {
  const post = await prisma.coursePost.findUnique({ where: { id } })
  if (!post) return null

  const [likeCount, reviews, liked] = await Promise.all([
    prisma.courseLike.count({ where: { postId: id } }),
    prisma.courseReview.findMany({ where: { postId: id }, orderBy: { createdAt: 'desc' } }),
    viewerId
      ? prisma.courseLike.findFirst({ where: { postId: id, userId: viewerId }, select: { id: true } })
      : Promise.resolve(null),
  ])

  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return {
    ...summarize(post, { likeCount, review: { count: reviews.length, sum }, liked: Boolean(liked) }),
    body: post.body,
    payload: parsePayload(post.payload),
    isMine: Boolean(viewerId && viewerId === post.userId),
    myReviewId: viewerId ? reviews.find((r) => r.userId === viewerId)?.id || null : null,
    reviews: reviews.map((r) => ({
      id: r.id,
      userId: r.userId,
      authorName: r.authorName,
      rating: r.rating,
      body: r.body,
      createdAt: iso(r.createdAt),
      isMine: Boolean(viewerId && viewerId === r.userId),
    })),
  }
}

/* ── 글 작성/삭제 ──────────────────────────────────────────────────── */
export async function createPost(userId, authorName, { title, city, dayCount, summary, body, rating, payload }) {
  const count = await prisma.coursePost.count({ where: { userId } })
  if (count >= MAX_POSTS_PER_USER) {
    const error = new Error(`공유는 최대 ${MAX_POSTS_PER_USER}개까지 가능해요. 이전 글을 지우고 다시 시도해주세요.`)
    error.status = 409
    throw error
  }
  const row = await prisma.coursePost.create({
    data: {
      userId,
      authorName: cut(authorName, 40) || '여행자',
      title: cut(title, LIMITS.title),
      city: cut(city, LIMITS.city),
      dayCount: Number.isFinite(dayCount) ? Math.max(1, Math.min(30, Math.floor(dayCount))) : 1,
      summary: cut(summary, LIMITS.summary),
      body: cut(body, LIMITS.body),
      rating: clampRating(rating),
      payload: JSON.stringify(payload),
    },
  })
  return summarize(row, { likeCount: 0, review: { count: 0, sum: 0 }, liked: false })
}

export async function deletePost(userId, id) {
  const result = await prisma.coursePost.deleteMany({ where: { id, userId } })
  if (result.count === 0) return false
  // 연결된 후기·추천도 함께 정리 (SQLite 라 FK cascade 대신 직접 지운다)
  await Promise.all([
    prisma.courseReview.deleteMany({ where: { postId: id } }),
    prisma.courseLike.deleteMany({ where: { postId: id } }),
  ])
  return true
}

/* ── 후기 ──────────────────────────────────────────────────────────── */
// 한 사람이 한 코스에 후기 하나. 다시 쓰면 갱신된다.
export async function upsertReview(postId, userId, authorName, { rating, body }) {
  const post = await prisma.coursePost.findUnique({ where: { id: postId }, select: { id: true, userId: true } })
  if (!post) return null
  if (post.userId === userId) {
    const error = new Error('내가 올린 코스에는 후기를 남길 수 없어요.')
    error.status = 400
    throw error
  }
  const data = {
    authorName: cut(authorName, 40) || '여행자',
    rating: clampRating(rating),
    body: cut(body, LIMITS.review),
  }
  const row = await prisma.courseReview.upsert({
    where: { postId_userId: { postId, userId } },
    create: { postId, userId, ...data },
    update: data,
  })
  return { id: row.id, authorName: row.authorName, rating: row.rating, body: row.body, createdAt: iso(row.createdAt) }
}

export async function deleteReview(postId, userId) {
  const result = await prisma.courseReview.deleteMany({ where: { postId, userId } })
  return result.count > 0
}

/* ── 추천(좋아요) 토글 ─────────────────────────────────────────────── */
export async function toggleLike(postId, userId) {
  const post = await prisma.coursePost.findUnique({ where: { id: postId }, select: { id: true } })
  if (!post) return null
  const existing = await prisma.courseLike.findUnique({ where: { postId_userId: { postId, userId } } })
  if (existing) await prisma.courseLike.delete({ where: { id: existing.id } })
  else await prisma.courseLike.create({ data: { postId, userId } })
  const likeCount = await prisma.courseLike.count({ where: { postId } })
  return { liked: !existing, likeCount }
}
