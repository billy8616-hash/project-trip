// ─────────────────────────────────────────────────────────────
// api/index.js — Vercel 배포용 백엔드 진입점
//
// Vercel 에서는 app.listen() 으로 서버를 띄우지 않는다. api/ 폴더의 파일이 함수가 되고,
// vercel.json 이 /api/* 요청을 전부 이 함수로 보낸다. Express 앱은 그 자체로
// (req, res) 핸들러라 server/app.js 를 그대로 내보내면 된다.
//
// 이 파일이 react project2/ 안이 아니라 저장소 맨 위에 있는 이유: Vercel 은 함수 이름을
// 경로로 짓는데 공백이 들어가면 배포를 거부한다("react project2/api/index.js").
// 저장소 맨 위에 두면 함수 이름이 api/index.mjs 가 된다. (package.json 이 없는 위치라
// ESM 으로 읽히도록 .mjs 를 쓴다.)
// 로컬 개발은 여전히 vite.config.js(npm run dev), 단독 서버는 server/server.js 를 쓴다.
// ─────────────────────────────────────────────────────────────

import { app } from '../react project2/server/app.js'

// Vercel 은 X-Forwarded-For 를 실제 접속 IP 로 덮어써서 위조할 수 없다.
// 이걸 안 켜면 모든 사용자가 Vercel 내부 주소 하나로 묶여 rate limit 을 같이 쓰게 된다.
app.set('trust proxy', 1)

// 없는 /api 경로는 Express 기본 HTML 대신 JSON 404 로 (react project2/server/server.js 와 같은 동작)
app.use('/api', (_req, res) => res.status(404).json({ message: '없는 API 경로예요.' }))

export default app
