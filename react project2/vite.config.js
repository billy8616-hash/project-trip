import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { app as authApi } from './server/app.js'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // 5173 고정 — 카카오 디벨로퍼스/CLIENT_ORIGIN 이 이 포트를 전제로 설정돼 있어서,
    // 이미 사용 중이면 다른 포트로 조용히 넘어가는 대신 에러를 내야 한다
    // (그래야 지도/로그인이 "됐다 안 됐다" 하는 대신 원인이 바로 보인다).
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    {
      // 회원가입/로그인 API(Express)를 Vite 개발 서버에 직접 얹는다.
      // 덕분에 `npm run dev` 한 번이면 프런트와 인증 API 가 같은 포트에서 함께 뜬다.
      // (별도 백엔드 프로세스를 쓰고 싶으면 `npm run server` 로 4000 포트에 따로 띄울 수도 있다.)
      name: 'auth-api-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api/')) authApi(req, res, next)
          else next()
        })
      },
    },
  ],
})
