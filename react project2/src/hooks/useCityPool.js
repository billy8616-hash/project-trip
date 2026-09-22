// ─────────────────────────────────────────────────────────────
// hooks/useCityPool.js — 도시의 장소 풀을 받아 오는 훅
//
// 코스 생성에 필요한 원재료(그 도시의 장소 목록)를 가져온다.
// 캐시를 컴포넌트 안이 아니라 "모듈 전역"에 둔 것이 이 파일의 요점이다.
//
// 왜 그랬나: React StrictMode 는 개발 중 컴포넌트를 두 번 마운트한다.
// 캐시가 컴포넌트 안에 있으면 첫 번째 요청 결과가 통째로 버려지고 같은 요청을
// 두 번 하게 된다. 모듈 전역에 두면 두 번째 마운트가 첫 요청 결과를 그대로 쓴다.
//
// 상태를 세 개의 Map/Set 으로 나눠 둔 이유
//   poolCache   성공한 결과
//   failedCache 실패한 도시 (무한 재시도 방지)
//   inFlight    진행 중인 요청 (같은 도시 중복 호출 방지)
//
// 쓰는 곳: App.jsx
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { fetchCityPool } from '../lib/api.js'

// 도시별 장소 풀(/api/course-pool)을 모듈 레벨에서 공유 캐시한다.
// 훅 인스턴스마다 따로 두면 StrictMode 이중 마운트 때 첫 요청 결과가 버려질 수 있어서
// (특히 cityKey 가 고정인 "오늘의 도시"), 캐시·진행중 표시를 컴포넌트 밖으로 뺐다.
const poolCache = new Map() // cityKey -> pool
const failedCache = new Set() // cityKey (조회 실패)
const inFlight = new Map() // cityKey -> Promise

function loadCityPool(cityKey) {
  if (!inFlight.has(cityKey)) {
    const promise = fetchCityPool(cityKey)
      .then((pool) => {
        poolCache.set(cityKey, pool)
        failedCache.delete(cityKey)
      })
      .catch(() => {
        failedCache.add(cityKey)
      })
      .finally(() => {
        inFlight.delete(cityKey)
      })
    inFlight.set(cityKey, promise)
  }
  return inFlight.get(cityKey)
}

// 캐시가 컴포넌트 밖에 있으므로 값이 바뀌어도 React 가 알 수 없다.
// 그래서 숫자 state 를 하나 두고 억지로 올려서(bump) 다시 그리게 한다.
export function useCityPool(cityKey) {
  const [, bump] = useState(0)
  const rerender = useCallback(() => bump((n) => n + 1), [])

  const data = poolCache.get(cityKey) || null
  const status = data ? 'ready' : failedCache.has(cityKey) ? 'error' : 'loading'

  useEffect(() => {
    if (poolCache.has(cityKey) || failedCache.has(cityKey)) return undefined
    let alive = true
    loadCityPool(cityKey).then(() => {
      if (alive) rerender()
    })
    return () => {
      alive = false
    }
  }, [cityKey, rerender])

  // 실패 기록을 지우고 다시 시도한다.
  const retry = useCallback(() => {
    failedCache.delete(cityKey)
    loadCityPool(cityKey).then(rerender)
  }, [cityKey, rerender])

  return { data, status, retry }
}
