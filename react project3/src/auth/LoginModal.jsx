/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/auth/LoginModal.jsx
   [화면의 어디?]  '로그인' 버튼을 누르면 홈 화면 위에 떠오르는 작은 로그인 창.
   [구성]  아이디 입력칸 + 비밀번호 입력칸 + 로그인 버튼 + 아래쪽 '회원가입' 링크.
   [하는 일]  입력값을 서버로 보내(authApi.js 의 login) 맞으면 부모에게 성공을 알리고 창을 닫는다.
   [연결]  HeroSection.jsx 가 loginOpen 이 true 일 때 이 창을 띄운다.
   ─────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from 'react'
import { login } from './authApi.js' // 서버에 로그인 요청을 보내는 함수
import { openSignupWindow } from './openSignup.js'
import styles from './LoginModal.module.css'

// props: onClose(창 닫기) / onSuccess(로그인 성공 시 사용자 정보를 들고 호출)
export default function LoginModal({ onClose, onSuccess }) {
  const [username, setUsername] = useState('') // 입력한 아이디
  const [password, setPassword] = useState('') // 입력한 비밀번호
  const [error, setError] = useState('') // 실패했을 때 보여 줄 빨간 문구
  const [busy, setBusy] = useState(false) // 서버 응답을 기다리는 중인가? (버튼 중복 클릭 방지)
  const firstRef = useRef(null) // 아이디 입력칸을 가리키는 손잡이 (창이 열리면 자동으로 커서 놓기)

  useEffect(() => {
    firstRef.current?.focus() // 창이 뜨면 아이디 칸에 바로 입력할 수 있게 커서를 둔다
    const onKey = (e) => {
      if (e.key === 'Escape') onClose() // ESC 로 닫기
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // '로그인' 버튼을 눌렀을 때 (또는 입력칸에서 엔터)
  async function handleSubmit(e) {
    e.preventDefault() // 폼 제출 시 페이지가 새로고침되는 기본 동작 막기
    if (busy) return // 이미 요청 중이면 무시
    setBusy(true)
    const res = await login({ username, password }) // 서버에 물어본다 (await = 답이 올 때까지 기다림)
    setBusy(false)
    if (!res.ok) {
      setError(res.message) // 실패 → 이유를 화면에 표시
      return
    }
    onSuccess(res.user) // 성공 → 부모(HeroSection)에게 사용자 정보 전달
  }

  return (
    // 바깥(어두운 배경)을 누르면 닫힘. 카드 안쪽 클릭은 stopPropagation 으로 막는다.
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="로그인"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>

        <h2 className={styles.title}>로그인</h2>

        {/* onSubmit: 이 폼 안에서 엔터를 치거나 제출 버튼을 누르면 handleSubmit 실행 */}
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>아이디</span>
            {/* value 는 지금 상태값, onChange 는 타이핑할 때마다 상태값을 새로 저장 (React 입력칸의 기본 형태) */}
            <input
              ref={firstRef}
              value={username}
              autoComplete="username"
              onChange={(e) => {
                setUsername(e.target.value) // 입력한 글자를 저장
                setError('') // 다시 입력하면 이전 오류 문구는 지운다
              }}
            />
          </label>

          <label className={styles.field}>
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
            />
          </label>

          {/* error 에 내용이 있을 때만 빨간 문구를 보여 준다 */}
          {error && <p className={styles.error}>{error}</p>}

          {/* busy(요청 중)면 버튼을 비활성화하고 글자를 '확인 중…' 으로 바꾼다 */}
          <button type="submit" className={styles.submit} disabled={busy}>
            {busy ? '확인 중…' : '로그인'}
          </button>
        </form>

        <p className={styles.foot}>
          아직 회원이 아니신가요?{' '}
          <button
            type="button"
            className={styles.footLink}
            onClick={() => openSignupWindow()} // 회원가입 팝업 창 열기
          >
            회원가입
          </button>
        </p>
      </div>
    </div>
  )
}
