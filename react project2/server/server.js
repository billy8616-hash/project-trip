// ─────────────────────────────────────────────────────────────
// server/server.js — 백엔드를 따로 띄우는 진입점 (선택 사항)
//
// 개발 중에는 이 파일을 쓰지 않는다. vite.config.js 가 Express 앱을 Vite 개발
// 서버의 미들웨어로 직접 마운트하기 때문에, npm run dev 한 번이면 프런트와 API 가
// 같은 포트(5173)에 함께 뜬다.
//
// 이 파일은 백엔드만 독립 프로세스로 돌리고 싶을 때(npm run server, 4000 포트) 쓴다.
// ─────────────────────────────────────────────────────────────

import 'dotenv/config'
import { app } from './app.js'

// 백엔드를 프런트엔드와 분리해 독립 프로세스로 띄우고 싶을 때 사용한다.
// (개발 중에는 vite.config.js 가 이 app 을 미들웨어로 직접 마운트하므로 이 파일은 선택 사항)
const port = Number(process.env.PORT || 4000)

app.listen(port, () => {
  console.log(`Auth API server running on http://127.0.0.1:${port}`)
})
