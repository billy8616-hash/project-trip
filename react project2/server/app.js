// ═════════════════════════════════════════════════════════════
// server/app.js — 백엔드 조립 지점 (Express 앱 생성 + 미들웨어 + 라우트 마운트)
//
// 이 서버가 존재하는 이유는 두 가지다.
//
//  1) 외부 API 키를 브라우저에서 숨기기
//     TourAPI·카카오 REST·Google·Gemini·ODsay·Tmap·OpenWeather·네이버 키는
//     전부 여기에만 있다. 브라우저는 우리 서버에만 요청하고, 서버가 대신 외부를 부른다.
//     (브라우저에 나가는 키는 카카오맵 JS 키와 Supabase anon 키뿐 — 둘 다 공개 전제 키다)
//
//  2) 외부 API 호출 결과를 캐시해 비용·시간을 줄이기
//     도시 하나의 장소 풀을 만들려면 API 대여섯 개를 거친다. 그 결과를 DB 에 모아 두고
//     stale-while-revalidate 로 응답한다 → 두 번째 조회부터는 외부 호출이 0회.
//
// 실제 라우트는 여기 없다 — server/routes/*.js 로 도메인별로 나눠 두고, 이 파일은
// 그걸 순서대로 app.use() 로 붙이기만 한다. 인증(requireAuth/optionalAuth)은
// server/authMiddleware.js 하나를 여러 라우트 파일이 같이 가져다 쓴다.
//
//   server/routes/profile.js      /api/profile              (requireAuth)
//   server/routes/trips.js        /api/trips                (requireAuth)
//   server/routes/community.js    /api/community             (읽기 optionalAuth · 쓰기 requireAuth)
//   server/routes/directions.js   /api/directions/*          (인증 없음, 길찾기 프록시)
//   server/routes/coursePool.js   /api/course-pool           (인증 없음, 장소 풀 생성·캐싱)
//   server/routes/misc.js         그 밖의 프록시(사진·썸네일·트렌드·날씨·지오코딩·주차장)
//
// 인증은 세션이나 쿠키가 아니라 Supabase 액세스 토큰으로 한다.
// 요청 헤더의 토큰을 Supabase 에 물어 진짜인지 확인하고(authMiddleware.js),
// 확인된 사용자 id 를 req.userId 에 담아 각 라우트가 쓴다.
// ═════════════════════════════════════════════════════════════

import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { router as profileRoutes } from './routes/profile.js'
import { router as tripsRoutes } from './routes/trips.js'
import { router as communityRoutes } from './routes/community.js'
import { router as directionsRoutes } from './routes/directions.js'
import { router as coursePoolRoutes } from './routes/coursePool.js'
import { router as miscRoutes } from './routes/misc.js'

// 로컬 개발에서 브라우저가 localhost 로 접속하든 127.0.0.1 로 접속하든 허용되도록
// 콤마로 구분된 여러 오리진을 받는다.
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export const app = express()

// 프록시(nginx, 클라우드 로드밸런서) 뒤에 두면 req.ip 가 프록시 주소로 잡혀
// 모든 사용자가 한 IP 로 묶인다. 그럴 땐 TRUST_PROXY 를 켜서 X-Forwarded-For 를 신뢰하게 한다.
// 기본값은 끔 — 잘못 켜면 클라이언트가 IP를 위조해 rate limit 을 우회할 수 있다.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY)
}

app.use(express.json())
app.use(cors({
  origin: clientOrigins,
  credentials: true,
}))

app.use(profileRoutes)
app.use(tripsRoutes)
app.use(communityRoutes)
app.use(directionsRoutes)
app.use(coursePoolRoutes)
app.use(miscRoutes)

// prewarm 스크립트가 캐시를 미리 채울 때 직접 부른다 — 라우트를 안 거치고 함수만 재사용.
export { buildCityPoolRows } from './routes/coursePool.js'
