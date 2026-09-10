// "내 여행" — 로그인 사용자가 저장한 여행 동선 API. 모든 요청은 인증 쿠키를 함께 보낸다.
import { apiBaseUrl } from './api.js'

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(data?.message || '요청을 처리하지 못했어요.')
    error.status = response.status
    throw error
  }
  return data
}

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
