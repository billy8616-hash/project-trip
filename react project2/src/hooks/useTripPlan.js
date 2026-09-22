// ─────────────────────────────────────────────────────────────
// hooks/useTripPlan.js — 사용자가 고른 여행 조건 전부
//
// 여행지·테마·날짜·출발지·숙소·기간·예산·교통편·스타일·필수방문 —
// 조건 선택 화면들이 채우고 코스 생성이 읽어 가는 값들을 한 훅에 모았다.
// 이 앱의 전역 상태는 사실상 이것 하나로 수렴해서, 상태 관리 라이브러리를
// 따로 쓰지 않았다.
//
// initial 인자는 새로고침 복원용 스냅샷(lib/tripSession.js)이다.
// 없으면 전부 기본값으로 시작한다.
//
// 쓰는 곳: App.jsx (조건 선택 화면 전체 + 코스 생성)
// ─────────────────────────────────────────────────────────────

import { useCallback, useMemo, useState } from 'react'
import { todayISO } from '../lib/datetime.js'

const MAX_MUST_VISIT = 8

// initial: 새로고침 복원용 스냅샷(lib/tripSession.js). 없으면 전부 기본값으로 시작한다.
export function useTripPlan(initial) {
  const seed = initial || {}
  const [destination, setDestination] = useState(seed.destination || '')
  const [pickedDestination, setPickedDestination] = useState(seed.pickedDestination || '')
  const [journeyTheme, setJourneyTheme] = useState(seed.journeyTheme || '')
  const [tripStartDate, setTripStartDate] = useState(() => seed.tripStartDate || todayISO())
  const [tripEndDate, setTripEndDate] = useState(() => seed.tripEndDate || todayISO())
  const [tripOrigin, setTripOrigin] = useState(seed.tripOrigin || null)
  const [tripLodging, setTripLodging] = useState(seed.tripLodging || null)
  const [duration, setDuration] = useState(seed.duration || '당일')
  const [budget, setBudget] = useState(seed.budget || '보통')
  const [transport, setTransport] = useState(seed.transport || '대중교통')
  const [style, setStyle] = useState(seed.style || '사진 중심')
  const [mustVisit, setMustVisit] = useState(() => (Array.isArray(seed.mustVisit) ? seed.mustVisit : []))
  const [mustVisitInput, setMustVisitInput] = useState('')

  const addMustVisit = useCallback(() => {
    const value = mustVisitInput.trim()
    if (!value) return
    setMustVisit((list) => (list.includes(value) || list.length >= MAX_MUST_VISIT ? list : [...list, value]))
    setMustVisitInput('')
  }, [mustVisitInput])

  const removeMustVisit = useCallback((value) => {
    setMustVisit((list) => list.filter((item) => item !== value))
  }, [])

  // 동선의 도착점. 숙소를 정했으면 숙소, 아니면 출발지로 돌아오는 것으로 본다.
  const routeEndPoint = useMemo(
    () =>
      tripLodging
        ? { ...tripLodging, isLodging: true }
        : tripOrigin
          ? { ...tripOrigin, isLodging: false }
          : null,
    [tripLodging, tripOrigin],
  )

  // 동선 최적화(lib/geo.js)에 넘길 고정점. 출발지·도착지를 여기서 고정해 두면
  // 2-opt 가 그 사이 순서만 바꾼다 — 집에서 출발해 숙소에서 끝나는 하루가 된다.
  const courseAnchors = useMemo(
    () => ({
      start: tripOrigin ? { location: { lat: tripOrigin.lat, lng: tripOrigin.lng } } : null,
      end: tripLodging
        ? { location: { lat: tripLodging.lat, lng: tripLodging.lng } }
        : tripOrigin
          ? { location: { lat: tripOrigin.lat, lng: tripOrigin.lng } }
          : null,
    }),
    [tripOrigin, tripLodging],
  )

  return {
    destination,
    setDestination,
    pickedDestination,
    setPickedDestination,
    journeyTheme,
    setJourneyTheme,
    tripStartDate,
    setTripStartDate,
    tripEndDate,
    setTripEndDate,
    tripOrigin,
    setTripOrigin,
    tripLodging,
    setTripLodging,
    duration,
    setDuration,
    budget,
    setBudget,
    transport,
    setTransport,
    style,
    setStyle,
    mustVisit,
    setMustVisit,
    mustVisitInput,
    setMustVisitInput,
    addMustVisit,
    removeMustVisit,
    routeStartPoint: tripOrigin,
    routeEndPoint,
    courseAnchors,
  }
}
