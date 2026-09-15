/** @type {import('tailwindcss').Config} */
// 이 프로젝트는 기존 화면 전체가 손으로 쓴 src/index.css 로 스타일링돼 있다.
// Tailwind 는 "코스 상세" 새 화면 하나에만 쓰므로, 기존 화면과 절대 안 부딪히도록:
//   1) preflight(전역 리셋)를 끈다  → 다른 화면 스타일 그대로 유지
//   2) 모든 유틸 클래스에 `tw-` 접두사를 붙인다  → 클래스 이름 충돌 원천 차단
// 새 화면에 필요한 최소 리셋은 index.css 의 `.course-detail-root` 스코프 블록에 따로 넣었다.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  prefix: 'tw-',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        // 코스 상세 화면 팔레트 (따뜻한 라이트 + 파랑 액센트 하나)
        cbg: '#FAF8F4',
        surface: '#FFFFFF',
        'surface-2': '#F4F1EB',
        cline: '#E7E2D8',
        cink: '#2B2A27',
        'cink-muted': '#7C766B',
        'cink-faint': '#A8A296',
        caccent: '#2563C9',
        'caccent-soft': '#EAF0FC',
        cwalk: '#2F9E6E',
        'cwalk-soft': '#E7F4EE',
        cmark: '#FFE58A',
      },
      fontFamily: {
        chand: ['Gaegu', '"Apple SD Gothic Neo"', 'cursive'],
        csans: ['"IBM Plex Sans KR"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        ccard: '0 1px 2px rgba(43,42,39,0.04), 0 6px 20px -8px rgba(43,42,39,0.12)',
        cfloat: '0 6px 24px -6px rgba(43,42,39,0.22)',
      },
      borderRadius: { cxl: '14px' },
    },
  },
  plugins: [],
};
