// ─────────────────────────────────────────────────────────────
// screens/community/fmtDate.js — 커뮤니티 화면 공용 날짜 표시("9월 26일")
// ─────────────────────────────────────────────────────────────

export const fmtDate = (value) => {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일`
}
