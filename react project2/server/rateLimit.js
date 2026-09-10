// 로그인 브루트포스/자원 고갈 방어용 인메모리 시도 카운터.
//
// 프로세스 메모리에만 쌓이므로 서버를 재시작하면 초기화되고, 서버를 여러 대로 늘리면
// 인스턴스마다 따로 센다. 지금처럼 단일 서버로 돌릴 때를 전제로 한 구현이고,
// 다중 인스턴스로 가면 Redis 같은 공유 저장소로 옮겨야 한다.

// 키가 무한히 쌓이지 않도록, 이 수를 넘으면 만료된 항목부터 청소한다.
const MAX_KEYS = 10000

/**
 * windowMs 안에 max 번을 넘겨 시도하면 blockMs 동안 잠근다.
 * check() 로 잠금 여부만 보고, hit() 로 시도를 기록하고, reset() 으로 푼다.
 */
export function createRateLimiter({ windowMs, max, blockMs }) {
  const entries = new Map() // key -> { count, windowStart, blockedUntil }

  function prune(now) {
    if (entries.size < MAX_KEYS) return
    for (const [key, entry] of entries) {
      const unblocked = entry.blockedUntil <= now
      const windowExpired = now - entry.windowStart > windowMs
      if (unblocked && windowExpired) entries.delete(key)
    }
  }

  return {
    // 이 키가 지금 잠겨 있는지. 잠겨 있으면 남은 시간(초)을 함께 준다.
    check(key, now = Date.now()) {
      const entry = entries.get(key)
      if (entry && entry.blockedUntil > now) {
        return { allowed: false, retryAfterSec: Math.ceil((entry.blockedUntil - now) / 1000) }
      }
      return { allowed: true, retryAfterSec: 0 }
    },

    // 시도 1회를 기록한다. 창 안에서 max 를 넘기면 그 자리에서 잠근다.
    hit(key, now = Date.now()) {
      prune(now)

      let entry = entries.get(key)
      if (!entry || now - entry.windowStart > windowMs) {
        entry = { count: 0, windowStart: now, blockedUntil: 0 }
        entries.set(key, entry)
      }

      entry.count += 1
      if (entry.count > max) {
        entry.blockedUntil = now + blockMs
        return { allowed: false, retryAfterSec: Math.ceil(blockMs / 1000) }
      }
      return { allowed: true, retryAfterSec: 0 }
    },

    // 로그인 성공처럼 "정상 사용자였다"가 확인되면 카운터를 지운다.
    reset(key) {
      entries.delete(key)
    },
  }
}
