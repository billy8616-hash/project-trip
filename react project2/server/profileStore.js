// ─────────────────────────────────────────────────────────────
// server/profileStore.js — 앱 전용 프로필 저장소
//
// 계정 자체(이메일·비밀번호·소셜 연결)는 Supabase Auth 가 갖고 있고,
// 여기에는 이름·생년월일·성별·휴대폰만 둔다. Profile 의 id 는 Supabase 유저 id 와 같은 값이라
// 두 쪽이 자연스럽게 이어진다.
//
// validateProfile 은 이메일 가입과 소셜 로그인 첫 진입 양쪽에서 같은 규칙으로 쓰인다.
// ─────────────────────────────────────────────────────────────

import { prisma } from './db.js'

// Supabase Auth 가 갖고 있지 않은 추가 프로필 필드(이름/생년월일/성별/휴대폰) CRUD.

const ALLOWED_GENDERS = ['male', 'female', 'other']

export async function getProfile(id) {
  return prisma.profile.findUnique({ where: { id } })
}

// 이메일 가입 완료 / 소셜 로그인 첫 진입 시 프로필을 채울 때 공통으로 쓰는 검증.
export function validateProfile({ name, birthdate, gender, phone }) {
  if (!name || name.length < 2 || name.length > 20) return '이름은 2~20자로 입력해주세요.'

  if (birthdate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
      return '생년월일을 YYYY-MM-DD 형식으로 입력해주세요.'
    }
    const birth = new Date(`${birthdate}T00:00:00`)
    if (Number.isNaN(birth.getTime())) return '올바른 생년월일이 아니에요.'
    const now = new Date()
    if (birth > now) return '생년월일은 미래일 수 없어요.'
    const ageInYears = (now - birth) / (1000 * 60 * 60 * 24 * 365.25)
    if (ageInYears > 120) return '생년월일을 다시 확인해주세요.'
  }

  if (gender && !ALLOWED_GENDERS.includes(gender)) return '성별 값이 올바르지 않아요.'

  if (phone && !/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(phone)) {
    return '휴대폰 번호 형식이 올바르지 않아요. (예: 010-1234-5678)'
  }

  return null
}

export async function upsertProfile(id, { name, birthdate, gender, phone }) {
  const data = {
    name,
    birthdate: birthdate || null,
    gender: gender || null,
    phone: phone || null,
  }
  return prisma.profile.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  })
}

export function publicProfile(authUser, profile) {
  return {
    id: authUser.id,
    email: authUser.email,
    name: profile?.name ?? null,
    birthdate: profile?.birthdate ?? null,
    gender: profile?.gender ?? null,
    phone: profile?.phone ?? null,
    createdAt: profile?.createdAt instanceof Date ? profile.createdAt.toISOString() : profile?.createdAt ?? authUser.created_at,
  }
}
