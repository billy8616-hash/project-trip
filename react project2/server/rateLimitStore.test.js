import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('UpstashStore', () => {
  it('환경변수가 없으면 공유 저장소를 켜지 않는다', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    const { sharedRateLimitEnabled } = await import('./rateLimitStore.js')
    expect(sharedRateLimitEnabled).toBe(false)
  })

  it('INCR · PEXPIRE NX · PTTL 을 한 번에 보내고 totalHits/resetTime 을 돌려준다', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io/')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok')
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [{ result: 3 }, { result: 0 }, { result: 42_000 }] }))
    vi.stubGlobal('fetch', fetchMock)

    const { UpstashStore, sharedRateLimitEnabled } = await import('./rateLimitStore.js')
    expect(sharedRateLimitEnabled).toBe(true)

    const store = new UpstashStore('api')
    store.init({ windowMs: 60_000 })
    const before = Date.now()
    const { totalHits, resetTime } = await store.increment('1.2.3.4')

    expect(totalHits).toBe(3)
    expect(resetTime.getTime() - before).toBeGreaterThanOrEqual(41_000)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.upstash.io/pipeline')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual([
      ['INCR', 'rl:api:1.2.3.4'],
      ['PEXPIRE', 'rl:api:1.2.3.4', 60000, 'NX'],
      ['PTTL', 'rl:api:1.2.3.4'],
    ])
  })

  it('Upstash 오류는 예외로 올려 보낸다(app.js 가 통과 처리)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    const { UpstashStore } = await import('./rateLimitStore.js')
    await expect(new UpstashStore('api').increment('ip')).rejects.toThrow()
  })
})
