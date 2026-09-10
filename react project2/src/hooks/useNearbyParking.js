import { useEffect, useState } from 'react'
import { fetchNearbyParking } from '../lib/api.js'

// 코스 화면에서 선택한 관광지 주변 주차장. 좌표별로 결과를 모듈 레벨에서 공유 캐시해서
// 같은 장소를 다시 눌러도 재요청하지 않는다. 부가 정보라 실패해도 빈 목록으로 캐시하고
// 조용히 넘어간다 (상세 박스에서 "주변 주차장" 줄만 안 보인다).
const cache = new Map() // "lat,lng" -> items

const keyFor = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(4)},${lng.toFixed(4)}` : null

export function useNearbyParking(lat, lng) {
  const key = keyFor(lat, lng)
  const [byKey, setByKey] = useState(() => (key && cache.has(key) ? { [key]: cache.get(key) } : {}))

  useEffect(() => {
    if (!key || cache.has(key)) return undefined

    let alive = true
    fetchNearbyParking(lat, lng)
      .then((items) => {
        cache.set(key, items)
        if (alive) setByKey((prev) => ({ ...prev, [key]: items }))
      })
      .catch(() => {
        cache.set(key, []) // 실패도 캐시해 재요청을 막는다.
        if (alive) setByKey((prev) => ({ ...prev, [key]: [] }))
      })

    return () => {
      alive = false
    }
  }, [key, lat, lng])

  if (!key) return { status: 'idle', items: [] }
  const items = byKey[key] ?? (cache.has(key) ? cache.get(key) : null)
  if (items == null) return { status: 'loading', items: [] }
  return { status: 'ready', items }
}
