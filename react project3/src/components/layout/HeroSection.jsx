/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/components/layout/HeroSection.jsx
   [화면의 어디?]  홈 화면 "전체". 브라우저를 열면 처음 보이는 큰 사진 화면이다.
   [화면 구성 (뒤에서 앞으로 겹쳐짐)]
     1. 배경 사진            (.photo)
     2. 사진 위 어두운 막     (.overlay)  ← 글씨가 잘 보이도록
     3. 그 위의 실제 내용:
          · 상단 메뉴 바        → GlassNav.jsx
          · 왼쪽 세로 SNS 아이콘 → SocialRail.jsx
          · 검색창             → SearchBar.jsx
          · 가운데: 평소엔 큰 문구 + '코스 둘러보기' 버튼,
                   위저드를 열면 그 자리에서 3단계 선택 슬라이드 → HeroWizard.jsx
          · 아래쪽 소개 글      → AboutBlock.jsx
     4. 상황에 따라 위에 뜨는 창:
          · 로그인 창          → LoginModal.jsx
   [연결]  App.jsx 가 이 파일을 불러온다. 이 파일은 위 여러 조각들을 불러와 조립한다.
   ─────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from 'react'
import GlassNav from './GlassNav.jsx'
import SearchBar from '../hero/SearchBar.jsx'
import AboutBlock from '../hero/AboutBlock.jsx'
import SocialRail from '../hero/SocialRail.jsx'
import HeroWizard from '../hero/HeroWizard.jsx'
import LoginModal from '../../auth/LoginModal.jsx'
import { getSession, logout } from '../../auth/authApi.js' // 서버에 로그인 상태를 묻고/로그아웃한다
import { openSignupWindow } from '../../auth/openSignup.js' // 회원가입 팝업 창을 연다
import styles from './HeroSection.module.css' // 이 화면의 디자인(색·위치·크기)

