// ─────────────────────────────────────────────────────────────
// server/communityStore.js — 커뮤니티 데이터 (공유 코스·후기·추천)
//
// 세 테이블을 함께 다룬다: CoursePost(공유된 코스) · CourseReview(후기) · CourseLike(추천).
//
// 별점 계산에 규칙이 하나 있다 — 글쓴이 본인의 별점도 한 표로 센다.
//   평균 = (작성자 별점 + 후기 별점 합) / (1 + 후기 수)
// 후기가 아직 없는 글도 별점이 비어 보이지 않게 하려는 것이다.
//
// 입력 길이 제한(LIMITS)과 사용자당 글 수 제한을 여기서 건다.
// 브라우저 쪽 검증은 우회할 수 있으므로 저장 직전에 다시 확인한다.
// ─────────────────────────────────────────────────────────────

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

// 공유 글은 로그인 없이도 읽으므로, "내 여행"에서 넘어온 출발지·숙소(집 주소일 수 있음)는 저장·응답 모두에서 뺀다.
// 응답에서도 빼는 이유: 이 처리 전에 저장된 글에 주소가 남아 있다.
export function withoutAddresses(payload) {
  if (!payload?.meta) return payload
  const meta = { ...payload.meta }
  delete meta.tripOrigin
  delete meta.tripLodging
  return { ...payload, meta }
}

function parsePayload(raw) {
  try {
    return withoutAddresses(JSON.parse(raw))
  } catch {
    return null // 저장된 JSON 이 깨졌으면 null (상세 화면에서 "일정 정보 없음" 처리)
  }
}

const MAX_IMAGES = 5
function parseImages(raw) {
  try {
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.filter((url) => typeof url === 'string') : []
  } catch {
    return []
  }
}

const iso = (value) => (value instanceof Date ? value.toISOString() : value)

/* ── 목록 ──────────────────────────────────────────────────────────── */
// 검색 조건을 Prisma where 로 바꾼다. 모든 조건은 AND 로 묶인다.
// 예산·교통편은 따로 컬럼이 없고 payload(JSON 문자열) 안의 meta 에만 있다. payload 는
// 항상 JSON.stringify 로 저장돼 공백 없는 `"budget":"보통"` 꼴이므로 그 조각을 contains 로
// 찾는다 — 컬럼을 새로 만들지 않고도 서버에서 걸러서 total(개수)까지 정확히 맞출 수 있다.
function buildWhere({ city, theme, q, days, budget, transport, photos }) {
  const and = []
  if (city) and.push({ city })
  if (theme) and.push({ journeyTheme: theme })
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ],
    })
  }
  if (days) and.push({ dayCount: days >= 4 ? { gte: 4 } : days })
  if (budget) and.push({ payload: { contains: `"budget":${JSON.stringify(budget)}` } })
  if (transport) and.push({ payload: { contains: `"transport":${JSON.stringify(transport)}` } })
  if (photos) and.push({ NOT: { images: '[]' } })
  return and.length ? { AND: and } : undefined
}

// 인기순·별점순은 "전체 글 중 상위"여야 한다. 최근 N개를 가져온 뒤 그 안에서만 정렬하면 오래된 인기 글이
// 영영 안 나온다. 좋아요·후기는 다른 테이블이라 DB 정렬을 못 쓰므로, 조건에 맞는 글의 가벼운 칼럼(id·별점·시각)만
// 훑어 순위를 매기고 상위 글만 본문까지 읽는다. 글이 이보다 많아지면 가장 최근 글 이 개수까지만 후보로 본다.
const RANK_SCAN_LIMIT = 5000
const DEFAULT_LIMIT = 60
const MAX_LIMIT = 300

// 작성자 본인 별점도 한 표로 센 평균 (소수 첫째 자리). 목록·상세·순위가 같은 값을 쓰도록 한 곳에 둔다.
function averageRating(ownRating, reviewSum, reviewCount) {
  return Math.round(((ownRating + reviewSum) / (1 + reviewCount)) * 10) / 10
}

