// ─────────────────────────────────────────────────────────────
// lib/supabaseClient.js — Supabase 클라이언트 (앱 전체에서 하나만)
//
// 로그인·회원가입·소셜 로그인·세션 관리가 전부 이 객체를 거친다.
// anon 키는 브라우저에 노출되는 것이 정상이다 — 실제 접근 제어는 Supabase 의
// RLS 정책과 서버의 토큰 검증이 담당한다.
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

// 브라우저에서 쓰는 Supabase 클라이언트. 로그인/회원가입/소셜 로그인/세션 관리를 전부 이걸로 한다.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
