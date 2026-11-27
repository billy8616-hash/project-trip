// ─────────────────────────────────────────────────────────────
// screens/AccountScreen.jsx — "내 계정" (내 정보 · 로그아웃 · 회원 탈퇴)
//
// 회원 탈퇴가 이 화면의 핵심이다. 되돌릴 수 없는 일이라 세 가지를 지킨다.
//   1) 무엇이 지워지는지 먼저 구체적으로 보여 준다 (서버가 실제로 지우는 목록과 같다 — server/accountStore.js).
//   2) 버튼 한 번으로 끝나지 않는다. 그 자리에서 펼쳐지는 확인 칸에 "탈퇴합니다"를 직접 입력해야 최종 버튼이 켜진다.
//   3) 실패해도 다시 누르면 남은 것만 이어서 지운다(서버가 단계마다 여러 번 해도 안전하게 만들어 뒀다).
//
// 탈퇴가 끝나면 로그인 세션을 정리(signOut)해도 이 화면에 "끝났어요" 안내가 남는다.
// user 가 사라져도 phase 가 'done' 이면 로그인 안내가 아니라 완료 안내를 보여 주기 때문이다.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { CONFIRM_PHRASE, failureMessage, isConfirmPhrase, isUnknownOutcome } from '../lib/accountConfirm.js'
import { deleteMyAccount } from '../lib/profileApi.js'

// 서버가 실제로 지우는 것들 (server/accountStore.js · communityStorage.js 와 같은 내용을 사용자 말로).
const REMOVED_ITEMS = [
  '프로필 정보 (이름, 생년월일, 성별, 휴대폰 번호)',
  '로그인 계정 (이메일, 소셜 로그인 연결)',
  '내 여행에 저장한 코스',
  '커뮤니티에 공유한 내 글과 올린 사진',
  '내 글에 다른 여행자가 남긴 후기와 추천',
  '내가 다른 글에 남긴 후기와 추천',
]

// 패널이 다 펼쳐진 뒤 보이는 곳으로 스크롤한다. 움직임 줄이기 설정이면 전환이 없어 transitionend 가 오지 않으므로 바로 한다.
function revealWhenExpanded(panel) {
  if (!panel) return
  const reveal = () => panel.scrollIntoView({ block: 'nearest' })
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(reveal)
    return
  }
  const done = (event) => {
    if (event && event.propertyName !== 'grid-template-rows') return
    panel.removeEventListener('transitionend', done)
    reveal()
  }
  panel.addEventListener('transitionend', done)
  // 전환 이벤트가 안 오는 경우(이미 열려 있음 등)를 위한 안전장치
  window.setTimeout(() => done(), 400)
}

