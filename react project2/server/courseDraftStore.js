// ─────────────────────────────────────────────────────────────
// server/courseDraftStore.js — 작업 중인 코스 저장소
//
// 사용자당 한 행. 코스 화면에서 편집할 때마다 같은 행을 덮어쓴다(upsert).
// "내 여행"(savedCourseStore.js)처럼 여러 개를 쌓지 않는 이유는, 이건 보관함이 아니라
// "어디까지 했더라"를 기기 사이에 이어 주는 용도라서다.
//
// 한 사람이 두 기기에서 동시에 편집하면 나중에 저장한 쪽이 이긴다. 단독 소유라
// 감수할 만하고, 여럿이 함께 고치는 문제는 ROADMAP.md 의 제안 기반 편집으로 푼다.
// ─────────────────────────────────────────────────────────────

import { prisma } from './db.js'
import { draftCityOf, normalizeDraftPayload } from './courseDraftShape.js'

export async function getCourseDraft(userId) {
  const row = await prisma.courseDraft.findUnique({ where: { userId } })
  return row ? toPublic(row) : null
}

// payload 가 올바르지 않으면 status 400 인 에러를 던진다.
export async function upsertCourseDraft(userId, { dayCount, payload }) {
  const normalized = normalizeDraftPayload(payload)
  if (!normalized) {
    const error = new Error('저장할 코스 정보가 올바르지 않아요.')
    error.status = 400
    throw error
  }
  const data = {
    city: draftCityOf(normalized.meta),
    dayCount: Number.isFinite(dayCount) ? Math.max(1, Math.min(30, Math.floor(dayCount))) : 1,
    payload: JSON.stringify(normalized),
  }
  const row = await prisma.courseDraft.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })
  return toPublic(row)
}

export async function deleteCourseDraft(userId) {
  const result = await prisma.courseDraft.deleteMany({ where: { userId } })
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
    city: row.city,
    dayCount: row.dayCount,
    payload,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
}
