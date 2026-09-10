import 'dotenv/config'
import { app, assertJwtSecret } from './app.js'

// 요청을 받기 전에 토큰 시크릿부터 확인한다. 프로덕션에서 시크릿이 없거나 예시 값이면
// 여기서 던져서 서버가 아예 뜨지 않게 한다 (app.js 는 import 만으로는 검사하지 않는다).
assertJwtSecret()

// 백엔드를 프런트엔드와 분리해 독립 프로세스로 띄우고 싶을 때 사용한다.
// (개발 중에는 vite.config.js 가 이 app 을 미들웨어로 직접 마운트하므로 이 파일은 선택 사항)
const port = Number(process.env.PORT || 4000)

app.listen(port, () => {
  console.log(`Auth API server running on http://127.0.0.1:${port}`)
})
