import { useEffect, useState } from 'react'
import { fetchWeatherForecast } from '../lib/api.js'

// 코스 화면에서 여행 날짜(출발~귀가) 구간의 일자별 예보를 받아 온다.
// buildCourse 가 "비/눈 오는 날은 실내 위주" 보정에 쓰고, 실패하면 조용히 빈 배열로 넘어간다
// (예보는 부가 정보 — 없으면 날씨 무시하고 평소대로 코스를 짠다).
const cache = new Map() // "city:start:end" -> days[]

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function useTripForecast(cityKey, center, startDate, endDate) {
  const ready =
    Boolean(cityKey) &&
    Number.isFinite(center?.lat) &&
    Number.isFinite(center?.lng) &&
    DATE.test(startDate || '') &&
    DATE.test(endDate || '') &&
    startDate <= endDate
  const key = ready ? `${cityKey}:${startDate}:${endDate}` : null

  const [byKey, setByKey] = useState(() => (key && cache.has(key) ? { [key]: cache.get(key) } : {}))

  useEffect(() => {
    if (!key || cache.has(key)) return undefined

    let alive = true
    fetchWeatherForecast(center.lat, center.lng, startDate, endDate)
      .then((days) => {
        cache.set(key, days)
        if (alive) setByKey((prev) => ({ ...prev, [key]: days }))
      })
      .catch(() => {
        cache.set(key, [])
        if (alive) setByKey((prev) => ({ ...prev, [key]: [] }))
      })

    return () => {
      alive = false
    }
  }, [key, center?.lat, center?.lng, startDate, endDate])

  if (!key) return []
  return byKey[key] ?? (cache.has(key) ? cache.get(key) : [])
}
