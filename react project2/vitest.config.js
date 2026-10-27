// ─────────────────────────────────────────────────────────────
// vitest.config.js — 테스트 설정
//
// vite.config.js 를 일부러 따로 뒀다. 거기엔 개발 서버에 Express(+Prisma)를 얹는
// 플러그인이 있는데, Vitest 가 그 설정을 읽으면 테스트마다 서버 코드가 딸려 올라온다.
// 지금 테스트 대상은 src/lib 와 server 의 순수 함수뿐이라 DB·네트워크가 필요 없다
// (server 쪽은 DB 를 안 건드리는 파일만 테스트한다 — 예: courseDraftShape.js).
// ─────────────────────────────────────────────────────────────

import { defineConfig } from 'vitest/config'

// 날짜 테스트가 실행하는 컴퓨터의 시간대에 좌우되지 않도록 한국 시간으로 고정한다.
// (여행 날짜가 하루 어긋나던 버그가 UTC+9 에서만 드러났기 때문이다.)
process.env.TZ = 'Asia/Seoul'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'server/**/*.test.js'],
  },
})
