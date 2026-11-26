import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ files: [], listError: null, removeError: null, removed: [] }))

vi.mock('./supabaseAdmin.js', () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        list: async (folder, { limit }) => {
          if (state.listError) return { data: null, error: state.listError }
          return { data: state.files.filter((file) => file.folder === folder).slice(0, limit), error: null }
        },
        remove: async (paths) => {
          if (state.removeError) return { error: state.removeError }
          state.removed.push(...paths)
          state.files = state.files.filter((file) => !paths.includes(`${file.folder}/${file.name}`))
          return { error: null }
        },
      }),
    },
  }),
}))

const { deleteUserPhotos } = await import('./communityStorage.js')

beforeEach(() => {
  state.files = []
  state.listError = null
  state.removeError = null
  state.removed = []
})

const addFiles = (folder, count) => { for (let i = 0; i < count; i += 1) state.files.push({ folder, name: `${i}.jpg` }) }

describe('deleteUserPhotos', () => {
  it('내 폴더의 사진만 지우고 다른 사용자의 사진은 그대로 둔다', async () => {
    addFiles('me', 3)
    addFiles('other', 2)
    expect(await deleteUserPhotos('me')).toBe(3)
    expect(state.removed.sort()).toEqual(['me/0.jpg', 'me/1.jpg', 'me/2.jpg'])
    expect(state.files.every((file) => file.folder === 'other')).toBe(true)
  })

  it('100개를 넘으면 폴더가 빌 때까지 여러 번 지운다', async () => {
    addFiles('me', 230)
    expect(await deleteUserPhotos('me')).toBe(230)
    expect(state.files).toHaveLength(0)
  })

  it('정확히 100개(페이지 경계)여도 남김없이 지운다', async () => {
    addFiles('me', 100)
    expect(await deleteUserPhotos('me')).toBe(100)
    expect(state.files).toHaveLength(0)
  })

  it('userId 가 비어 있으면 Storage 를 건드리지 않고 던진다', async () => {
    addFiles('me', 2)
    await expect(deleteUserPhotos(undefined)).rejects.toThrow('사용자 id')
    await expect(deleteUserPhotos('')).rejects.toThrow('사용자 id')
    expect(state.files).toHaveLength(2)
  })

  it('올린 사진이 없으면 0', async () => {
    expect(await deleteUserPhotos('me')).toBe(0)
  })

  it('버킷이 아직 없으면 지울 게 없는 것으로 본다', async () => {
    state.listError = { message: 'Bucket not found' }
    expect(await deleteUserPhotos('me')).toBe(0)
  })

  it('그 밖의 목록 오류와 삭제 오류는 던진다', async () => {
    state.listError = { message: 'service unavailable' }
    await expect(deleteUserPhotos('me')).rejects.toMatchObject({ message: 'service unavailable' })

    state.listError = null
    addFiles('me', 1)
    state.removeError = { message: 'remove failed' }
    await expect(deleteUserPhotos('me')).rejects.toMatchObject({ message: 'remove failed' })
  })
})
