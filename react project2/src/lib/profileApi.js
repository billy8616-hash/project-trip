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
