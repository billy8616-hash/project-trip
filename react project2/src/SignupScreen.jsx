// ─────────────────────────────────────────────────────────────
// SignupScreen.jsx — 회원가입 / 프로필 채우기
//
// 한 화면이 두 가지 모드로 동작한다.
//   signup    이메일·비밀번호로 새 계정을 만들고 프로필도 함께 저장
//   complete  소셜 로그인으로 이미 계정은 있고, 이름 등 프로필만 채우는 경우
// 모드에 따라 검증 규칙과 보여 줄 입력칸이 달라진다(validate 의 mode 인자).
//
// 계정 자체는 Supabase Auth 가 만들고, 이름·생년월일·성별·휴대폰은 우리 DB 의
// Profile 로 따로 저장한다. 그래서 가입은 "계정 생성 → 프로필 저장" 두 단계다.
//
// 여기 검증은 1차 확인일 뿐이고, 서버가 같은 규칙으로 다시 검증한다 —
// 브라우저 검증은 우회할 수 있기 때문이다.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient.js'
import { saveMyProfile } from './lib/profileApi.js'

const genderOptions = [
  { value: '', label: '선택 안 함' },
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
  { value: 'other', label: '기타' },
]

const initialForm = {
  name: '',
  birthdate: '',
  gender: '',
  phone: '',
  email: '',
  password: '',
  passwordConfirm: '',
}

// 클라이언트 1차 검증. (서버에서도 동일한 규칙으로 다시 검증한다)
function validate(form, mode) {
  if (form.name.trim().length < 2) return '이름을 2자 이상 입력해주세요.'
  if (!form.birthdate) return '생년월일을 선택해주세요.'
  if (new Date(`${form.birthdate}T00:00:00`) > new Date()) return '생년월일은 미래일 수 없어요.'
  if (form.phone.trim() && !/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(form.phone.trim())) {
    return '휴대폰 번호 형식이 올바르지 않아요. (예: 010-1234-5678)'
  }
  if (mode === 'complete') return null

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return '올바른 이메일 형식이 아니에요.'
  if (form.password.length < 6) return '비밀번호는 6자 이상이어야 해요.'
  if (form.password !== form.passwordConfirm) return '비밀번호가 서로 일치하지 않아요.'
  return null
}

/**
 * 회원가입 화면 — 두 가지 모드로 쓰인다.
 * - mode="signup"   (기본) 이메일/비밀번호로 새 계정을 만들고 프로필까지 저장한다.
 * - mode="complete" 소셜 로그인으로 이미 계정은 있지만 이름 등 프로필이 없는 사용자가
 *                   처음 로그인했을 때, 비밀번호 입력 없이 프로필만 채운다.
 * - onBack    : 홈으로 돌아가기 (complete 모드에서는 로그아웃으로 쓰인다)
 * - onSuccess : 완료 시 호출 (App 에서 화면 전환/프로필 갱신에 사용)
 */
