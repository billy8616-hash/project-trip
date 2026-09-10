import { useCallback, useMemo, useState } from 'react'
import { todayISO } from '../lib/datetime.js'

const MAX_MUST_VISIT = 8

export function useTripPlan() {
  const [destination, setDestination] = useState('부산')
  const [pickedDestination, setPickedDestination] = useState('')
  const [journeyTheme, setJourneyTheme] = useState('')
  const [tripStartDate, setTripStartDate] = useState(() => todayISO())
  const [tripEndDate, setTripEndDate] = useState(() => todayISO())
  const [tripOrigin, setTripOrigin] = useState(null)
  const [tripLodging, setTripLodging] = useState(null)
  const [duration, setDuration] = useState('당일')
  const [budget, setBudget] = useState('보통')
  const [transport, setTransport] = useState('대중교통')
  const [style, setStyle] = useState('사진 중심')
  const [mustVisit, setMustVisit] = useState([])
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
