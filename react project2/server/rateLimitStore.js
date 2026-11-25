// ─────────────────────────────────────────────────────────────
// server/rateLimitStore.js — rate limit 카운터를 인스턴스끼리 공유하는 저장소 (Upstash Redis)
//
// express-rate-limit 의 기본 저장소는 프로세스 메모리다. Vercel 같은 서버리스에서는 요청이
// 여러 인스턴스로 흩어지고 인스턴스는 수시로 새로 뜨고 사라져서, IP 당 상한이 사실상 걸리지 않는다.
// 그러면 Gemini·Google 같은 유료/한도 있는 API 를 지키려던 제한이 무력해진다.
//
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 이 있으면 카운터를 Upstash 에 둔다
// (Vercel Marketplace 의 Upstash 연동이 이 이름으로 환경변수를 넣어 준다). 없으면 null 을 돌려줘
// 호출부가 기존 메모리 저장소를 그대로 쓴다 — 로컬 개발·단독 서버는 설정 없이 그대로 동작한다.
//
// 별도 패키지 없이 REST 호출(fetch)만 쓴다. 저장소가 느리거나 죽어도 서비스가 같이 죽지 않도록
// 호출은 짧게 끊고, 실패하면 그 요청은 제한 없이 통과시킨다(app.js 의 passOnStoreError).
// ─────────────────────────────────────────────────────────────

import { timeoutSignal } from './concurrency.js'

// Upstash 를 직접 만들면 UPSTASH_REDIS_REST_*, Vercel 의 Upstash/KV 연동은 KV_REST_API_* 이름으로
// 환경변수를 넣어 주는 경우가 있어 둘 다 읽는다. (둘 다 있으면 UPSTASH_ 쪽을 우선한다.)
const REST_URL = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/+$/, '')
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''

export const sharedRateLimitEnabled = Boolean(REST_URL && REST_TOKEN)

// 한쪽만 설정된 경우는 경고 없이 메모리 저장소로 돌아가기 쉬워서, 어느 쪽으로 도는지 시작할 때 한 줄 남긴다.
if (sharedRateLimitEnabled) console.log('[rate-limit] 공유 저장소(Upstash)를 사용합니다.')
else if (REST_URL || REST_TOKEN) console.warn('[rate-limit] Upstash URL 과 TOKEN 중 하나만 설정돼 메모리 저장소를 사용합니다.')
else console.log('[rate-limit] 메모리 저장소를 사용합니다 (서버리스에서는 인스턴스마다 따로 셉니다).')

async function pipeline(commands) {
  const response = await fetch(`${REST_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: timeoutSignal(1500),
  })
  if (!response.ok) throw new Error(`Upstash 응답 ${response.status}`)
  const results = await response.json()
  const failed = results.find((entry) => entry.error)
  if (failed) throw new Error(`Upstash 오류: ${failed.error}`)
  return results.map((entry) => entry.result)
}

// express-rate-limit v8 의 Store 인터페이스. 고정 창(fixed window): INCR 로 세고, 창의 첫 요청에서만 만료 시간을 건다.
export class UpstashStore {
  // prefix 로 한도마다 키를 나눈다 (예: 전체 200/분 과 course-pool 10/분 이 서로 섞이지 않게).
  constructor(prefix) {
    this.prefix = `rl:${prefix}:`
    this.windowMs = 60_000
    // 카운터가 여러 인스턴스에 걸쳐 공유됨을 라이브러리에 알린다.
    this.localKeys = false
  }

  init(options) {
    this.windowMs = options.windowMs
  }

  key(clientKey) {
    return `${this.prefix}${clientKey}`
  }

  async increment(clientKey) {
    const key = this.key(clientKey)
    const [totalHits, ttl] = await pipeline([['INCR', key], ['PTTL', key]])
    let remaining = Number(ttl)
    // 창의 첫 요청(INCR 결과 1)이거나 만료가 없는 키(PTTL -1: 만료를 걸기 전에 끊긴 경우)면 지금 만료를 건다.
    // 이미 만료가 걸린 키에는 다시 걸지 않아야 창이 요청마다 밀리지 않는다.
    // (PEXPIRE ... NX 는 Redis 7+ 에서만 되므로 쓰지 않는다 — 어느 버전에서도 같은 동작.)
    if (Number(totalHits) === 1 || !(remaining > 0)) {
      await pipeline([['PEXPIRE', key, this.windowMs]])
      remaining = this.windowMs
    }
    return { totalHits: Number(totalHits), resetTime: new Date(Date.now() + remaining) }
  }

  async decrement(clientKey) {
    await pipeline([['DECR', this.key(clientKey)]])
  }

  async resetKey(clientKey) {
    await pipeline([['DEL', this.key(clientKey)]])
  }
}
