import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataFile = join(__dirname, 'data', 'users.json')
const hashIterations = 120000
const hashLength = 64
const hashDigest = 'sha512'

async function ensureDataFile() {
  await mkdir(dirname(dataFile), { recursive: true })
  try {
    await readFile(dataFile, 'utf8')
  } catch {
    await writeFile(dataFile, '[]', 'utf8')
  }
}

export async function readUsers() {
  await ensureDataFile()
  const raw = await readFile(dataFile, 'utf8')
  return JSON.parse(raw)
}

export async function writeUsers(users) {
  await ensureDataFile()
  await writeFile(dataFile, `${JSON.stringify(users, null, 2)}\n`, 'utf8')
}

export function publicUser(user) {
  // 비밀번호 해시 등 민감 정보를 뺀, 클라이언트에 노출해도 되는 필드만 반환한다.
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    birthdate: user.birthdate ?? null,
    gender: user.gender ?? null,
    phone: user.phone ?? null,
    createdAt: user.createdAt,
  }
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, hashIterations, hashLength, hashDigest).toString('hex')
  return `${hashIterations}:${salt}:${hash}`
}

export function verifyPassword(password, storedPassword) {
  const [iterations, salt, hash] = storedPassword.split(':')
  const testHash = pbkdf2Sync(password, salt, Number(iterations), hashLength, hashDigest)
  const savedHash = Buffer.from(hash, 'hex')
  return savedHash.length === testHash.length && timingSafeEqual(savedHash, testHash)
}
