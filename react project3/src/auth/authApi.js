/* =========================================================================
   [파일 위치] src/auth/authApi.js
   [무엇인가]  화면(프론트엔드)과 서버(백엔드) 사이의 "연락 담당" 파일.
              회원가입 / 로그인 / 로그아웃 / 로그인 상태 확인을 서버에 요청한다.
   [핵심 용어]
     · 프론트엔드 = 지금 보고 있는 화면 쪽 코드 (react project3/src)
     · 백엔드/서버 = 아이디·비밀번호를 실제로 보관하고 검사하는 별도 프로그램 (react project3/server)
     · fetch(...) = 브라우저가 서버에게 보내는 '요청'. 답이 올 때까지 기다려야 해서 async/await 를 쓴다.
   [주의]
     · credentials:'include' → 로그인 상태를 유지하는 '쿠키'를 함께 주고받겠다는 뜻.
     · 개발 중에는 /api 로 시작하는 요청을 Vite 가 http://localhost:8787(서버)로 넘겨 준다.
       따라서 서버(npm run server 또는 npm start)가 꺼져 있으면 이 요청들은 실패한다.
   [연결]  LoginModal / SignupPage / HeroSection 이 이 파일의 함수들을 가져다 쓴다.
   ========================================================================= */

// 백엔드에 아예 연결되지 않았을 때 보여줄 메시지
const OFFLINE_MESSAGE =
  '서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요 (npm start 또는 npm run server).'

/**
 * 서버에 정보를 '보내는' 요청(POST)을 대신 처리해 주는 공용 함수.
 * 아래 signup / login / logout 이 모두 이 함수를 통해 서버와 대화한다.
 * 반환값: { ok: 성공여부, offline?: 서버에 연결조차 안 됐는지, message?: 안내문구, ...서버가 준 데이터 }
 */
async function post(path, body) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    // fetch 자체가 실패 = 네트워크 단절 / 서버 다운
    return { ok: false, offline: true, message: OFFLINE_MESSAGE }
  }

  const data = await res.json().catch(() => null)

  if (data == null) {
    // 200~299 인데 JSON 이 아니거나, 프록시가 HTML 에러 페이지를 반환한 경우
    return {
      ok: false,
      offline: !res.ok,
      message: res.ok ? '서버 응답을 해석할 수 없습니다.' : OFFLINE_MESSAGE,
    }
  }

  return { ok: res.ok, ...data }
}

/**
 * 회원가입. SignupPage 가 입력값을 넘겨주면 서버 /api/signup 으로 보낸다.
 * 성공: { ok: true, user }  /  실패: { ok: false, message: '이유' }
 */
export async function signup({ username, password, nickname }) {
  const r = await post('/signup', { username, password, nickname })
  return r.ok
    ? { ok: true, user: r.user }
    : { ok: false, message: r.message || '회원가입에 실패했습니다.' }
}

/**
 * 로그인. LoginModal 이 사용한다. 성공하면 서버가 '로그인 유지 쿠키'를 내려준다.
 * 성공: { ok: true, user }  /  실패: { ok: false, message: '이유' }
 */
export async function login({ username, password }) {
  const r = await post('/login', { username, password })
  return r.ok
    ? { ok: true, user: r.user }
    : { ok: false, message: r.message || '로그인에 실패했습니다.' }
}

// 로그아웃. 서버에 알려서 로그인 유지 쿠키를 없앤다.
export async function logout() {
  await post('/logout')
}

/**
 * "지금 로그인돼 있어? 돼 있으면 누구야?" 를 서버에 물어본다. (정보를 '가져오는' 요청이라 GET)
 * 로그인 상태면 { username, nickname }, 아니면 null 을 돌려준다.
 * HeroSection 이 화면이 뜰 때와 창으로 돌아올 때 호출한다.
 */
export async function getSession() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    return data.user || null
  } catch {
    return null
  }
}
