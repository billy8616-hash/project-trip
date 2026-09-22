// ─────────────────────────────────────────────────────────────
// lib/geo.js — 동선 최적화 (외부 길찾기 API 없이 브라우저에서 계산)
//
// 코스에 들어갈 장소들의 "방문 순서"를 정하는 파일.
// 지도에 선을 그리는 일(KakaoRouteMap)과는 분리돼 있다 —
// 여기서 순서를 정하고, 자차 모드일 때만 그 순서를 카카오모빌리티에
// 넘겨 실제 도로 경로로 다시 그린다.
//
// 주요 함수
//   haversineKm(a, b)              두 좌표 사이 직선거리(km)
//   optimizeRouteOrder(places, …)  최근접이웃 + 2-opt 로 순서 재배열
//
// 쓰는 곳: App.jsx (코스 생성·재정렬)
// ─────────────────────────────────────────────────────────────

// 두 좌표 사이의 직선거리를 km 로 구한다(haversine 공식).
// 지구를 반지름 6371km 인 구로 보고 위도·경도 차이를 호의 길이로 환산하는 방식이라,
// 평면 좌표로 빼는 것보다 정확하면서 계산은 여전히 가볍다 — 순서 비교용으로 충분하다.
export function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// 좌표가 있는 장소들을 총 이동거리가 짧아지도록 재정렬한다. (외부 API 없이 브라우저에서 계산)
//  - anchors.start(출발지) / anchors.end(숙소 또는 복귀지)가 있으면 그 지점을 경로의
//    시작·끝으로 고정하고, 그 사이 방문 순서만 최적화한다.
//  - 출발지가 없으면 기존처럼 목록의 첫 장소를 시작점으로 유지한다.
//  1) 최근접 이웃(nearest-neighbor)으로 대략적인 방문 순서를 만든다.
//  2) 2-opt 로 서로 엇갈리는 구간을 뒤집어 가며 (고정된 시작·끝 포함 총거리가) 더 짧아지면 채택한다.
// haversine(직선) 거리 기준이라 도로 실측은 아니지만, 하루 4~8곳 규모에서 "왔다 갔다"를 줄여 준다.
// 자차 모드에서는 이렇게 정한 순서를 카카오모빌리티 길찾기에 넘겨 실제 도로로 다시 그린다.
export function optimizeRouteOrder(places, anchors = {}) {
  const start = anchors.start?.location ? anchors.start : null
  const end = anchors.end?.location ? anchors.end : null
  const located = places.filter((place) => place.location)
  const rest = places.filter((place) => !place.location)
  if (located.length < 2) return [...located, ...rest]

  const distanceOf = (a, b) => haversineKm(a.location, b.location)
  // 고정된 시작·끝을 앞뒤에 붙인 전체 경로 길이. 2-opt 판정과 초기 시드 모두 이 값을 기준으로 한다.
  const totalLength = (list) => {
    const points = [...(start ? [start] : []), ...list, ...(end ? [end] : [])]
    let sum = 0
    for (let i = 1; i < points.length; i += 1) sum += distanceOf(points[i - 1], points[i])
    return sum
  }

  // 1) 최근접 이웃: 시작 앵커(없으면 첫 장소)에서 가장 가까운 미방문 장소를 계속 이어 붙인다.
  const remaining = located.slice()
  const order = []
  let cursor = start
  if (!cursor) {
    cursor = remaining.shift()
    order.push(cursor)
  }
  while (remaining.length) {
    let bestIndex = 0
    let bestDistance = Infinity
    remaining.forEach((place, index) => {
      const distance = distanceOf(cursor, place)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })
    cursor = remaining.splice(bestIndex, 1)[0]
    order.push(cursor)
  }

  // 2) 2-opt: 출발지 앵커가 없으면 첫 장소는 고정. 앵커가 있으면 전 구간을 뒤집을 수 있다.
  const lowerBound = start ? 0 : 1
  let improved = true
  while (improved) {
    improved = false
    for (let i = lowerBound; i < order.length - 1; i += 1) {
      for (let k = i + 1; k < order.length; k += 1) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, k + 1).reverse(),
          ...order.slice(k + 1),
        ]
        if (totalLength(candidate) + 1e-9 < totalLength(order)) {
          order.splice(0, order.length, ...candidate)
          improved = true
        }
      }
    }
  }

  return [...order, ...rest]
}
