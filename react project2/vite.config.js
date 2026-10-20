// ─────────────────────────────────────────────────────────────
// vite.config.js — 개발 서버 · 빌드 설정
//
// 이 파일에서 설명할 만한 부분은 "개발 중에는 프로세스가 하나"라는 점이다.
// Express 백엔드를 Vite 개발 서버의 미들웨어로 직접 얹어서, npm run dev 한 번이면
// 프런트와 API 가 같은 포트(5173)에 함께 뜬다. 터미널 두 개를 띄울 필요가 없다.
//
// 그러면서도 배포 빌드에는 서버 코드가 섞이지 않는다 — configureServer 는
// `vite dev` 에서만 실행되고, 그 안에서 동적 import 로 서버를 불러오기 때문이다.
// `vite build` 는 그 코드를 아예 거치지 않는다.
// ─────────────────────────────────────────────────────────────

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // 5173 고정 — 카카오 디벨로퍼스/CLIENT_ORIGIN 이 이 포트를 전제로 설정돼 있어서,
    // 이미 사용 중이면 다른 포트로 조용히 넘어가는 대신 에러를 내야 한다
    // (그래야 지도/로그인이 "됐다 안 됐다" 하는 대신 원인이 바로 보인다).
    port: 5173,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      output: {
        // 한 덩어리(666KB)로 나가던 번들을 라이브러리별로 나눈다. 앱 코드가 바뀌어도
        // vendor 청크는 해시가 그대로라 브라우저 캐시를 재사용한다.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'map', test: /node_modules[\\/](react-simple-maps|d3-[^\\/]+|topojson-client|internmap|delaunator)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    {
      // 회원가입/로그인 API(Express)를 Vite 개발 서버에 직접 얹는다.
      // 덕분에 `npm run dev` 한 번이면 프런트와 인증 API 가 같은 포트에서 함께 뜬다.
      // (별도 백엔드 프로세스를 쓰고 싶으면 `npm run server` 로 4000 포트에 따로 띄울 수도 있다.)
      name: 'auth-api-middleware',
      // configureServer 는 `vite dev` 에서만 실행된다. Express/Prisma 는 여기서 동적으로만
      // 불러와서, `vite build`(배포 빌드) 는 서버 코드를 전혀 끌어오지 않게 한다.
      async configureServer(server) {
        const { app: authApi } = await import('./server/app.js')
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api/')) authApi(req, res, next)
          else next()
        })
      },
    },
  ],
})