export default function SignupScreen({ mode = 'signup', onBack, onSuccess }) {
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailConfirmPending, setEmailConfirmPending] = useState(false)

  // 소셜 로그인(카카오/구글) 첫 진입이면 provider 가 넘겨준 닉네임을 이름 칸에 미리 채워 둔다.
  // 카카오는 동의 항목에 따라 이메일이 없을 수도 있어서, 사용자가 확실히 갖고 있는 건 닉네임뿐이다.
  useEffect(() => {
    if (mode !== 'complete') return undefined
    let alive = true

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return
      const meta = data?.user?.user_metadata || {}
      const nickname = String(meta.name || meta.full_name || meta.nickname || meta.preferred_username || '').trim()
      if (!nickname) return
      // 사용자가 이미 뭔가 입력했다면 덮어쓰지 않는다.
      setForm((prev) => (prev.name ? prev : { ...prev, name: nickname.slice(0, 20) }))
    })

    return () => {
      alive = false
    }
  }, [mode])

  const update = (key) => (event) => {
    const { value } = event.target
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const validationError = validate(form, mode)
    if (validationError) {
      setMessage(validationError)
      return
    }

    setLoading(true)
    setMessage('')

    const profilePayload = {
      name: form.name.trim(),
      birthdate: form.birthdate,
      gender: form.gender,
      phone: form.phone.trim(),
    }

    const run = async () => {
      if (mode === 'complete') {
        await saveMyProfile(profilePayload)
        return { confirmedNow: true }
      }

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { name: profilePayload.name } },
      })
      if (error) {
        throw new Error(error.message === 'User already registered' ? '이미 가입된 이메일이에요.' : error.message)
      }
      if (!data.session) {
        // 프로젝트에서 "이메일 확인"이 켜져 있으면 가입 직후엔 세션이 없다.
        // 이 경우 프로필은 로그인 후(이메일 확인 뒤) 다시 로그인할 때 완성 화면에서 채운다.
        return { confirmedNow: false }
      }
      await saveMyProfile(profilePayload)
      return { confirmedNow: true }
    }

    run()
      .then(({ confirmedNow }) => {
        if (!confirmedNow) {
          setEmailConfirmPending(true)
          return
        }
        onSuccess?.()
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false))
  }

  const today = new Date().toISOString().slice(0, 10)

  if (emailConfirmPending) {
    return (
      <section className="signup-screen">
        <div className="signup-card">
          <h1>이메일을 확인해주세요</h1>
          <p className="signup-lead">
            {form.email.trim()}로 확인 메일을 보냈어요. 메일의 링크를 눌러 인증을 마친 뒤 로그인해주세요.
          </p>
          <button type="button" className="back-button" onClick={onBack}>
            ← 돌아가기
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="signup-screen">
      <div className="signup-card">
        {onBack && (
          <button type="button" className="back-button" onClick={onBack}>
            {mode === 'complete' ? '← 로그아웃' : '← 돌아가기'}
          </button>
        )}
        <h1>{mode === 'complete' ? '프로필 완성' : '회원가입'}</h1>
        <p className="signup-lead">
          {mode === 'complete'
            ? '여행 코스를 저장하고 이어보려면 몇 가지 정보만 더 알려주세요.'
            : '여행 코스를 저장하고 이어보려면 몇 가지 정보만 알려주세요.'}
        </p>

        <form className="signup-form" onSubmit={handleSubmit} noValidate>
          <label>
            이름 <span className="req">*</span>
            <input
              value={form.name}
              onChange={update('name')}
              autoComplete="name"
              placeholder="홍길동"
              required
            />
          </label>

          <label>
            생년월일 <span className="req">*</span>
            <input
              type="date"
              value={form.birthdate}
              onChange={update('birthdate')}
              max={today}
              required
            />
          </label>

          <label>
            성별
            <select value={form.gender} onChange={update('gender')}>
              {genderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            휴대폰 번호 <span className="optional">(선택)</span>
            <input
              value={form.phone}
              onChange={update('phone')}
              autoComplete="tel"
              inputMode="tel"
              placeholder="010-1234-5678"
            />
          </label>

          {mode !== 'complete' && (
            <>
              <label className="full">
                이메일 <span className="req">*</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label>
                비밀번호 <span className="req">*</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={update('password')}
                  autoComplete="new-password"
                  minLength="6"
                  placeholder="6자 이상"
                  required
                />
              </label>

              <label>
                비밀번호 확인 <span className="req">*</span>
                <input
                  type="password"
                  value={form.passwordConfirm}
                  onChange={update('passwordConfirm')}
                  autoComplete="new-password"
                  minLength="6"
                  required
                />
              </label>
            </>
          )}

          {message && <p className="auth-message full">{message}</p>}

          <button type="submit" className="signup-submit full" disabled={loading}>
            {loading ? '처리 중...' : mode === 'complete' ? '완료' : '가입하기'}
          </button>
        </form>
      </div>
    </section>
  )
}
