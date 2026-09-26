// ─────────────────────────────────────────────────────────────
// screens/community/RoutePreview.jsx — 동선 미리보기 (payload.days)
//
// 공유된 코스의 동선을 한 줄로 미리 보여 준다(장소1 → 장소2 → …).
// 상세를 열기 전에 "이 코스가 내 취향인지" 판단할 근거를 주는 부분이다.
// ─────────────────────────────────────────────────────────────

export function RoutePreview({ payload }) {
  const days = Array.isArray(payload?.days) ? payload.days : []
  if (days.length === 0) {
    return <p className="tw-text-[13px] tw-text-cink-faint">저장된 일정 정보가 없어요.</p>
  }
  return (
    <div className="tw-space-y-3">
      {days.map((places, d) => (
        <div key={d}>
          <p className="tw-mb-1.5 tw-text-[12px] tw-font-bold tw-text-caccent">Day {d + 1}</p>
          <ol className="tw-flex tw-flex-wrap tw-items-center tw-gap-1.5">
            {(places || []).map((place, i) => (
              <li key={`${place?.name}-${i}`} className="tw-flex tw-items-center tw-gap-1.5">
                {i > 0 && <span className="tw-text-cink-faint">→</span>}
                <span className="tw-rounded-md tw-bg-surface-2 tw-px-2 tw-py-1 tw-text-[12.5px] tw-text-cink">
                  {place?.name || '알 수 없음'}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}
