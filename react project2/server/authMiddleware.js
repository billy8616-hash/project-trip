// ─────────────────────────────────────────────────────────────
// server/authMiddleware.js — 인증 미들웨어
//
// 이 서버는 로그인 상태를 스스로 기억하지 않는다. 요청마다 Authorization 헤더의
// Supabase 액세스 토큰을 Supabase 에 물어보는 방식이라, 서버를 여러 대로 늘려도
// 세션 공유 문제가 생기지 않는다.
//
// requireAuth   토큰이 없거나 유효하지 않으면 401 (프로필·내 여행·커뮤니티 쓰기)
// optionalAuth  로그인했으면 req.userId 를 채우고, 아니면 그냥 통과 (커뮤니티 읽기 —
//               비로그인도 볼 수 있지만, 내가 추천했는지 같은 건 알아야 채워 줄 수 있다)
//
// 쓰는 곳: server/routes/*.js
// ─────────────────────────────────────────────────────────────

import { getSupabaseAdmin } from './supabaseAdmin.js'
import { getProfile } from './profileStore.js'

// Authorization: Bearer <supabase access token> 헤더에서 토큰을 꺼낸다.
function bearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null
}

// 토큰을 Supabase 로 검증해 auth 유저를 돌려준다. 유효하지 않으면 null.
async function verifySupabaseToken(token) {
  if (!token) return null
  const { data, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

// 액세스 토큰을 검증하고 req.authUser / req.userId / req.userName 을 채운다. 실패하면 401.
export async function requireAuth(req, res, next) {
  const authUser = await verifySupabaseToken(bearerToken(req))
  if (!authUser) return res.status(401).json({ message: '로그인이 필요해요.' })
  const profile = await getProfile(authUser.id)
  req.authUser = authUser
  req.userId = authUser.id
  req.userName = profile?.name || null
  return next()
}

// 로그인했으면 req.userId / req.userName 을 채우고, 아니면 그냥 통과시킨다.
export async function optionalAuth(req, _res, next) {
  const authUser = await verifySupabaseToken(bearerToken(req))
  const profile = authUser ? await getProfile(authUser.id) : null
  req.authUser = authUser
  req.userId = authUser ? authUser.id : null
  req.userName = profile?.name || null
  return next()
}
