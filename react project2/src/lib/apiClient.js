// ─────────────────────────────────────────────────────────────
// lib/apiClient.js — 로그인이 필요한 요청의 공용 통로
//
// 토큰을 직접 들고 다니지 않는 게 요점이다. 요청할 때마다 Supabase 에
// 현재 세션을 물어보고 액세스 토큰을 헤더에 싣는다. 그래서 토큰이 갱신돼도
// 화면 코드는 아무것도 몰라도 된다.
//
// 쓰는 곳: tripsApi.js · communityApi.js · profileApi.js
// ─────────────────────────────────────────────────────────────

// 로그인이 필요한 백엔드 요청 공용 헬퍼. 현재 Supabase 세션의 액세스 토큰을
// Authorization 헤더에 실어 보낸다. (tripsApi.js / communityApi.js / profileApi.js 가 함께 쓴다)
import { apiBaseUrl } from './api.js'
import { supabase } from './supabaseClient.js'

// 서버가 실패를 알려 주면 message 를 그대로 Error 로 바꿔 던진다.
// status 를 error 에 붙여 두어, 호출한 쪽이 401(로그인 만료)만 따로 처리할 수 있게 했다.
export async function authedRequest(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : null),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.message || '요청을 처리하지 못했어요.')
    error.status = response.status
    throw error
  }
  return data
}
