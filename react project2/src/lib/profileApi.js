// ─────────────────────────────────────────────────────────────
// lib/profileApi.js — 우리 앱만의 프로필 필드
//
// 계정(이메일·비밀번호·소셜 로그인)은 Supabase Auth 가 관리하고,
// 이름·생년월일·성별·휴대폰처럼 앱에서 따로 필요한 값만 우리 DB(Profile 테이블)에 둔다.
//
// 쓰는 곳: SignupScreen · MyTripsScreen(프로필 편집)
// ─────────────────────────────────────────────────────────────

// 이름/생년월일/성별/휴대폰 프로필 — 로그인 자체는 Supabase Auth(supabaseClient.js)가 담당하고,
// 여기서는 우리 앱만의 추가 필드만 백엔드(server/app.js 의 /api/profile)와 주고받는다.
import { authedRequest } from './apiClient.js'

export async function getMyProfile() {
  const data = await authedRequest('/api/profile')
  return data.profile
}

// payload: { name, birthdate, gender, phone }
export async function saveMyProfile(payload) {
  const data = await authedRequest('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return data.profile
}

// 회원 탈퇴 — 프로필·저장한 여행·내 글/후기/추천·올린 사진·계정을 모두 지운다. 되돌릴 수 없다.
// 성공하면 로그인 세션도 더는 쓸 수 없으므로 호출한 쪽에서 signOut 으로 화면을 정리해야 한다.
export async function deleteMyAccount() {
  await authedRequest('/api/profile', {
    method: 'DELETE',
    body: JSON.stringify({ confirm: true }),
  })
}
