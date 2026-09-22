// ─────────────────────────────────────────────────────────────
// postcss.config.js — CSS 후처리
//
// tailwindcss 가 유틸 클래스를 생성하고, autoprefixer 가 브라우저별 접두사
// (-webkit- 등)를 자동으로 붙인다. Vite 가 CSS 를 처리할 때 이 설정을 읽는다.
// ─────────────────────────────────────────────────────────────

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
