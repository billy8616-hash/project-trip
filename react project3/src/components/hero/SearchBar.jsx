/* ───────────────────────────────────────────────────────────────
   [파일 위치] src/components/hero/SearchBar.jsx
   [화면의 어디?]  홈 화면 위쪽의 "둥근 반투명 검색창" (돋보기 아이콘 + 입력칸).
   [상태]  지금은 모양만 있다. 글자를 입력하고 엔터를 눌러도 아무 일도 일어나지 않는다.
           (onSubmit 에서 e.preventDefault() 로 '새로고침'만 막아 둔 상태)
   [연결]  HeroSection.jsx 안에서 <SearchBar /> 로 놓인다.
   ─────────────────────────────────────────────────────────────── */

import styles from './SearchBar.module.css'

export default function SearchBar() {
  return (
    <form
      className={styles.bar}
      role="search"
      onSubmit={(e) => e.preventDefault()} // 엔터 시 페이지가 새로고침되는 기본 동작만 막는다
    >
      {/* 돋보기 아이콘 (그림). svg 는 코드로 그린 그림이라고 생각하면 된다 */}
      <svg
        className={styles.icon}
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="m13 13 3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>

      {/* 실제 글자를 입력하는 칸. placeholder = 비어 있을 때 흐리게 보이는 안내 문구 */}
      <input
        className={styles.input}
        type="search"
        placeholder="가고 싶은 여행지나 코스를 검색해 보세요"
        aria-label="여행지 검색"
      />
    </form>
  )
}
