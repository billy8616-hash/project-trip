/* =========================================================================
   authStore.js — 비밀번호 해시 + 회원/세션 DB 접근
   -------------------------------------------------------------------------
   - 비밀번호는 pbkdf2(sha512) 로 해시해서 저장한다. (평문 저장 금지)
     저장 형식: "<반복횟수>:<salt(hex)>:<hash(hex)>"
   - 세션은 sessions 테이블에 임의 토큰으로 저장하고, 그 토큰을
     httpOnly 쿠키로 브라우저에 내려준다. (server.js)
   ========================================================================= */

import {
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'
import { db } from './db.js'

const HASH_ITER = 120000
const HASH_LEN = 64
const HASH_DIGEST = 'sha512'

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, HASH_ITER, HASH_LEN, HASH_DIGEST).toString('hex')
  return `${HASH_ITER}:${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [iter, salt, hash] = String(stored).split(':')
  if (!iter || !salt || !hash) return false
  const test = pbkdf2Sync(password, salt, Number(iter), HASH_LEN, HASH_DIGEST)
  const saved = Buffer.from(hash, 'hex')
  return saved.length === test.length && timingSafeEqual(saved, test)
}

/** 클라이언트에 노출해도 되는 필드만 (비밀번호 해시 제외) */
export function publicUser(row) {
  return { username: row.username, nickname: row.nickname }
}

/* --- 회원 ------------------------------------------------------------- */
const insertUser = db.prepare(
  `INSERT INTO users (id, username, nickname, password_hash, created_at)
   VALUES (?, ?, ?, ?, ?)`,
)
const selectUserByName = db.prepare(`SELECT * FROM users WHERE username = ?`)
const selectUserById = db.prepare(`SELECT * FROM users WHERE id = ?`)

export function createUser({ username, nickname, password }) {
  const id = randomUUID()
  insertUser.run(id, username, nickname, hashPassword(password), new Date().toISOString())
  return selectUserById.get(id)
}

export function getUserByUsername(username) {
  return selectUserByName.get(username) ?? null
}

/* --- 세션 ------------------------------------------------------------- */
const insertSession = db.prepare(
  `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`,
)
const selectSession = db.prepare(`SELECT * FROM sessions WHERE token = ?`)
const deleteSession = db.prepare(`DELETE FROM sessions WHERE token = ?`)

export function createSession(userId) {
  const token = randomBytes(32).toString('hex')
  insertSession.run(token, userId, new Date().toISOString())
  return token
}

export function getSessionUser(token) {
  if (!token) return null
  const session = selectSession.get(token)
  if (!session) return null
  return selectUserById.get(session.user_id) ?? null
}

export function destroySession(token) {
  if (token) deleteSession.run(token)
}
