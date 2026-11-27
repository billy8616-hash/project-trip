import { describe, expect, it } from 'vitest'
import { CONFIRM_PHRASE, failureMessage, isConfirmPhrase, isUnknownOutcome } from './accountConfirm.js'

describe('isConfirmPhrase', () => {
  it('정확히 입력하면 통과, 앞뒤 공백은 봐준다', () => {
    expect(isConfirmPhrase(CONFIRM_PHRASE)).toBe(true)
    expect(isConfirmPhrase(`  ${CONFIRM_PHRASE}  `)).toBe(true)
  })

  it('조합형이 아닌 자모로 분해된 입력(NFD)도 같은 글자로 본다', () => {
    expect(isConfirmPhrase(CONFIRM_PHRASE.normalize('NFD'))).toBe(true)
  })

  it('일부만 쓰거나 다르게 쓰면 통과하지 않는다', () => {
    expect(isConfirmPhrase('')).toBe(false)
    expect(isConfirmPhrase('탈퇴')).toBe(false)
    expect(isConfirmPhrase('탈퇴합니다.')).toBe(false)
    expect(isConfirmPhrase('탈퇴 합니다')).toBe(false)
    expect(isConfirmPhrase(undefined)).toBe(false)
    expect(isConfirmPhrase(null)).toBe(false)
  })
})

describe('failureMessage', () => {
  it('서버가 응답한 오류는 서버 문구를 그대로 쓴다', () => {
    expect(failureMessage(Object.assign(new Error('서버 안내 문구'), { status: 500 }))).toBe('서버 안내 문구')
  })

  it('응답이 없으면 연결 확인과 이어서 지워진다는 안내', () => {
    const message = failureMessage(new TypeError('Failed to fetch'))
    expect(message).toContain('인터넷 연결')
    expect(message).toContain('이어서')
    expect(message).not.toContain('Failed to fetch')
  })
})

describe('isUnknownOutcome', () => {
  it('응답이 없거나 5xx 면 결과를 모르는 실패', () => {
    expect(isUnknownOutcome(new TypeError('Failed to fetch'))).toBe(true)
    expect(isUnknownOutcome({ status: 500 })).toBe(true)
    expect(isUnknownOutcome({ status: 503 })).toBe(true)
  })

  it('4xx 는 서버가 거절한 것이라 결과를 아는 실패', () => {
    expect(isUnknownOutcome({ status: 400 })).toBe(false)
    expect(isUnknownOutcome({ status: 401 })).toBe(false)
  })
})
