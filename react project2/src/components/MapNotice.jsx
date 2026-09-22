// ─────────────────────────────────────────────────────────────
// components/MapNotice.jsx — 지도 위에 띄우는 한 줄 안내
//
// 길찾기 실패·좌표 부족처럼 지도를 제대로 그릴 수 없을 때 지도 자리에
// 이유를 보여 준다. 지도가 빈 채로 남아 사용자가 고장으로 오해하는 것을 막는다.
//
// 쓰는 곳: KakaoRouteMap
// ─────────────────────────────────────────────────────────────

export default function MapNotice({ title, text }) {
  return (
    <div className="map-notice">
      <b>{title}</b>
      <span>{text}</span>
    </div>
  )
}
