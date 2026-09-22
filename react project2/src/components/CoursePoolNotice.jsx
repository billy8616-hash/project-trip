// ─────────────────────────────────────────────────────────────
// components/CoursePoolNotice.jsx — 코스 준비 중 / 실패 화면
//
// 그 도시를 처음 조회하면 외부 API 를 여러 개 거치느라 시간이 걸린다.
// 그동안 빈 화면을 보여 주는 대신 무엇을 하고 있는지 알려 주고,
// 실패했을 때는 다시 시도 버튼을 준다.
//
// 쓰는 곳: App.jsx (장소 풀 status 가 loading·error 일 때 코스 화면 대신 표시)
// ─────────────────────────────────────────────────────────────

// /api/course-pool 호출이 진행 중이거나 실패했을 때 코스 화면 대신 보여주는 상태 화면.
export default function CoursePoolNotice({ cityKey, status, onRetry, onBack }) {
  return (
    <section className="course-screen course-pool-screen">
      <header className="course-header">
        <div>
          <button className="back-button" type="button" onClick={onBack}>홈으로</button>
          <h1>{cityKey} 코스 준비 중</h1>
        </div>
      </header>
      <div className="course-pool-notice">
        {status === 'error' ? (
          <>
            <b>여행지 정보를 가져오지 못했어요</b>
            <span>관광지·맛집·카페 데이터를 불러오는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.</span>
            <button type="button" onClick={onRetry}>다시 시도</button>
          </>
        ) : (
          <>
            <b>{cityKey}의 장소를 모으고 있어요</b>
            <span>관광지·맛집·카페 정보를 불러오는 중이에요. 잠시만 기다려 주세요.</span>
          </>
        )}
      </div>
    </section>
  )
}
