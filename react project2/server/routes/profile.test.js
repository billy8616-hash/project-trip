import express from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  deleteUserRecords: vi.fn(),
  deleteUserPhotos: vi.fn(),
  deleteAuthUser: vi.fn(),
  calls: [],
}))

vi.mock('../authMiddleware.js', () => ({
  requireAuth: (req, res, next) => {
    if (req.headers.authorization !== 'Bearer ok') return res.status(401).json({ message: '로그인이 필요해요.' })
    req.userId = 'me'
    req.authUser = { id: 'me' }
    return next()
  },
}))
vi.mock('../profileStore.js', () => ({ getProfile: vi.fn(), publicProfile: vi.fn(), upsertProfile: vi.fn(), validateProfile: vi.fn() }))
vi.mock('../accountStore.js', () => ({ deleteUserRecords: m.deleteUserRecords, deleteAuthUser: m.deleteAuthUser }))
vi.mock('../communityStorage.js', () => ({ deleteUserPhotos: m.deleteUserPhotos }))

const { router } = await import('./profile.js')

let server
let base
async function remove(body, headers = { Authorization: 'Bearer ok' }) {
  const response = await fetch(`${base}/api/profile`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: await response.json() }
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  m.calls = []
  m.deleteUserRecords.mockImplementation(async () => m.calls.push('records'))
  m.deleteUserPhotos.mockImplementation(async () => m.calls.push('photos'))
  m.deleteAuthUser.mockImplementation(async () => m.calls.push('auth'))
  const app = express()
  app.use(express.json())
  app.use(router)
  if (server) server.close()
  server = app.listen(0)
  base = `http://127.0.0.1:${server.address().port}`
})

describe('DELETE /api/profile (회원 탈퇴)', () => {
  it('로그인하지 않으면 401 이고 아무것도 지우지 않는다', async () => {
    const result = await remove({ confirm: true }, {})
    expect(result.status).toBe(401)
    expect(m.calls).toEqual([])
  })

  it('confirm: true 가 없으면 400 이고 아무것도 지우지 않는다', async () => {
    expect((await remove({})).status).toBe(400)
    expect((await remove({ confirm: 'true' })).status).toBe(400)
    expect((await remove(undefined)).status).toBe(400)
    expect(m.calls).toEqual([])
  })

  it('DB 기록 → 사진 → 로그인 계정 순서로 지우고, 인증된 본인의 id 로만 지운다', async () => {
    const result = await remove({ confirm: true, userId: 'someone-else' })
    expect(result).toEqual({ status: 200, body: { ok: true } })
    expect(m.calls).toEqual(['records', 'photos', 'auth'])
    expect(m.deleteUserRecords).toHaveBeenCalledWith('me') // 본문의 userId 는 무시된다
    expect(m.deleteUserPhotos).toHaveBeenCalledWith('me')
    expect(m.deleteAuthUser).toHaveBeenCalledWith('me')
  })

  it('사진 삭제가 실패하면 계정을 지우지 않는다 — 다시 시도할 수 있어야 한다', async () => {
    m.deleteUserPhotos.mockRejectedValue(new Error('storage down'))
    const result = await remove({ confirm: true })
    expect(result.status).toBe(500)
    expect(m.deleteAuthUser).not.toHaveBeenCalled()
  })

  it('DB 삭제가 실패하면 사진도 계정도 건드리지 않는다', async () => {
    m.deleteUserRecords.mockRejectedValue(new Error('DB down'))
    expect((await remove({ confirm: true })).status).toBe(500)
    expect(m.calls).toEqual([])
  })

  it('실패 응답에 내부 오류 문구가 들어가지 않는다', async () => {
    m.deleteUserRecords.mockRejectedValue(new Error('Invalid prisma.coursePost.deleteMany() postgresql://secret'))
    const result = await remove({ confirm: true })
    expect(JSON.stringify(result.body)).not.toMatch(/prisma|postgresql|secret/i)
  })

  it('재시도하면 이어서 성공한다', async () => {
    m.deleteAuthUser.mockRejectedValueOnce(new Error('auth down'))
    expect((await remove({ confirm: true })).status).toBe(500)
    expect((await remove({ confirm: true })).status).toBe(200)
  })
})