// { onOpenCourse } → App.jsx 가 넘겨준 함수. 사용자가 코스를 고르면 이 함수를 불러 상세 화면으로 넘어간다.
export default function HeroSection({ onOpenCourse }) {
  // ── 이 화면이 기억하는 값 ──
  const [session, setSession] = useState(null) // 로그인한 사용자 정보 (없으면 null = 로그아웃 상태)
  const [loginOpen, setLoginOpen] = useState(false) // 로그인 창이 열려 있는가?
  // wizardOpen  : 슬라이드가 위저드 쪽(-100%)으로 가 있는가 (애니메이션 목표 위치)
  // wizardMounted: 위저드를 실제로 그려 두는가 (슬라이드가 끝나 되돌아오면 떼어낸다)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMounted, setWizardMounted] = useState(false)

  // '여행지' / '테마 코스' / '코스 둘러보기' → 위저드를 먼저 붙인 뒤 한 박자 늦게 슬라이드시킨다.
  // (붙자마자 -100% 로 옮기면 시작 프레임이 없어 미끄러지지 않고 툭 나타난다)
  const openWizard = () => {
    setWizardMounted(true)
    window.setTimeout(() => setWizardOpen(true), 20)
  }
  // 슬라이드가 문구 쪽(0%)으로 되돌아오는 전환이 끝나면 위저드를 떼어낸다.
  // (위저드 내부 전환이 버블링돼 올라오는 건 무시하고, 트랙 자신의 transform 전환만 본다)
  const handleSlideEnd = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    if (!wizardOpen) setWizardMounted(false)
  }

  // useEffect: 이 화면이 처음 나타날 때 딱 한 번 실행되는 코드 (맨 아래 [] 가 "처음 한 번만"이라는 뜻)
  useEffect(() => {
    let alive = true // 화면이 사라진 뒤 늦게 온 응답을 무시하기 위한 표시
    // 서버에 "지금 로그인돼 있어?" 라고 물어서 session 에 저장한다.
    const refresh = () => getSession().then((user) => alive && setSession(user))
    refresh() // 처음에 한 번 물어보고,
    window.addEventListener('focus', refresh) // 다른 창 갔다가 이 창으로 돌아올 때도 다시 물어본다
    // 아래 return 함수는 이 화면이 사라질 때 뒷정리(이벤트 해제)를 한다.
    return () => {
      alive = false
      window.removeEventListener('focus', refresh)
    }
  }, [])

  // '로그아웃' 버튼을 눌렀을 때: 서버에 로그아웃 요청 → session 을 비운다.
  const handleLogout = useCallback(async () => {
    await logout()
    setSession(null)
  }, [])

  // 아래 return 안의 내용이 실제로 화면에 그려진다. (HTML 처럼 생겼지만 JSX 라고 부른다)
  return (
    <div className={styles.hero}>
      {/* 배경 사진, 그 위 어두운 막. aria-hidden = 화면 낭독기에는 읽히지 않는 장식용 */}
      <div className={styles.photo} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true" />

      {/* 상단 메뉴 바. '여행지' / '테마 코스' 를 누르면 가운데 위저드를 연다 */}
      <GlassNav
        session={session} // 로그인 정보 (있으면 닉네임/로그아웃, 없으면 로그인/회원가입 버튼 표시)
        onLoginClick={() => setLoginOpen(true)} // '로그인' 클릭 → 로그인 창 열기
        onSignupClick={openSignupWindow} // '회원가입' 클릭 → 팝업 창 열기
        onLogout={handleLogout} // '로그아웃' 클릭
        onStartWizard={openWizard} // '여행지' / '테마 코스' 클릭 → 3단계 위저드로 슬라이드
      />
      <SocialRail /> {/* 왼쪽 세로 SNS 아이콘 줄 */}

      <div className={styles.inner}>
        <SearchBar /> {/* 검색창 (지금은 모양만 있고 실제 검색은 아직 없음) */}

        {/* 가운데 무대: 왼쪽(문구) ↔ 오른쪽(위저드) 두 칸짜리 가로 슬라이드.
            '여행지' 등을 누르면 트랙이 -100% 로 밀려 문구가 왼쪽으로 빠지고 위저드가 오른쪽에서 들어온다. */}
        <div className={styles.stage}>
          <div className={styles.slider}>
            <div
              className={styles.slideTrack}
              style={{ transform: wizardOpen ? 'translateX(-100%)' : 'translateX(0)' }}
              onTransitionEnd={handleSlideEnd}
            >
              {/* 왼쪽 칸: 평소 메인 문구 + '코스 둘러보기' 버튼 */}
              <div className={styles.slide}>
                <div className={styles.copy} aria-hidden={wizardOpen}>
                  <p className={styles.kicker}>국내 여행 코스</p>
                  <h1 className={styles.title}>
                    <span>발길 닿는 대로,</span>
                    <span className={styles.titleEm}>오늘의 여행</span>
                  </h1>

                  <button
                    type="button"
                    className={styles.cta}
                    onClick={openWizard}
                  >
                    코스 둘러보기
                  </button>
                </div>
              </div>

              {/* 오른쪽 칸: 3단계 선택 위저드 (열려 있을 때만 그린다) */}
              <div className={styles.slide}>
                {wizardMounted && (
                  <HeroWizard
                    onExit={() => setWizardOpen(false)} // 닫기 / 1단계 '이전' → 문구 쪽으로 슬라이드
                    onOpenCourse={onOpenCourse} // 결과 카드 클릭 → 코스 상세 화면으로
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <AboutBlock /> {/* 화면 아래쪽 '소개' 글 */}
      </div>

      {/* loginOpen 이 true 일 때만 로그인 창을 화면에 띄운다. ( {조건 && <컴포넌트/>} 패턴 ) */}
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)} // 창 닫기
          onSuccess={(user) => {
            setSession(user) // 로그인 성공 → 사용자 정보 저장
            setLoginOpen(false) // 창 닫기
          }}
        />
      )}
    </div>
  )
}
