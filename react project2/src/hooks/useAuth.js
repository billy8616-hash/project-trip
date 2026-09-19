import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { getMyProfile } from '../lib/profileApi.js'

// 로그인 패널 상태와 Supabase 세션을 한곳에서 관리한다.
// (회원가입은 별도 화면 SignupScreen 에서 처리하므로 여기엔 패널을 닫는 동작만 있다)
export function useAuth() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // 새로고침해도, 소셜 로그인 리다이렉트로 돌아와도 Supabase 가 세션 복원을 알려준다.
  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) setSession(nextSession)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = useCallback(() => {
    return getMyProfile().then((data) => {
      setProfile(data)
      return data
    })
  }, [])

  // 세션이 생기면(로그인/소셜 로그인/새로고침 복원) 이름 등 추가 프로필을 불러온다.
  // session 이 null 이면 user/needsProfile 계산에서 어차피 무시되니 profile 을 따로 비울 필요는 없다
  // (로그아웃 시점의 초기화는 signOut() 이 직접 처리한다).
  useEffect(() => {
    if (!session) return
    refreshProfile().catch(() => setProfile(null))
  }, [session, refreshProfile])

  const user = session && profile ? profile : null

  // 로그인은 됐는데 프로필(이름)이 아직 없는 상태 — 소셜 로그인 첫 진입이 대표적인 경우.
  const needsProfile = Boolean(session && profile && !profile.name)

  const submitLogin = useCallback(
    (event) => {
      event.preventDefault()
      setAuthLoading(true)
      setAuthMessage('')

      supabase.auth
        .signInWithPassword({ email: authEmail.trim(), password: authPassword })
        .then(({ error }) => {
          if (error) {
            throw new Error(
              error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 맞지 않아요.' : error.message,
            )
          }
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

  const signInWithGoogle = useCallback(() => {
    return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
  }, [])

  const signInWithKakao = useCallback(() => {
    return supabase.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: window.location.origin } })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => null)
    setProfile(null)
  }, [])

  // 회원가입 화면으로 넘어갈 때처럼, 패널만 닫고 입력을 비운다.
  const closeAuthPanel = useCallback(() => {
    setAuthOpen(false)
    setAuthMessage('')
    setAuthPassword('')
  }, [])

  return {
    user,
    needsProfile,
    refreshProfile,
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
    signInWithGoogle,
    signInWithKakao,
    closeAuthPanel,
  }
}
