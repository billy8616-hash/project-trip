import { useCallback, useEffect, useState } from 'react'
import { getCurrentUser, login, logout } from '../authApi'

// 로그인 패널 상태와 세션을 한곳에서 관리한다.
// (회원가입은 별도 화면 SignupScreen 에서 처리하므로 여기엔 패널을 닫는 동작만 있다)
export function useAuth() {
  const [user, setUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // 새로고침해도 쿠키가 살아 있으면 로그인 상태를 복원한다.
  useEffect(() => {
    let isMounted = true

    getCurrentUser()
      .then(({ user: currentUser }) => {
        if (isMounted) setUser(currentUser)
      })
      .catch(() => {
        if (isMounted) setUser(null)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const submitLogin = useCallback(
    (event) => {
      event.preventDefault()
      setAuthLoading(true)
      setAuthMessage('')

      login(authEmail.trim(), authPassword)
        .then(({ user: authenticatedUser }) => {
          setUser(authenticatedUser)
          setAuthOpen(false)
          setAuthMessage('')
          setAuthPassword('')
        })
        .catch((error) => {
          setAuthMessage(error.message)
        })
        .finally(() => {
          setAuthLoading(false)
        })
    },
    [authEmail, authPassword],
  )

  const signOut = useCallback(async () => {
    await logout().catch(() => null)
    setUser(null)
  }, [])

  // 회원가입 화면으로 넘어갈 때처럼, 패널만 닫고 입력을 비운다.
  const closeAuthPanel = useCallback(() => {
    setAuthOpen(false)
    setAuthMessage('')
    setAuthPassword('')
  }, [])

  return {
    user,
    // 회원가입 화면이 가입 직후 받은 사용자를 그대로 로그인 상태로 넘겨줄 때 쓴다.
    setUser,
    authOpen,
    setAuthOpen,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authMessage,
    authLoading,
    submitLogin,
    signOut,
    closeAuthPanel,
  }
}
