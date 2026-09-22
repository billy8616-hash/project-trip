// ─────────────────────────────────────────────────────────────
// lib/tripSession.js — 새로고침 대비 로컬 스냅샷
//
// localStorage 에 "지금 보고 있는 코스"를 저장해 두고, 새로고침하면 되살린다.
// 로그인 없이도 동작해야 해서 서버가 아니라 브라우저에 둔다.
//
// 되살릴 때 일부러 까다롭게 군다 — 저장한 지 12시간이 넘었거나, 코스 화면이
// 아니었거나, 형식 버전이 다르면 복원하지 않는다. 엉뚱한 상태가 되살아나는 것이
// 아예 복원되지 않는 것보다 나쁘기 때문이다.
//
// 쓰는 곳: App.jsx
// ─────────────────────────────────────────────────────────────

// 새로고침해도 "보고 있던 코스 + 내가 손으로 고친 순서"가 남아 있게 하는 브라우저 로컬 스냅샷.
//
// "내 여행"(서버 저장)과는 목적이 다르다. 저쪽은 로그인한 사용자가 의도적으로 보관하는 결과물이고,
// 이쪽은 로그인 없이도 동작하는 '작업 중인 상태'의 보존이다. 기기·브라우저마다 따로 논다.
//
// 스냅샷은 코스 화면에 있는 동안에만 갱신하고, 홈/목적지 화면으로 나가면(=새 여행을 시작하는
// 흐름) 지운다. 그래야 홈에서 새로고침했는데 며칠 전 코스가 튀어나오는 일이 없다.

const KEY = 'balgil.trip-session.v1'

// 오래된 세션이 갑자기 되살아나면 오히려 혼란스러우므로 반나절만 유지한다.
const MAX_AGE_MS = 12 * 60 * 60 * 1000

export function loadTripSession() {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null

    const data = JSON.parse(raw)
    if (!data || data.version !== 1) return null

    if (!Number.isFinite(data.savedAt) || Date.now() - data.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY)
      return null
    }

    // 코스 화면만 되살린다. 중간 단계(테마·예산 고르는 중)까지 복원하면 홈으로 돌아온 줄 알았던
    // 사용자가 엉뚱한 화면을 보게 된다.
    if (data.screen !== 'course') return null
    if (!data.meta?.destination) return null

    return data
  } catch {
    // 시크릿 모드·저장소 차단 등으로 읽기가 막힌 환경에서는 그냥 복원하지 않는다.
    return null
  }
}

export function saveTripSession(snapshot) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...snapshot, version: 1, savedAt: Date.now() }))
  } catch {
    // 용량 초과나 저장소 차단. 복원은 부가 기능이라 실패해도 앱은 그대로 돌아가야 한다.
  }
}

export function clearTripSession() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // 위와 같은 이유로 무시한다.
  }
}
