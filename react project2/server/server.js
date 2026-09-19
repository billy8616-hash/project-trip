import 'dotenv/config'
import { app } from './app.js'

// 백엔드를 프런트엔드와 분리해 독립 프로세스로 띄우고 싶을 때 사용한다.
// (개발 중에는 vite.config.js 가 이 app 을 미들웨어로 직접 마운트하므로 이 파일은 선택 사항)
const port = Number(process.env.PORT || 4000)

app.listen(port, () => {
  console.log(`Auth API server running on http://127.0.0.1:${port}`)
})
