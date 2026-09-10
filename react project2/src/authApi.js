// 기본값은 빈 문자열: 같은 오리진(/api)으로 요청하고 Vite 개발 서버의 프록시가 백엔드로 전달한다.
// 프록시를 쓰지 않고 백엔드에 직접 붙이려면 .env 의 VITE_API_BASE_URL 에 전체 URL 을 지정한다.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    })
  } catch {
    // fetch 자체가 실패 = 인증 API 서버에 연결하지 못함
    throw new Error('인증 서버에 연결하지 못했어요. 개발 서버(npm run dev)가 실행 중인지 확인해주세요.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || '요청을 처리하지 못했어요.')
  }

  return data
}

export function getCurrentUser() {
  return request('/api/auth/me')
}

export function login(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

// payload: { name, birthdate, gender, phone, email, password, passwordConfirm }
export function signup(payload) {
  return request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function logout() {
  return request('/api/auth/logout', {
    method: 'POST',
  })
}
