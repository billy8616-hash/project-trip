import { useState } from 'react'
import { signup } from './authApi'

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
function validate(form) {
  if (form.name.trim().length < 2) return '이름을 2자 이상 입력해주세요.'
  if (!form.birthdate) return '생년월일을 선택해주세요.'
  if (new Date(`${form.birthdate}T00:00:00`) > new Date()) return '생년월일은 미래일 수 없어요.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return '올바른 이메일 형식이 아니에요.'
  if (form.password.length < 6) return '비밀번호는 6자 이상이어야 해요.'
  if (form.password !== form.passwordConfirm) return '비밀번호가 서로 일치하지 않아요.'
  if (form.phone.trim() && !/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(form.phone.trim())) {
    return '휴대폰 번호 형식이 올바르지 않아요. (예: 010-1234-5678)'
  }
  return null
}

/**
 * 회원가입 전용 화면.
 * - onBack    : 홈으로 돌아가기
 * - onSuccess : 가입 성공 시 생성된 사용자 정보를 전달 (App 에서 로그인 상태로 반영)
 */
export default function SignupScreen({ onBack, onSuccess }) {
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (key) => (event) => {
    const { value } = event.target
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const validationError = validate(form)
    if (validationError) {
      setMessage(validationError)
      return
    }

    setLoading(true)
    setMessage('')

    signup({
      name: form.name.trim(),
      birthdate: form.birthdate,
      gender: form.gender,
      phone: form.phone.trim(),
      email: form.email.trim(),
      password: form.password,
      passwordConfirm: form.passwordConfirm,
    })
      .then(({ user }) => onSuccess(user))
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false))
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <section className="signup-screen">
      <div className="signup-card">
        <button type="button" className="back-button" onClick={onBack}>
          ← 돌아가기
        </button>
        <h1>회원가입</h1>
        <p className="signup-lead">
          여행 코스를 저장하고 이어보려면 몇 가지 정보만 알려주세요.
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

          {message && <p className="auth-message full">{message}</p>}

          <button type="submit" className="signup-submit full" disabled={loading}>
            {loading ? '가입 처리 중...' : '가입하기'}
          </button>
        </form>
      </div>
    </section>
  )
}
