// ─────────────────────────────────────────────────────────────
// server/accountStore.js — 회원 탈퇴: 사용자의 데이터와 계정을 지운다
//
// 탈퇴하면 이 사용자가 남긴 것을 전부 지운다.
//   · 프로필(이름·생년월일·성별·휴대폰), 저장한 여행
//   · 내가 공유한 글과, 그 글에 달린 다른 사람의 후기·추천
//   · 내가 다른 글에 남긴 후기·추천
//   · 올린 사진(Supabase Storage)
//   · 로그인 계정 자체(Supabase Auth)
// 글·후기를 익명으로 남기지 않는 이유: 작성자 이름·사진이 개인정보라 남길 근거가 없고, 일부만 남기면
// "어디까지 지워졌는지"를 사용자가 확인할 수 없다.
//
// 순서는 DB 기록 → 사진 → 로그인 계정이다. 계정을 맨 마지막에 지우는 이유: 중간에 실패해도 계정이 아직 있어서
// 사용자가 같은 요청을 다시 보내면 남은 부분을 이어서 지울 수 있다(각 단계는 여러 번 해도 안전하다).
// 계정을 먼저 지우면 데이터가 남은 채 아무도 지울 수 없게 된다.
// ─────────────────────────────────────────────────────────────

import { prisma } from './db.js'
import { getSupabaseAdmin } from './supabaseAdmin.js'

// DB 에 있는 이 사용자의 모든 기록을 한 트랜잭션으로 지운다 (중간에 실패하면 아무것도 지워지지 않는다).
// Profile 은 id 가 곧 사용자 id 다. 이 서비스는 FK/cascade 가 없어서 연결된 테이블을 직접 지운다.
export async function deleteUserRecords(userId) {
  const myPosts = await prisma.coursePost.findMany({ where: { userId }, select: { id: true } })
  const postIds = myPosts.map((post) => post.id)

  await prisma.$transaction([
    // 내 글에 달린 다른 사람의 후기·추천 (글이 사라지면 가리킬 곳이 없다)
    ...(postIds.length > 0
      ? [
          prisma.courseReview.deleteMany({ where: { postId: { in: postIds } } }),
          prisma.courseLike.deleteMany({ where: { postId: { in: postIds } } }),
        ]
      : []),
    prisma.coursePost.deleteMany({ where: { userId } }),
    // 내가 남의 글에 남긴 후기·추천
    prisma.courseReview.deleteMany({ where: { userId } }),
    prisma.courseLike.deleteMany({ where: { userId } }),
    prisma.savedCourse.deleteMany({ where: { userId } }),
    prisma.profile.deleteMany({ where: { id: userId } }),
  ])
}

// Supabase Auth 의 로그인 계정을 지운다. 이미 없으면(이전 시도에서 지워진 경우) 성공으로 본다.
export async function deleteAuthUser(userId) {
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId)
  if (error && !/not.?found/i.test(`${error.message || ''} ${error.code || ''}`)) throw error
}
