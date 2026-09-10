/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/components/hero/AboutBlock.jsx
   [화면의 어디?]  홈 화면 아래쪽 왼편의 "소개" 글 덩어리 (제목 + 문단 + '더 보기' 버튼).
   [상태]  글만 보여 준다. '더 보기' 버튼은 아직 동작이 없다.
   [연결]  HeroSection.jsx 안에서 <AboutBlock /> 로 놓인다.
   ─────────────────────────────────────────────────────────────── */

import styles from './AboutBlock.module.css'

export default function AboutBlock() {
  return (
    <section className={styles.about} aria-label="소개">
      <h2 className={styles.head}>소개</h2>
      <p className={styles.body}>
        발길따라는 계절과 동행, 취향에 맞는 국내 여행 코스를 골라 담아 주는
        서비스입니다. 검증된 걷기 길과 명소를 이어 붙여, 고민 없이 떠날 수 있는
        하루를 만들어 드립니다.
        <button type="button" className={styles.more}>
          더 보기
        </button>
      </p>
    </section>
  )
}
