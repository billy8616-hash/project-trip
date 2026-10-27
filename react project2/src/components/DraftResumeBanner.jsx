// ─────────────────────────────────────────────────────────────
// components/DraftResumeBanner.jsx — 홈 화면 "이어서 보기" 띠
//
// 로그인 사용자가 서버에 작업 중인 코스(CourseDraft)를 남겨 두었으면 홈 위쪽에
// 띄운다. 다른 기기에서 고치던 코스, 또는 방금 홈으로 나오기 전에 보던 코스다.
// 닫으면 서버 작업본을 지워 다른 기기에서도 더는 뜨지 않는다.
//
// 쓰는 곳: App.jsx (screen === 'home' && 로그인)
// ─────────────────────────────────────────────────────────────

// "3분 전", "어제" 처럼 대략적인 편집 시각. 정확한 시각보다 "얼마나 됐는지"가 중요하다.
function relativeTime(iso) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (!Number.isFinite(diffMin)) return ''
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  const diffDay = Math.floor(diffHour / 24)
  return diffDay === 1 ? '어제' : `${diffDay}일 전`
}

export default function DraftResumeBanner({ draft, onResume, onDismiss }) {
  const meta = draft.payload?.meta || {}
  const title = draft.payload?.view?.savedName || `${draft.city} ${meta.duration || ''}`.trim()
  const when = relativeTime(draft.updatedAt)

  return (
    <aside className="draft-resume" aria-label="작업 중인 코스">
      <div className="draft-resume-text">
        <b>만들던 코스가 있어요</b>
        <span>{title}{when ? ` · ${when} 편집` : ''}</span>
      </div>
      <button className="draft-resume-go" type="button" onClick={onResume}>이어서 보기</button>
      <button className="draft-resume-close" type="button" onClick={onDismiss} aria-label="작업 중인 코스 닫기">×</button>
    </aside>
  )
}
