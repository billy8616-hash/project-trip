// ─────────────────────────────────────────────────────────────
// server/coursePayload.js — 저장·공유하는 일정(payload) 검사
//
// "내 여행" 저장과 커뮤니티 공유는 일정을 JSON 통째로 받아 그대로 저장하고, 화면
// (RoutePreview · MyTripsScreen)은 days[일차][순서].name 을 바로 읽는다. 모양이 틀린 값
// (예: {days:[1]})이 저장되면 그 글을 여는 모든 사람의 화면이 멈추므로 여기서 막는다.
// 장소의 나머지 필드(좌표·시간대 등)는 화면 버전마다 달라서 그대로 통과시킨다.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod'

const placeSchema = z.looseObject({ name: z.string().trim().min(1).max(120) })
const payloadSchema = z.looseObject({
  days: z.array(z.array(placeSchema).max(30)).min(1).max(30),
})

// 올바르면 payload, 아니면 null.
export function parseCoursePayload(payload) {
  const result = payloadSchema.safeParse(payload)
  return result.success ? result.data : null
}
