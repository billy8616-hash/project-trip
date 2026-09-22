// ─────────────────────────────────────────────────────────────
// server/savedCourseStore.js — "내 여행" 저장소
//
// 코스 하나를 payload(JSON 문자열) 통째로 저장한다. 장소마다 행을 만들지 않는 이유는
// 저장·복원이 단순해지기 때문이다 — 대신 여러 명이 같은 코스를 동시에 편집할 수는 없다
// (그 판단의 근거와 다음 계획은 ROADMAP.md 에 적어 두었다).
//
// 사용자당 50개 상한을 둔다.
// ─────────────────────────────────────────────────────────────

import { prisma } from './db.js'

// "내 여행"에 저장된 여행 동선 스냅샷 CRUD. payload 는 JSON 문자열로 저장한다.

const MAX_PER_USER = 50

export async function listSavedCourses(userId) {
  const rows = await prisma.savedCourse.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map(toPublic)
}

export async function createSavedCourse(userId, { title, city, dayCount, payload }) {
  const count = await prisma.savedCourse.count({ where: { userId } })
  if (count >= MAX_PER_USER) {
    const error = new Error(`저장은 최대 ${MAX_PER_USER}개까지 가능해요. 오래된 여행을 지우고 다시 시도해주세요.`)
    error.status = 409
    throw error
  }
  const row = await prisma.savedCourse.create({
    data: {
      userId,
      title: title.slice(0, 80),
      city: city.slice(0, 40),
      dayCount: Number.isFinite(dayCount) ? Math.max(1, Math.min(30, Math.floor(dayCount))) : 1,
      payload: JSON.stringify(payload),
    },
  })
  return toPublic(row)
}

export async function renameSavedCourse(userId, id, title) {
  const result = await prisma.savedCourse.updateMany({
    where: { id, userId },
    data: { title: title.slice(0, 80) },
  })
  return result.count > 0
}

export async function deleteSavedCourse(userId, id) {
  const result = await prisma.savedCourse.deleteMany({ where: { id, userId } })
  return result.count > 0
}

function toPublic(row) {
  let payload = null
  try {
    payload = JSON.parse(row.payload)
  } catch {
    /* 저장된 JSON 이 깨졌으면 payload 는 null 로 둔다 */
  }
  return {
    id: row.id,
    title: row.title,
    city: row.city,
    dayCount: row.dayCount,
    payload,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
}
