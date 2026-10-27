// ─────────────────────────────────────────────────────────────
// lib/courseDraftApi.js — 작업 중인 코스를 서버에 올리고 불러오기
//
// lib/tripSession.js 의 로컬 스냅샷과 같은 내용을, 로그인했을 때만 서버에도 둔다.
// 로컬 스냅샷은 같은 브라우저의 새로고침을, 이쪽은 기기를 바꿨을 때를 맡는다.
//
// 쓰는 곳: App.jsx (코스 화면 자동 저장 · 홈 화면 "이어서 보기")
// ─────────────────────────────────────────────────────────────

import { authedRequest as request } from './apiClient.js'

export async function fetchCourseDraft() {
  const data = await request('/api/course-draft')
  return data.draft || null
}

export async function saveCourseDraft({ dayCount, payload }) {
  const data = await request('/api/course-draft', {
    method: 'PUT',
    body: JSON.stringify({ dayCount, payload }),
  })
  return data.draft
}

export async function deleteCourseDraft() {
  await request('/api/course-draft', { method: 'DELETE' })
}
