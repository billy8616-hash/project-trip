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
