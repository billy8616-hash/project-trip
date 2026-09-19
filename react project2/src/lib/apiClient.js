// 로그인이 필요한 백엔드 요청 공용 헬퍼. 현재 Supabase 세션의 액세스 토큰을
// Authorization 헤더에 실어 보낸다. (tripsApi.js / communityApi.js / profileApi.js 가 함께 쓴다)
import { apiBaseUrl } from './api.js'
import { supabase } from './supabaseClient.js'

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