export default function AccountScreen({ user, leaving, onBack, onRequireLogin, onSignOut, onBusyChange, onDeleted }) {
  // idle: 평소 / confirming: 확인 칸이 펼쳐짐 / deleting: 지우는 중 / done: 끝남
  const [phase, setPhase] = useState('idle')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')

  const openButtonRef = useRef(null)
  const inputRef = useRef(null)
  const panelRef = useRef(null)
  const doneHeadingRef = useRef(null)
  // 서버에 요청을 보냈지만 결과를 모르는 상태(네트워크 끊김·5xx)였는지.
  // 이 뒤에 오는 401 은 "이미 탈퇴가 끝나 계정이 없어짐"일 가능성이 커서 완료로 본다.
  // 처음 보낸 요청의 401 은 로그인이 만료된 것뿐이라 완료로 보면 안 된다.
  const unknownOutcomeRef = useRef(false)
  // 접기·펼치기 직후 포커스를 옮길 방향. 상태가 바뀐 다음 그려진 뒤에 옮겨야 해서 effect 에서 처리한다.
  const focusTargetRef = useRef(null)

  const open = phase === 'confirming' || phase === 'deleting'
  const deleting = phase === 'deleting'
  const phraseOk = isConfirmPhrase(confirmText)

  // 상태가 바뀐 뒤(그려진 다음)에 포커스를 옮긴다. 비활성이 된 요소는 포커스를 잃고 body 로 떨어지므로
  // 삭제 중 → 실패(입력칸으로), 삭제 중 → 완료(제목으로)처럼 옮길 곳을 정해 주지 않으면 키보드 사용자가 길을 잃는다.
  useEffect(() => {
    const target = focusTargetRef.current
    focusTargetRef.current = null
    if (target === 'input') {
      // 접힌 높이 0 상태에서 포커스를 주면 브라우저가 그 위치로 스크롤해 입력칸이 화면 밖에 남는다(모바일).
      // 그래서 스크롤 없이 포커스만 주고, 패널이 다 펼쳐진 뒤 보이는 곳으로 직접 스크롤한다.
      inputRef.current?.focus({ preventScroll: true })
      revealWhenExpanded(panelRef.current)
    }
    if (target === 'open-button') openButtonRef.current?.focus()
    if (target === 'done-heading') doneHeadingRef.current?.focus()
  }, [phase])

  // 지우는 동안: 앱 상단 내비와 브라우저 뒤로 가기를 잠그도록 알리고(App), 탭을 닫으려 하면 경고한다.
  // 중간에 화면을 벗어나면 성공·실패 안내를 못 보고, 실패했다면 어디에도 표시되지 않는다.
  useEffect(() => {
    onBusyChange?.(deleting)
    if (!deleting) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      onBusyChange?.(false)
    }
  }, [deleting, onBusyChange])

  const startConfirm = () => {
    setError('')
    setConfirmText('')
    focusTargetRef.current = 'input'
    setPhase('confirming')
  }

  const cancelConfirm = () => {
    if (deleting) return
    setError('')
    setConfirmText('')
    focusTargetRef.current = 'open-button'
    setPhase('idle')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!phraseOk || deleting) return

    setError('')
    setPhase('deleting')
    try {
      await deleteMyAccount()
    } catch (err) {
      if (err?.status === 401 && unknownOutcomeRef.current) {
        // 앞선 시도의 결과를 모르는 채로 다시 눌렀더니 로그인이 풀려 있다 → 이미 끝난 것으로 본다.
      } else if (err?.status === 401) {
        setError('로그인이 만료됐어요. 위쪽의 로그인 버튼으로 다시 로그인한 뒤 탈퇴해 주세요.')
        focusTargetRef.current = 'input'
        setPhase('confirming')
        return
      } else {
        unknownOutcomeRef.current = isUnknownOutcome(err)
        setError(failureMessage(err))
        focusTargetRef.current = 'input'
        setPhase('confirming')
        return
      }
    }
    // 완료 안내를 먼저 띄운다 — 로그아웃으로 user 가 비는 순간 로그인 안내가 번쩍 보이지 않게.
    focusTargetRef.current = 'done-heading'
    setPhase('done')
    // 이 브라우저에 남은 작업 중 코스 스냅샷도 비운다(계정 데이터는 아니지만 "모두 삭제"와 어긋나 보이지 않게).
    onDeleted?.()
    await Promise.resolve(onSignOut?.()).catch(() => null)
  }

  const handleKeyDown = (event) => {
    // 한글을 조합하는 중에 누른 Enter 는 글자를 확정하는 키다. 마지막 글자("다")를 조합하는 순간 문구가 이미 맞으므로
    // 이걸 제출로 받으면 되돌릴 수 없는 삭제가 의도 없이 시작될 수 있다.
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) {
      event.preventDefault()
      return
    }
    if (event.key === 'Escape' && phase === 'confirming') {
      event.stopPropagation()
      cancelConfirm()
    }
  }

  const rootClass = leaving ? 'account-screen is-leaving' : 'account-screen'

  if (phase === 'done') {
    return (
      <section className={rootClass}>
        <div className="account-body account-done">
          <h1 ref={doneHeadingRef} tabIndex={-1}>탈퇴가 끝났어요</h1>
          <p>
            저장한 여행과 공유한 글, 올린 사진을 삭제했어요.
            <br />
            그동안 발길따라와 함께해 주셔서 고마워요.
          </p>
          <button className="account-btn" type="button" onClick={onBack}>
            홈으로
          </button>
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <section className={rootClass}>
        <header className="dest-header">
          <button className="back-button" type="button" onClick={onBack}>← 홈으로</button>
          <h1>내 계정</h1>
        </header>
        <div className="account-body">
          <p className="account-lead">로그인하면 계정 정보를 보고 관리할 수 있어요.</p>
          <button className="account-btn" type="button" onClick={onRequireLogin}>
            로그인하기
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className={rootClass}>
      <header className="dest-header">
        <button className="back-button" type="button" onClick={onBack}>← 홈으로</button>
        <h1>내 계정</h1>
      </header>

      <div className="account-body">
        <section className="account-section" aria-labelledby="account-info-title">
          <h2 id="account-info-title">내 정보</h2>
          <dl className="account-info">
            <div>
              <dt>이름</dt>
              <dd>{user.name || '이름을 입력하지 않았어요'}</dd>
            </div>
            <div>
              <dt>이메일</dt>
              <dd>{user.email || '이메일 정보가 없어요'}</dd>
            </div>
          </dl>
          <button
            className="account-btn"
            type="button"
            onClick={async () => {
              await Promise.resolve(onSignOut?.()).catch(() => null)
              onBack()
            }}
          >
            로그아웃
          </button>
        </section>

        <section className="account-section" aria-labelledby="account-leave-title">
          <h2 id="account-leave-title">회원 탈퇴</h2>
          <p className="account-lead">탈퇴하면 아래 정보가 바로 삭제되고, 다시 되돌릴 수 없어요.</p>
          <ul className="account-removed">
            {REMOVED_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="account-note">다시 가입하더라도 지운 정보는 돌아오지 않아요.</p>

          <button
            ref={openButtonRef}
            className="account-btn account-btn--danger"
            type="button"
            onClick={() => (open ? inputRef.current?.focus() : startConfirm())}
            aria-expanded={open}
            aria-controls="account-confirm"
          >
            탈퇴하기
          </button>

          {/* 접힌 동안은 inert 로 키보드·스크린리더에서 완전히 빠진다. 높이는 grid 행으로 부드럽게 열린다. */}
          <div id="account-confirm" ref={panelRef} className="account-confirm" data-open={open} inert={!open}>
            <div className="account-confirm-clip">
              <form className="account-confirm-panel" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                <h3>정말 탈퇴할까요?</h3>
                <label id="account-confirm-label" htmlFor="account-confirm-input">
                  확인을 위해 <b>&ldquo;{CONFIRM_PHRASE}&rdquo;</b>라고 그대로 입력해 주세요.
                </label>
                <input
                  id="account-confirm-input"
                  ref={inputRef}
                  name="confirm"
                  type="text"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={deleting}
                  aria-describedby="account-messages"
                />

                {/* 항상 그려 두고 안의 글만 바꾼다. 읽을 때 새로 생긴 영역은 스크린리더가 놓치는 일이 잦다.
                    입력칸과 연결(aria-describedby)돼 있어 오류 뒤 입력칸으로 포커스가 돌아오면 함께 읽힌다. */}
                <div id="account-messages" className="account-messages" role="status">
                  {error && <p className="account-error">{error}</p>}
                  {deleting && <p className="account-progress">정보를 삭제하고 있어요. 이 화면을 닫지 말고 기다려 주세요.</p>}
                </div>

                <div className="account-actions">
                  <button className="account-btn" type="button" onClick={cancelConfirm} disabled={deleting}>
                    취소
                  </button>
                  <button
                    className="account-btn account-btn--danger-solid"
                    type="submit"
                    disabled={!phraseOk || deleting}
                    aria-describedby="account-confirm-label"
                  >
                    {deleting ? '삭제하는 중…' : '모든 정보 삭제하고 탈퇴'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
