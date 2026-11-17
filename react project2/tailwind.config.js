/** @type {import('tailwindcss').Config} */
// ─────────────────────────────────────────────────────────────
// tailwind.config.js — Tailwind 설정 (부분 도입)
//
// Tailwind 를 전면 도입하지 않고 "코스 상세" 화면 하나에만 쓴다.
// 기존 화면은 전부 손으로 쓴 src/index.css 로 스타일링돼 있어서, 전역 도입은
// 그 화면들을 깨뜨린다. 그래서 충돌 가능성을 두 가지 방법으로 원천 차단했다.
//
//   preflight: false   Tailwind 의 전역 리셋을 끈다 → 기존 화면 스타일 그대로
//   prefix: 'tw-'      모든 유틸에 접두사 → 클래스 이름이 겹칠 수 없다
//
// 아래 theme.extend 의 색·그림자는 코스 상세 화면 전용 팔레트다.
// ─────────────────────────────────────────────────────────────

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
        // 코스 상세·커뮤니티 팔레트 (따뜻한 라이트 + 주황 액센트).
        // 앱 나머지 화면(src/styles)의 주요 버튼과 같은 계열: 채움 #F1B26F + 짙은 갈색 글자.
        cbg: '#FAF8F4',
        surface: '#FFFFFF',
        'surface-2': '#F4F1EB',
        cline: '#E7E2D8',
        cink: '#2B2A27',
        'cink-muted': '#7C766B',
        'cink-faint': '#A8A296',
        // 액센트는 용도별로 세 값: 채움(배경) / 글자·링크 / 윤곽.
        // 채움 #F1B26F 는 흰 배경 위 글자로 쓰면 대비가 1.9:1 이라, 글자·링크는 caccent-ink 를 쓴다.
        caccent: '#F1B26F',
        'caccent-soft': '#FDF1E1',
        'caccent-ink': '#9A5714', // 흰 배경 5.6:1, caccent-soft 위 5.0:1
        'caccent-edge': '#BD6D22', // 선택·주요 버튼의 윤곽
        // 노선(대중교통) 전용 파랑 — 지도 범례의 "대중교통=파랑, 도보=초록" 구분이라 색 자체가 의미다.
        croute: '#3B6EA5',
        'croute-soft': '#E8EFF7',
        cwalk: '#2F9E6E',
        'cwalk-soft': '#E7F4EE',
        cmark: '#FFE58A',
      },
      fontFamily: {
        chand: ['GriunJeong', '"Apple SD Gothic Neo"', 'cursive'],
        csans: ['"IBM Plex Sans KR"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        ccard: '0 1px 2px rgba(43,42,39,0.04), 0 6px 20px -8px rgba(43,42,39,0.12)',
        cfloat: '0 6px 24px -6px rgba(43,42,39,0.22)',
        // 종이 그림자 — src/styles/00-base.css 의 --shadow-paper(-raised)와 같은 값.
        cpaper: '0 1px 2px rgba(90,65,38,0.18), 0 3px 7px -3px rgba(90,65,38,0.16)',
        'cpaper-raised': '0 2px 4px rgba(90,65,38,0.14), 0 9px 16px -8px rgba(90,65,38,0.3)',
      },
      borderRadius: { cxl: '14px' },
    },
  },
  plugins: [],
};
