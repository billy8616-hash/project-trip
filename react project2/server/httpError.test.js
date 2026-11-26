import { describe, expect, it, vi } from 'vitest'
import { errorHandler, publicMessage, publicStatus } from './httpError.js'

function fakeRes() {
  const res = { headersSent: false }
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('publicMessage', () => {
  it('우리 코드가 4xx 로 던진 오류는 원문을 보여 준다', () => {
    const error = Object.assign(new Error('저장은 최대 50개까지 가능해요.'), { status: 409 })
    expect(publicMessage(error, '저장하지 못했어요.')).toBe('저장은 최대 50개까지 가능해요.')
  })

  it('status 없는 오류(Prisma 등)는 내부 문구를 숨기고 일반 문구를 쓴다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Invalid `prisma.savedCourse.findMany()` invocation: connection string postgresql://...')
    expect(publicMessage(error, '불러오지 못했어요.')).toBe('불러오지 못했어요.')
  })

  it('status 가 500 이어도 원문을 숨긴다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = Object.assign(new Error('내부 상세'), { status: 500 })
    expect(publicMessage(error, '일반 문구')).toBe('일반 문구')
  })
})

describe('publicStatus', () => {
  it('4xx 만 그대로, 나머지는 기본값', () => {
    expect(publicStatus({ status: 409 })).toBe(409)
    expect(publicStatus({ status: 500 })).toBe(500)
    expect(publicStatus(new Error('x'), 502)).toBe(502)
  })
})

describe('errorHandler', () => {
  it('JSON 본문 파싱 실패는 400', () => {
    const res = fakeRes()
    errorHandler({ type: 'entity.parse.failed' }, {}, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('알 수 없는 오류는 내부 문구 없이 500 JSON', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = fakeRes()
    errorHandler(new Error('secret db detail'), {}, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(500)
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('secret')
  })

  it('이미 응답을 보냈으면 다음 핸들러로 넘긴다', () => {
    const res = fakeRes()
    res.headersSent = true
    const next = vi.fn()
    const error = new Error('x')
    errorHandler(error, {}, res, next)
    expect(next).toHaveBeenCalledWith(error)
  })

  it('라이브러리가 4xx 로 표시한 오류는 4xx 로 응답하고 서버 오류 로그를 남기지 않는다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    spy.mockClear()
    const res = fakeRes()
    // decodeURIComponent 실패(깨진 URL 인코딩) — express 가 status 400 을 붙여 올린다.
    errorHandler(Object.assign(new URIError('Failed to decode param \'%E0%A4%A\''), { status: 400 }), {}, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('decode')
    expect(spy).not.toHaveBeenCalled()
  })

  it('statusCode 만 가진 4xx 오류도 4xx 로 응답한다', () => {
    const res = fakeRes()
    errorHandler(Object.assign(new Error('incorrect header check'), { statusCode: 400 }), {}, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('5xx 표시나 status 없는 오류는 500', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = fakeRes()
    errorHandler(Object.assign(new Error('x'), { status: 503 }), {}, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(500)
  })
})
