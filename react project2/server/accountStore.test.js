import { beforeEach, describe, expect, it, vi } from 'vitest'

// 메모리에 만든 가짜 DB. 실제로 어떤 행이 남는지 보려고 deleteMany/findMany 를 구현한다.
const state = vi.hoisted(() => ({ tables: {}, supabase: null }))

function table(name) {
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, cond]) => (cond && typeof cond === 'object' && 'in' in cond ? cond.in.includes(row[key]) : row[key] === cond))
  return {
    findMany: async ({ where } = {}) => state.tables[name].filter((row) => matches(row, where)),
    // $transaction 배열에 넣을 수 있도록 실행은 호출 시점이 아니라 await 시점에 일어나게 한다.
    deleteMany: ({ where } = {}) => {
      const run = async () => {
        const before = state.tables[name].length
        state.tables[name] = state.tables[name].filter((row) => !matches(row, where))
        return { count: before - state.tables[name].length }
      }
      return { then: (resolve, reject) => run().then(resolve, reject) }
    },
  }
}

vi.mock('./db.js', () => ({
  prisma: {
    coursePost: table('coursePost'),
    courseReview: table('courseReview'),
    courseLike: table('courseLike'),
    savedCourse: table('savedCourse'),
    profile: table('profile'),
    $transaction: async (ops) => {
      if (state.failTransaction) throw new Error('DB down')
      return Promise.all(ops)
    },
  },
}))
vi.mock('./supabaseAdmin.js', () => ({ getSupabaseAdmin: () => state.supabase }))

const { deleteAuthUser, deleteUserRecords } = await import('./accountStore.js')

beforeEach(() => {
  state.failTransaction = false
  state.tables = {
    profile: [{ id: 'me' }, { id: 'other' }],
    savedCourse: [{ id: 's1', userId: 'me' }, { id: 's2', userId: 'other' }],
    coursePost: [
      { id: 'post-me', userId: 'me' },
      { id: 'post-other', userId: 'other' },
    ],
    courseReview: [
      { id: 'r1', postId: 'post-me', userId: 'other' }, // 남이 내 글에 단 후기
      { id: 'r2', postId: 'post-other', userId: 'me' }, // 내가 남의 글에 단 후기
      { id: 'r3', postId: 'post-other', userId: 'third' }, // 무관한 후기
    ],
    courseLike: [
      { id: 'l1', postId: 'post-me', userId: 'other' }, // 남이 내 글에 누른 추천
      { id: 'l2', postId: 'post-other', userId: 'me' }, // 내가 남의 글에 누른 추천
      { id: 'l3', postId: 'post-other', userId: 'third' }, // 무관한 추천
    ],
  }
})

describe('deleteUserRecords', () => {
  it('내 프로필·저장한 여행·글·후기·추천을 지우고 내 글에 달린 남의 후기·추천도 지운다', async () => {
    await deleteUserRecords('me')

    expect(state.tables.profile).toEqual([{ id: 'other' }])
    expect(state.tables.savedCourse).toEqual([{ id: 's2', userId: 'other' }])
    expect(state.tables.coursePost).toEqual([{ id: 'post-other', userId: 'other' }])
    expect(state.tables.courseReview.map((row) => row.id)).toEqual(['r3'])
    expect(state.tables.courseLike.map((row) => row.id)).toEqual(['l3'])
  })

  it('글이 하나도 없는 사용자도 문제없이 지워지고 다른 사람 데이터는 그대로다', async () => {
    state.tables.coursePost = [{ id: 'post-other', userId: 'other' }]
    await deleteUserRecords('me')
    expect(state.tables.profile).toEqual([{ id: 'other' }])
    expect(state.tables.courseReview.map((row) => row.id)).toEqual(['r1', 'r3']) // 내가 단 r2 만 지워짐
  })

  it('두 번 호출해도 안전하다(중간 실패 후 재시도)', async () => {
    await deleteUserRecords('me')
    await expect(deleteUserRecords('me')).resolves.toBeUndefined()
    expect(state.tables.profile).toEqual([{ id: 'other' }])
  })

  it('트랜잭션이 실패하면 예외를 올린다', async () => {
    state.failTransaction = true
    await expect(deleteUserRecords('me')).rejects.toThrow('DB down')
  })
})

describe('deleteAuthUser', () => {
  it('Supabase 계정을 지운다', async () => {
    const deleteUser = vi.fn(async () => ({ error: null }))
    state.supabase = { auth: { admin: { deleteUser } } }
    await deleteAuthUser('me')
    expect(deleteUser).toHaveBeenCalledWith('me')
  })

  it('이미 없는 계정(이전 시도에서 지워짐)은 성공으로 본다', async () => {
    state.supabase = { auth: { admin: { deleteUser: async () => ({ error: { message: 'User not found', code: 'user_not_found' } }) } } }
    await expect(deleteAuthUser('me')).resolves.toBeUndefined()
  })

  it('그 밖의 오류는 던진다', async () => {
    state.supabase = { auth: { admin: { deleteUser: async () => ({ error: { message: 'service unavailable' } }) } } }
    await expect(deleteAuthUser('me')).rejects.toMatchObject({ message: 'service unavailable' })
  })
})
