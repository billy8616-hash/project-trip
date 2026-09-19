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
