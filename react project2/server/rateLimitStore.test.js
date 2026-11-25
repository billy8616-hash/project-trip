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

  it('Vercel 연동 이름(KV_REST_API_URL/TOKEN)도 인식한다', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example.upstash.io')
    vi.stubEnv('KV_REST_API_TOKEN', 'kvtok')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const fn = vi.fn(async () => ({ ok: true, json: async () => [{ result: 1 }, { result: 1000 }] }))
    vi.stubGlobal('fetch', fn)
    const { UpstashStore, sharedRateLimitEnabled } = await import('./rateLimitStore.js')
    expect(sharedRateLimitEnabled).toBe(true)
    await new UpstashStore('api').increment('ip')
    expect(fn.mock.calls[0][0]).toBe('https://kv.example.upstash.io/pipeline')
    expect(fn.mock.calls[0][1].headers.Authorization).toBe('Bearer kvtok')
  })

  it('URL 과 TOKEN 중 하나만 있으면 켜지 않고 경고한다', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.stubEnv('KV_REST_API_URL', '')
    vi.stubEnv('KV_REST_API_TOKEN', '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { sharedRateLimitEnabled } = await import('./rateLimitStore.js')
    expect(sharedRateLimitEnabled).toBe(false)
    expect(warn).toHaveBeenCalled()
  })

  function mockFetch(responses) {
    const calls = []
    const fn = vi.fn(async (_url, init) => {
      calls.push(JSON.parse(init.body))
      return { ok: true, json: async () => responses.shift() }
    })
    vi.stubGlobal('fetch', fn)
    return { fn, calls }
  }

  async function makeStore() {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io/')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok')
    const { UpstashStore } = await import('./rateLimitStore.js')
    const store = new UpstashStore('api')
    store.init({ windowMs: 60_000 })
    return store
  }

  it('창의 첫 요청이면 INCR · PTTL 뒤에 PEXPIRE 를 건다', async () => {
    const { fn, calls } = mockFetch([[{ result: 1 }, { result: -1 }], [{ result: 1 }]])
    const store = await makeStore()
    const before = Date.now()
    const { totalHits, resetTime } = await store.increment('1.2.3.4')

    expect(totalHits).toBe(1)
    expect(resetTime.getTime() - before).toBeGreaterThanOrEqual(59_000)
    expect(fn.mock.calls[0][0]).toBe('https://example.upstash.io/pipeline')
    expect(fn.mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
    expect(calls[0]).toEqual([['INCR', 'rl:api:1.2.3.4'], ['PTTL', 'rl:api:1.2.3.4']])
    expect(calls[1]).toEqual([['PEXPIRE', 'rl:api:1.2.3.4', 60000]])
  })

  it('창 도중의 요청은 만료를 다시 걸지 않고 남은 시간을 쓴다', async () => {
    const { fn } = mockFetch([[{ result: 7 }, { result: 42_000 }]])
    const store = await makeStore()
    const before = Date.now()
    const { totalHits, resetTime } = await store.increment('ip')

    expect(totalHits).toBe(7)
    expect(resetTime.getTime() - before).toBeGreaterThanOrEqual(41_000)
    expect(resetTime.getTime() - before).toBeLessThan(43_000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('만료 없이 남은 키(PTTL -1)는 다음 요청에서 만료를 걸어 복구한다', async () => {
    const { calls } = mockFetch([[{ result: 5 }, { result: -1 }], [{ result: 1 }]])
    const store = await makeStore()
    await store.increment('ip')
    expect(calls[1][0][0]).toBe('PEXPIRE')
  })

  it('파이프라인 안의 오류 항목도 예외로 올린다', async () => {
    mockFetch([[{ error: 'ERR boom' }]])
    const store = await makeStore()
    await expect(store.increment('ip')).rejects.toThrow(/boom/)
  })

  it('Upstash 오류는 예외로 올려 보낸다(app.js 가 통과 처리)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    const { UpstashStore } = await import('./rateLimitStore.js')
    await expect(new UpstashStore('api').increment('ip')).rejects.toThrow()
  })
})
