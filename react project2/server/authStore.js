import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from './db.js'

const hashIterations = 120000
const hashLength = 64
const hashDigest = 'sha512'

export async function readUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
  })
}

export async function writeUsers(users) {
  await prisma.$transaction([
    prisma.user.deleteMany(),
    prisma.user.createMany({ data: users }),
  ])
}

export async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
  })
}

export async function findUserById(id) {
  return prisma.user.findUnique({
    where: { id },
  })
}

export async function createUser(user) {
  return prisma.user.create({
    data: user,
  })
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
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
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
