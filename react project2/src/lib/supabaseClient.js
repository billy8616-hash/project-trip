import { createClient } from '@supabase/supabase-js'

// 브라우저에서 쓰는 Supabase 클라이언트. 로그인/회원가입/소셜 로그인/세션 관리를 전부 이걸로 한다.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
