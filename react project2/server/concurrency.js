// ─────────────────────────────────────────────────────────────
// server/concurrency.js — 외부 API 호출을 안전하게 묶어 주는 도구 두 개
//
// 이 앱은 장소 하나를 완성하는 데도 외부 API 를 여러 번 부른다. 수십 개를
// 한꺼번에 던지면 상대 서버가 막거나 느려지고, 그중 하나만 응답이 없어도
// 전체가 멈춰 버린다. 그 두 가지를 막는 것이 이 파일의 역할이다.
//
//   mapLimit       동시 실행 개수를 제한한다 (Promise.all 의 안전한 버전)
//   timeoutSignal  응답이 없으면 정해진 시간에 요청을 끊는다
//
// 쓰는 곳: tourApi · kakaoLocal · googlePlaces · odsay · tmap 등 외부 호출 전부
// ─────────────────────────────────────────────────────────────

// 여러 개의 외부 API 호출을 한꺼번에 다 던지지 않고, 동시에 최대 limit 개까지만 돌린다.
// (TourAPI 상세조회처럼 수십 개를 한 번에 던지면 일부가 멈춰 전체가 지연되는 걸 막는다.)
// limit 개의 "일꾼"을 만들어 목록을 나눠 처리하는 방식이다.
// 일꾼이 하나 끝내면 곧바로 다음 항목을 집어 가므로, 느린 항목 하나가
// 전체를 붙잡지 않는다.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await fn(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

// fetch 에 타임아웃을 건다. Node 17.3+ 의 AbortSignal.timeout 사용.
export function timeoutSignal(ms) {
  try {
    return AbortSignal.timeout(ms)
  } catch {
    return undefined
  }
}
