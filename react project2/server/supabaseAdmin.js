// ─────────────────────────────────────────────────────────────
// server/supabaseAdmin.js — 서버 전용 Supabase 클라이언트
//
// 브라우저용(src/lib/supabaseClient.js)과 키가 다르다. 이쪽은 service role 키라
// 모든 권한을 갖는다 — 절대 프런트로 나가면 안 된다.
//
// 용도는 하나뿐이다: 요청 헤더로 들어온 액세스 토큰이 진짜인지 확인하는 것
// (auth.getUser). 그 검증이 server/app.js 의 requireAuth 미들웨어다.
//
// 클라이언트를 처음 쓸 때 만들고 재사용한다 — 키가 없는 환경에서 서버가
// 시작조차 못 하는 일을 막기 위해 모듈 로드 시점이 아니라 호출 시점에 만든다.
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

// service role 키를 쓰는 서버 전용 클라이언트. Authorization 헤더로 받은 액세스 토큰을
// 검증(auth.getUser)하는 용도로만 쓴다 — 절대 프런트로 노출하면 안 된다.
const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let cachedClient = null

export function getSupabaseAdmin() {
  if (cachedClient) return cachedClient

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요. .env.example을 참고해 .env에 설정해주세요.',
    )
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cachedClient
}
