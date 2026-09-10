/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/auth/SignupPage.jsx
   [화면의 어디?]  회원가입 전용 화면. 메인 화면 위가 아니라 "따로 뜬 작은 창(팝업)" 전체를 채운다.
   [언제 보이나]  main.jsx 가, 주소에 ?page=signup 이 있으면 이 화면을 그린다.
   [흐름]
     1. 아이디 / 비밀번호 / 비밀번호 확인 / 닉네임(선택) 입력
     2. '가입하기' → 비밀번호 두 개가 같은지 먼저 확인 → 서버로 전송(authApi.js 의 signup)
     3. 성공하면 '가입 완료' 화면으로 바뀌고, '창 닫기' 로 팝업을 닫는다.
        그 뒤 메인 창에서 방금 만든 아이디로 로그인하면 된다.
   ─────────────────────────────────────────────────────────────── */

import { useState } from 'react'
import { signup } from './authApi.js' // 서버에 회원가입 요청을 보내는 함수
import styles from './SignupPage.module.css'

export default function SignupPage() {
  // 입력칸 4개의 값을 하나의 묶음(객체)으로 기억한다.
  const [form, setForm] = useState({
    username: '',
    password: '',
    password2: '', // 비밀번호 확인
    nickname: '',
  })
  const [error, setError] = useState('') // 빨간 오류 문구
  const [busy, setBusy] = useState(false) // 서버 응답 대기 중인가?
  const [done, setDone] = useState(false) // 가입이 끝났는가? (true 면 완료 화면 표시)

  // update('username') 처럼 부르면 → 그 칸 전용 onChange 함수를 만들어 준다.
  // (...f 는 "기존 값은 그대로 두고", [key] 칸만 새 값으로 바꾼다는 뜻)
  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setError('')
  }

  // '가입하기' 를 눌렀을 때
  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return

    // 서버에 보내기 전에, 비밀번호 두 칸이 같은지 먼저 확인
    if (form.password !== form.password2) {
      setError('비밀번호가 서로 일치하지 않습니다.')
      return
    }

    setBusy(true)
    const res = await signup(form) // 서버로 전송하고 결과를 기다림
    setBusy(false)
    if (!res.ok) {
      setError(res.message) // 실패 (예: 이미 있는 아이디)
      return
    }
    setDone(true) // 성공 → 완료 화면으로
  }

  // done 이 true 면: 입력 폼 대신 '가입 완료' 화면을 보여 주고 함수 종료
  if (done) {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.check} aria-hidden="true">
            ✓
          </div>
          <h1 className={styles.title}>가입 완료!</h1>
          <p className={styles.lead}>
            <b>{form.username}</b> 아이디로 가입되었습니다.
            <br />이 창을 닫고, 방금 만든 아이디·비밀번호로 로그인하세요.
          </p>
          <button
            type="button"
            className={styles.submit}
            onClick={() => window.close()} // 이 팝업 창을 닫는다
          >
            창 닫기
          </button>
        </div>
      </main>
    )
  }

  // 아직 가입 전: 입력 폼을 보여 준다
  return (
    <main className={styles.wrap}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>회원가입</h1>
        <p className={styles.lead}>
          발길따라에서 쓸 아이디와 비밀번호를 정해 주세요.
        </p>

        {/* 입력칸마다 value = 지금 저장된 값, onChange = update('그칸이름') 으로 값을 갱신 */}
        <label className={styles.field}>
          <span>
            아이디 <em>4자 이상</em>
          </span>
          <input
            value={form.username}
            onChange={update('username')}
            autoComplete="username"
            autoFocus
          />
        </label>

        <label className={styles.field}>
          <span>
            비밀번호 <em>4자 이상</em>
          </span>
          <input
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
          />
        </label>

        <label className={styles.field}>
          <span>비밀번호 확인</span>
          <input
            type="password"
            value={form.password2}
            onChange={update('password2')}
            autoComplete="new-password"
          />
        </label>

        <label className={styles.field}>
          <span>
            닉네임 <em>선택</em>
          </span>
          <input
            value={form.nickname}
            onChange={update('nickname')}
            placeholder="비우면 아이디로 표시돼요"
          />
        </label>

        {/* 오류가 있을 때만 표시 */}
        {error && <p className={styles.error}>{error}</p>}

        {/* 전송 중이면 버튼을 잠그고 글자를 '가입 중…' 으로 바꾼다 */}
        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? '가입 중…' : '가입하기'}
        </button>
      </form>
    </main>
  )
}
