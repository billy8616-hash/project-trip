// ─────────────────────────────────────────────────────────────
// hooks/useTripForecast.js — 여행 기간의 일자별 날씨 예보
//
// 단순한 표시용이 아니라 코스 생성의 입력이다. 비·눈 예보인 날은
// lib/course.js 가 실외 장소를 감점하고 실내 장소를 가점한다.
//
// 호출 전에 조건을 꼼꼼히 확인한다(ready) — 좌표가 숫자인지, 날짜 형식이 맞는지,
// 출발일이 귀가일보다 앞인지. 잘못된 값으로 외부 API 를 부르는 것을 막는다.
//
// 쓰는 곳: App.jsx → buildCourse 의 wetDays 인자
// ─────────────────────────────────────────────────────────────

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
