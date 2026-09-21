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

  const routeEndPoint = useMemo(
    () =>
      tripLodging
        ? { ...tripLodging, isLodging: true }
        : tripOrigin
          ? { ...tripOrigin, isLodging: false }
          : null,
    [tripLodging, tripOrigin],
  )

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
