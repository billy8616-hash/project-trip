// ─────────────────────────────────────────────────────────────
// hooks/useAuth.js — 로그인 상태를 한곳에서 관리하는 훅
//
// 두 가지를 합쳐서 하나의 "사용자"로 보여 준다.
//   session  Supabase Auth 가 주는 인증 정보 (이메일·토큰)
//   profile  우리 DB 에 있는 앱 전용 정보 (이름·생년월일·성별·휴대폰)
// 둘 다 있어야 user 로 취급한다.
//
// needsProfile 은 "로그인은 됐는데 이름이 없는" 상태다. 소셜 로그인으로 처음
// 들어온 사용자가 여기 해당하고, 앱은 이때 추가 정보 입력 화면으로 보낸다.
//
// 화면(App.jsx)은 토큰이나 세션을 직접 다루지 않는다 — 이 훅이 돌려주는
// user / 로그인 함수 / 로그아웃 함수만 쓴다.
// ─────────────────────────────────────────────────────────────

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
  // 소셜 로그인 리다이렉트를 기다리는 동안 어떤 버튼을 눌렀는지 ('google' | 'kakao' | '').
  const [socialLoading, setSocialLoading] = useState('')

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

  // 우리 DB 쪽 프로필을 다시 읽어 온다. 회원가입 직후·프로필 수정 후에도 호출한다.
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

  // 이메일·비밀번호 로그인. Supabase 의 영어 에러 메시지를 그대로 보여 주면 불친절해서,
  // 가장 흔한 "Invalid login credentials" 만 한국어 문구로 바꿔 준다.
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

  // 소셜 로그인은 성공하면 브라우저가 provider 로 떠나 버리므로, 여기서 처리할 건 '실패'뿐이다.
  // 예전엔 Promise 를 그냥 반환해서, Supabase 대시보드에 provider 가 꺼져 있으면(=가장 흔한 상황)
  // 버튼을 눌러도 아무 일도 안 일어난 것처럼 보였다. 이제 실패 사유를 패널에 띄운다.
  const signInWithProvider = useCallback((provider, label) => {
    setSocialLoading(provider)
    setAuthMessage('')

    // scopes 를 여기서 줄일 수는 없다 — Supabase 의 Kakao provider 는 서버 쪽에
    // account_email + profile_image + profile_nickname 을 고정으로 보내고, 클라이언트가 넘긴 값을
    // 덧붙이기만 한다. 따라서 이 세 항목 모두 카카오 콘솔의 '동의항목'에 설정돼 있어야 한다.
    return supabase.auth
      .signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
      .then(({ error }) => {
        if (error) throw error
        // 성공 시에는 리다이렉트가 일어나므로 socialLoading 을 풀지 않는다 (버튼이 계속 '연결 중'으로 남는다).
      })
      .catch((error) => {
        setSocialLoading('')
        const reason = error?.message || ''
        const notEnabled = /unsupported provider|provider is not enabled|not enabled/i.test(reason)
        setAuthMessage(
          notEnabled
            ? `${label} 로그인이 아직 연결되지 않았어요. (관리자: Supabase → Authentication → Providers 에서 ${label} 를 켜주세요)`
            : `${label} 로그인에 실패했어요. ${reason}`,
        )
      })
  }, [])

  const signInWithGoogle = useCallback(() => signInWithProvider('google', '구글'), [signInWithProvider])

  const signInWithKakao = useCallback(() => signInWithProvider('kakao', '카카오'), [signInWithProvider])

  // 로그아웃. Supabase 세션을 지우고 우리 쪽 프로필 상태도 함께 비운다.
  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => null)
    setProfile(null)
  }, [])

  // 회원가입 화면으로 넘어갈 때처럼, 패널만 닫고 입력을 비운다.
  const closeAuthPanel = useCallback(() => {
    setAuthOpen(false)
    setAuthMessage('')
    setAuthPassword('')
    setSocialLoading('')
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
    socialLoading,
    submitLogin,
    signOut,
    signInWithGoogle,
    signInWithKakao,
    closeAuthPanel,
  }
}
