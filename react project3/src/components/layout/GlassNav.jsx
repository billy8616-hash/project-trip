/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/components/layout/GlassNav.jsx
   [화면의 어디?]  홈 화면 맨 위의 "반투명 유리 느낌 메뉴 바".
   [구성]
     · 왼쪽 : 신발 로고 + '발길따라' 이름
     · 가운데: 여행지 / 테마 코스 / 동행 유형 / 시즌 메뉴
              - '여행지', '테마 코스' 는 누르면 가운데 3단계 선택 위저드가 열린다 → HeroWizard.jsx
              - '동행 유형', '시즌' 은 지금은 모양만 있는 장식용 메뉴
     · 오른쪽: 로그인 상태면 "OOO님 / 로그아웃",
              아니면 "회원가입 / 로그인" 버튼. 좁은 화면에서는 햄버거(≡) 아이콘.
   [연결]  HeroSection.jsx 가 이 파일을 불러온다.
           '여행지' / '테마 코스' 를 누르면 HeroSection 이 넘겨준 onStartWizard 를 호출한다.
   [메모]  아래 Caret, ShoeLogo 는 이 파일 안에서만 쓰는 작은 그림(아이콘) 조각이다.
   ─────────────────────────────────────────────────────────────── */

import styles from './GlassNav.module.css'

/* 메뉴 이름 옆 작은 장식용 화살표 (▾) */
function Caret() {
  return (
    <svg
      className={styles.caret}
      width="10"
      height="7"
      viewBox="0 0 10 7"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 1.5 5 5.5 9 1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* 신발(운동화) 로고 */
function ShoeLogo() {
  return (
    <svg width="26" height="22" viewBox="0 0 26 22" fill="none" aria-hidden="true">
      <path
        d="M2 12c0-1.4.9-2.3 2.5-2.7l4-1 2.2-3.5c.4-.6 1.2-.8 1.9-.4.7.4 1 1.2.7 1.9l3.1 1.1c2.7.1 5 .9 6.6 2.6 1.1 1.1 1.7 2.5 1.8 4.1.1 1-.7 1.9-1.7 1.9H4c-1.1 0-2-.9-2-2V12Z"
        fill="currentColor"
      />
      <path d="M3 18.6h19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// '여행지', '테마 코스' 는 위저드를 연다. 나머지는 아직 동작 없는 장식용.
const WIZARD_MENU = ['여행지', '테마 코스']
const PLAIN_MENU = ['동행 유형', '시즌']

/**
 * 상단 글래스모피즘 내비게이션.
 *
 * @param {{
 *   session: {username:string, nickname:string} | null,
 *   onLoginClick: () => void,
 *   onSignupClick: () => void,
 *   onLogout: () => void,
 *   onStartWizard: () => void,
 * }} props
 */
export default function GlassNav({
  session, // 로그인 정보 (없으면 null)
  onLoginClick, // '로그인' 버튼을 눌렀을 때 실행할 함수
  onSignupClick, // '회원가입' 버튼을 눌렀을 때
  onLogout, // '로그아웃' 버튼을 눌렀을 때
  onStartWizard, // '여행지' / '테마 코스' 를 눌렀을 때 → 가운데 3단계 위저드 열기
}) {
  return (
    <header className={styles.nav}>
      {/* ── 왼쪽: 로고 + 서비스 이름 ── */}
      <a className={styles.brand} href="#home">
        <ShoeLogo />
        <span className={styles.brandName}>발길따라</span>
      </a>

      {/* ── 가운데: 메뉴 묶음 ── */}
      <nav className={styles.pill}>
        {/* '여행지', '테마 코스' : 누르면 가운데 문구 자리에서 3단계 선택 위저드가 슬라이드로 열린다 */}
        {WIZARD_MENU.map((label) => (
          <button
            key={label}
            type="button"
            className={styles.item}
            onClick={onStartWizard}
          >
            {label}
            <Caret />
          </button>
        ))}

        {/* '동행 유형', '시즌' : 아직 동작 없음(장식) */}
        {PLAIN_MENU.map((label) => (
          <button key={label} type="button" className={styles.item}>
            {label}
            <Caret />
          </button>
        ))}
      </nav>

      {/* ── 오른쪽: 로그인 상태에 따라 다르게 보인다 ── */}
      <div className={styles.right}>
        {session ? (
          // 로그인돼 있으면: 닉네임 + 로그아웃 버튼
          <>
            <span className={styles.hello}>{session.nickname}님</span>
            <button type="button" className={styles.ghost} onClick={onLogout}>
              로그아웃
            </button>
          </>
        ) : (
          // 로그아웃 상태면: 회원가입 / 로그인 버튼
          <>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={onSignupClick}
            >
              회원가입
            </button>
            <button
              type="button"
              className={styles.loginBtn}
              onClick={onLoginClick}
            >
              로그인
            </button>
          </>
        )}

        {/* 좁은 화면(모바일)에서 보이는 햄버거(≡) 버튼. 지금은 모양만 있음 */}
        <button type="button" className={styles.burger} aria-label="메뉴 열기">
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  )
}
