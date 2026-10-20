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
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { app } from './app.js'

// 백엔드를 프런트엔드와 분리해 독립 프로세스로 띄우고 싶을 때 사용한다.
// (개발 중에는 vite.config.js 가 이 app 을 미들웨어로 직접 마운트하므로 이 파일은 선택 사항)
const port = Number(process.env.PORT || 4000)

// 배포: `npm run build` 로 만든 dist/ 가 있으면 같은 서버가 정적 파일도 내보낸다.
// 그래서 호스팅 한 곳에 프로세스 하나(npm start)로 프런트와 API 가 같은 오리진에 뜬다.
// dist/ 가 없으면(= 백엔드만 따로 띄우는 개발 용도) 이 블록은 건너뛴다.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
if (existsSync(path.join(distDir, 'index.html'))) {
  // 해시가 붙은 assets/ 는 내용이 바뀌면 이름이 바뀌므로 오래 캐시해도 된다.
  app.use(express.static(distDir, { index: false, maxAge: '1h' }))
  // 없는 /api 경로는 index.html 이 아니라 JSON 404 로 — 안 그러면 API 오타가 HTML 200 으로 위장된다.
  app.use('/api', (_req, res) => res.status(404).json({ message: '없는 API 경로예요.' }))
  // 화면 전환이 URL 이 아니라 상태라 사실상 / 하나뿐이지만, 새로고침·직접 진입을 위해 SPA 폴백을 둔다.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    return res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`발길따라 서버 실행 중 — http://127.0.0.1:${port}${existsSync(distDir) ? ' (dist 서빙 포함)' : ''}`)
})