// 동점이면 최근 글이 앞. 순위 계산(후보 고르기)과 최종 정렬이 같은 기준을 쓴다.
const byLikes = (a, b) => b.likeCount - a.likeCount || b.createdAt.localeCompare(a.createdAt)
const byRating = (a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount || b.createdAt.localeCompare(a.createdAt)

async function countsFor(ids) {
  const [likeGroups, reviewGroups] = await Promise.all([
    prisma.courseLike.groupBy({ by: ['postId'], where: { postId: { in: ids } }, _count: { _all: true } }),
    prisma.courseReview.groupBy({
      by: ['postId'],
      where: { postId: { in: ids } },
      _count: { _all: true },
      _sum: { rating: true },
    }),
  ])
  return {
    likeCountBy: new Map(likeGroups.map((g) => [g.postId, g._count._all])),
    reviewBy: new Map(reviewGroups.map((g) => [g.postId, { count: g._count._all, sum: g._sum.rating || 0 }])),
  }
}

// 조건에 맞는 글 전체에서 정렬 기준 상위 take 개의 id 를 순서대로.
async function rankedIds(where, sort, take) {
  const light = await prisma.coursePost.findMany({
    where,
    select: { id: true, rating: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: RANK_SCAN_LIMIT,
  })
  if (light.length === 0) return []
  const { likeCountBy, reviewBy } = await countsFor(light.map((post) => post.id))
  const scored = light.map((post) => {
    const review = reviewBy.get(post.id) || { count: 0, sum: 0 }
    return {
      id: post.id,
      createdAt: iso(post.createdAt),
      likeCount: likeCountBy.get(post.id) || 0,
      reviewCount: review.count,
      avgRating: averageRating(post.rating, review.sum, review.count),
    }
  })
  scored.sort(sort === 'likes' ? byLikes : byRating)
  return scored.slice(0, take).map((entry) => entry.id)
}

export async function listPosts({
  city = '', theme = '', q = '', days = 0, budget = '', transport = '', photos = false,
  sort = 'recent', viewerId = null, limit = DEFAULT_LIMIT,
} = {}) {
  const where = buildWhere({ city, theme, q, days, budget, transport, photos })
  // limit=abc 는 NaN, limit= 는 0 이다. NaN 은 Prisma 가 take: NaN 으로 500 을 내고 0 은 1건만 돌려주므로 기본값을 쓴다.
  const take = limit >= 1 ? Math.min(MAX_LIMIT, Math.floor(limit)) : DEFAULT_LIMIT
  const ranked = sort === 'likes' || sort === 'rating'

  const [posts, total] = await Promise.all([
    ranked
      ? rankedIds(where, sort, take).then(async (ids) => {
          if (ids.length === 0) return []
          const rows = await prisma.coursePost.findMany({ where: { id: { in: ids } } })
          const order = new Map(ids.map((id, index) => [id, index]))
          return rows.sort((a, b) => order.get(a.id) - order.get(b.id))
        })
      : prisma.coursePost.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
    prisma.coursePost.count({ where }),
  ])
  if (posts.length === 0) return { posts: [], total }

  const ids = posts.map((post) => post.id)
  const [{ likeCountBy, reviewBy }, myLikes] = await Promise.all([
    countsFor(ids),
    viewerId
      ? prisma.courseLike.findMany({ where: { postId: { in: ids }, userId: viewerId }, select: { postId: true } })
      : Promise.resolve([]),
  ])
  const likedSet = new Set(myLikes.map((row) => row.postId))

  const rows = posts.map((post) => summarize(post, {
    likeCount: likeCountBy.get(post.id) || 0,
    review: reviewBy.get(post.id) || { count: 0, sum: 0 },
    liked: likedSet.has(post.id),
  }))

  if (sort === 'likes') rows.sort(byLikes)
  else if (sort === 'rating') rows.sort(byRating)
  return { posts: rows, total }
}

function summarize(post, { likeCount, review, liked }) {
  return {
    id: post.id,
    userId: post.userId,
    authorName: post.authorName,
    title: post.title,
    city: post.city,
    journeyTheme: post.journeyTheme || null,
    dayCount: post.dayCount,
    summary: post.summary,
    rating: post.rating,
    avgRating: averageRating(post.rating, review.sum, review.count),
    reviewCount: review.count,
    likeCount,
    liked,
    images: parseImages(post.images),
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
export async function createPost(userId, authorName, { title, city, dayCount, summary, body, rating, payload, images }) {
  const count = await prisma.coursePost.count({ where: { userId } })
  if (count >= MAX_POSTS_PER_USER) {
    const error = new Error(`공유는 최대 ${MAX_POSTS_PER_USER}개까지 가능해요. 이전 글을 지우고 다시 시도해주세요.`)
    error.status = 409
    throw error
  }
  const safeImages = Array.isArray(images)
    ? images.filter((url) => typeof url === 'string' && url.trim()).slice(0, MAX_IMAGES)
    : []
  const row = await prisma.coursePost.create({
    data: {
      userId,
      authorName: cut(authorName, 40) || '여행자',
      title: cut(title, LIMITS.title),
      city: cut(city, LIMITS.city),
      journeyTheme: cut(payload?.meta?.journeyTheme, 40),
      dayCount: Number.isFinite(dayCount) ? Math.max(1, Math.min(30, Math.floor(dayCount))) : 1,
      summary: cut(summary, LIMITS.summary),
      body: cut(body, LIMITS.body),
      rating: clampRating(rating),
      payload: JSON.stringify(withoutAddresses(payload)),
      images: JSON.stringify(safeImages),
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
