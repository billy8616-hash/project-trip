// ─────────────────────────────────────────────────────────────
// server/background.js — 응답을 보낸 뒤에도 이어서 돌려야 하는 작업을 등록한다
//
// 일반 서버(npm start, 로컬 개발)는 응답을 보내도 프로세스가 계속 떠 있어서 그냥 Promise 를
// 놔두면 끝까지 돈다. 하지만 Vercel 같은 서버리스에서는 응답이 나가는 순간 함수가 동결돼
// 그 뒤의 작업(도시 풀 7일 갱신, 사진 보강)이 중간에 멈추거나 영영 시작되지 않는다.
// waitUntil 로 등록해 두면 Vercel 이 그 작업이 끝날 때까지 함수를 살려 둔다.
//
// Vercel 이 아닌 곳에서는 waitUntil 이 아무 일도 하지 않으므로 같은 코드가 어디서든 안전하다.
// ─────────────────────────────────────────────────────────────

import { waitUntil } from '@vercel/functions'

// promise 는 호출한 쪽에서 이미 catch 를 달아 둔 것이어야 한다(실패가 unhandled rejection 이 되지 않게).
export function keepAlive(promise) {
  try {
    waitUntil(promise)
  } catch (error) {
    console.warn(`[background] waitUntil 등록 실패 — 그냥 이어서 실행합니다: ${error.message}`)
  }
  return promise
}
