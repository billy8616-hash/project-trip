// ─────────────────────────────────────────────────────────────
// lib/communityApi.js — 커뮤니티(코스 공유·후기·추천)
//
// 목록·상세는 비로그인도 볼 수 있지만 "내가 이미 추천했는지"는 로그인해야
// 알 수 있다. 그래서 모든 요청을 authedRequest 로 보낸다 — 토큰이 있으면
// 서버가 내 추천 여부까지 채워 주고, 없으면 공개 정보만 내려온다.
//
// 쓰는 곳: CommunityScreen
// ─────────────────────────────────────────────────────────────

// 커뮤니티 — 공유된 코스 / 후기 / 추천 API.
// 읽기(list·get)는 비로그인도 되지만, "내가 추천했는지" 같은 건 액세스 토큰이 있어야 채워지므로
// 모든 요청에 Supabase 액세스 토큰을 함께 보낸다(로그인 안 했으면 토큰 없이 그냥 보낸다).
import { authedRequest as request } from './apiClient.js'

// 목록. sort: 'recent' | 'likes' | 'rating', city 는 빈 문자열이면 전체.
export async function listCommunityPosts({ city = '', sort = 'recent' } = {}) {
  const params = new URLSearchParams()
  if (city) params.set('city', city)
  if (sort) params.set('sort', sort)
  const query = params.toString()
  const data = await request(`/api/community${query ? `?${query}` : ''}`)
  return data.posts || []
}

export async function getCommunityPost(id) {
  const data = await request(`/api/community/${id}`)
  return data.post
}

// 지금 보고 있는 코스를 공유한다. payload 는 "내 여행" 저장과 같은 모양.
export async function sharePost({ title, city, dayCount, summary, body, rating, payload }) {
  const data = await request('/api/community', {
    method: 'POST',
    body: JSON.stringify({ title, city, dayCount, summary, body, rating, payload }),
  })
  return data.post
}

export async function deletePost(id) {
  await request(`/api/community/${id}`, { method: 'DELETE' })
}

// 후기 남기기 (한 사람당 하나, 다시 보내면 갱신).
export async function writeReview(postId, { rating, body }) {
  const data = await request(`/api/community/${postId}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating, body }),
  })
  return data.review
}

export async function deleteMyReview(postId) {
  await request(`/api/community/${postId}/reviews`, { method: 'DELETE' })
}

// 추천 토글 → { liked, likeCount }
export async function toggleLike(postId) {
  return request(`/api/community/${postId}/like`, { method: 'POST' })
}
