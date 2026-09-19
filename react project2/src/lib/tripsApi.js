// "내 여행" — 로그인 사용자가 저장한 여행 동선 API. 모든 요청에 Supabase 액세스 토큰을 함께 보낸다.
import { authedRequest as request } from './apiClient.js'

export async function listTrips() {
  const data = await request('/api/trips')
  return data.trips || []
}

export async function saveTrip({ title, city, dayCount, payload }) {
  const data = await request('/api/trips', {
    method: 'POST',
    body: JSON.stringify({ title, city, dayCount, payload }),
  })
  return data.trip
}

export async function renameTrip(id, title) {
  await request(`/api/trips/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
}

export async function deleteTrip(id) {
  await request(`/api/trips/${id}`, { method: 'DELETE' })
}
