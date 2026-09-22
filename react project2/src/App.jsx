// ═════════════════════════════════════════════════════════════
// App.jsx — 앱의 중심. 화면 전환 · 여행 조건 · 코스 생성과 편집
//
// 이 파일이 하는 일은 크게 다섯 가지다.
//
//  1) 화면 전환
//     screen 이라는 문자열 하나로 홈·목적지·테마·예산·날짜·출발지·필수방문·
//     코스·내 여행·커뮤니티·회원가입 화면을 갈아 끼운다. 라우터 라이브러리를
//     쓰지 않는 대신 History API 와 직접 동기화해서 브라우저 뒤로가기도 동작한다.
//
//  2) 여행 조건 보관
//     useTripPlan 훅이 조건 전부(여행지·테마·날짜·예산·교통편…)를 들고 있고,
//     조건 선택 화면들은 그 값을 채우기만 한다.
//
//  3) 코스 생성
//     조건이 갖춰지면 buildCourse(lib/course.js)를 호출해 코스를 만든다.
//     useMemo 로 감싸 두어 조건이 바뀔 때만 다시 계산한다 — 코스 생성은
//     수백 개 장소를 정렬하는 작업이라 매 렌더마다 돌리면 안 된다.
//
//  4) 편집 결과 관리
//     사용자가 타임라인에서 순서를 바꾸면 그 결과(currentTimelineDays)가
//     추천 코스보다 우선한다. 손으로 고친 날은 manualOrderDays 에 기록해 두고
//     자동 거리 최적화에서 제외한다 — 사용자가 맞춰 놓은 순서를 앱이
//     되돌려 버리는 일을 막기 위해서다.
//
//  5) 저장·공유
//     완성된 코스를 "내 여행"에 저장하거나 커뮤니티에 공유한다.
//
// 상태 흐름 요약
//     조건(useTripPlan) → 장소 풀(useCityPool) → buildCourse → course
//       → 편집(currentTimelineDays) → displayPlaces → 타임라인·지도에 표시
// ═════════════════════════════════════════════════════════════

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SignupScreen from './SignupScreen.jsx'
import { budgets, journeyThemes, SLOT_LABELS } from './data/travelOptions.js'
import { allDestinations, destinationCatalog, destinationGroups, fallbackCity } from './data/destinations.js'
import { buildCourse, insertManualBySlot } from './lib/course.js'
import { placeKindOf } from './lib/placeKind.js'
import { formatClock, parseClock, scheduleDay } from './lib/schedule.js'
import { formatStay } from './lib/stayTime.js'
import { feeLabelOf } from './lib/cost.js'
import { transitLabelOf } from './lib/transit.js'
import { fetchGeocode, resolveImageUrl } from './lib/api.js'
import { addDaysISO, durationLabelFromNights, formatShortDate, nightsBetween, parseDayCount, todayISO } from './lib/datetime.js'
import { useAuth } from './hooks/useAuth.js'
import { useCityHighlights } from './hooks/useCityHighlights.js'
import { useTripForecast } from './hooks/useTripForecast.js'
import { useCityPool } from './hooks/useCityPool.js'
import { useTripPlan } from './hooks/useTripPlan.js'
import { clearTripSession, loadTripSession, saveTripSession } from './lib/tripSession.js'
import { optimizeRouteOrder } from './lib/geo.js'
import CoursePoolNotice from './components/CoursePoolNotice.jsx'
import Icon from './components/Icon.jsx'
import KakaoRouteMap from './components/KakaoRouteMap.jsx'
import PlaceDetailModal from './components/PlaceDetailModal.jsx'
import ScheduleTimeline from './components/ScheduleTimeline.jsx'
import CourseDetail from './screens/CourseDetail.jsx'
import CommunityScreen from './screens/CommunityScreen.jsx'
import Segment from './components/Segment.jsx'
import TravelSketchHome from './components/TravelSketchHome.jsx'
import { KakaoMark, NaverMark } from './components/MapMarks.jsx'
import balgilLogoMark from './assets/balgil-logo-mark.webp'
import BudgetScreen from './screens/BudgetScreen.jsx'
import DatesScreen from './screens/DatesScreen.jsx'
import DestinationsScreen from './screens/DestinationsScreen.jsx'
import OriginScreen from './screens/OriginScreen.jsx'
import MustVisitScreen from './screens/MustVisitScreen.jsx'
import MyTripsScreen from './screens/MyTripsScreen.jsx'
import ThemeScreen from './screens/ThemeScreen.jsx'
import { saveTrip } from './lib/tripsApi.js'
import { sharePost } from './lib/communityApi.js'
import leftEdgeBg from './assets/left_bg.webp'
import rightEdgeBg from './assets/right_bg.webp'

// "오늘의 추천"용 날짜 시드 — 모듈 로드 시 한 번만 계산(렌더 중 Date.now() 호출 방지).
const DAY_SEED = Math.floor(Date.now() / 86400000)
const TODAY_CITY = destinationCatalog[DAY_SEED % destinationCatalog.length].name
const TODAY_THEME_ID = journeyThemes[DAY_SEED % journeyThemes.length].id

// "여행 일정 미리보기" 갤러리/카드에 쓰는 장소 종류별 이모지·라벨.
const KIND_EMOJI = {
  cafe: '☕',
  bar: '🍺',
  museum: '🖼️',
  viewpoint: '🌇',
  market: '🏮',
  themepark: '🎡',
  spa: '♨️',
  nature: '🌳',
  history: '🏛️',
  restaurant: '🍽️',
  sight: '📍',
}
const KIND_LABEL = {
  cafe: '카페',
  bar: '술집',
  museum: '전시',
  viewpoint: '전망',
  market: '시장',
  themepark: '테마파크',
  spa: '온천',
  nature: '자연',
  history: '고궁·유적',
  restaurant: '식당',
  sight: '명소',
}
const SLOT_EMOJI = { 오전: '🌤️', '점심 맛집': '🍽️', '오후 카페': '☕', 저녁: '🌙' }

// 코스 화면 저장 버튼의 평상시 레이블 (누른 뒤엔 "저장 중…" → "저장됨 ✓" 등으로 잠깐 바뀐다).
const SAVE_LABEL = '현재 여행 코스 저장'
// 커뮤니티 공유 버튼의 평상시 레이블.
const SHARE_LABEL = '커뮤니티에 공유'

// 지도 위 장소 정렬 방식.
// 코스 정렬 기준. distance = 이동거리 최소, slot = 시간대 순서 그대로.
const SORT_MODES = ['distance', 'slot']









// ─── 앱 본체 ─────────────────────────────────────────────────
function App() {
  // 새로고침 복원 — 첫 렌더에서 한 번만 읽는다. null 이면 평소대로 홈에서 시작.
  const [restored] = useState(loadTripSession)
  const restoredScreen = restored?.screen || 'home'

  const [screen, setScreen] = useState(restoredScreen)
  const [leaving, setLeaving] = useState(false)

  // 브라우저 뒤로/앞으로 버튼으로도 화면(screen)이 넘어가도록 History API 와 동기화한다.
  // popstate 로 들어온 화면 변경은 다시 pushState 하지 않도록 플래그로 걸러낸다.
  const skipHistoryPush = useRef(false)
  useEffect(() => {
    window.history.replaceState({ screen: restoredScreen }, '')
    const onPopState = (event) => {
      skipHistoryPush.current = true
      setLeaving(false)
      setScreen(event.state?.screen || 'home')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [restoredScreen])
  useEffect(() => {
    if (skipHistoryPush.current) {
      skipHistoryPush.current = false
      return
    }
    if (window.history.state?.screen === screen) return
    window.history.pushState({ screen }, '')
  }, [screen])

  // ── 화면 표시 상태 ──────────────────────────────────────────
  // 코스 자체가 아니라 "어떻게 보고 있는지"에 해당하는 값들.
  // 다크모드, 선택한 장소·날짜, 저장·공유 버튼의 문구 등.
  const [darkMode, setDarkMode] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(0)
  // 지도 구간 트레이싱을 "누를 때마다" 다시 트리거하려고, 같은 번호를 눌러도 값이 바뀌는 카운터.
  const [selectPulse, setSelectPulse] = useState(0)
  const selectPlace = useCallback((index) => {
    setSelectedPlace(index)
    setSelectPulse((n) => n + 1)
  }, [])
  const [selectedDay, setSelectedDay] = useState(restored?.view?.selectedDay || 0)
  const [dayStartTime, setDayStartTime] = useState(restored?.meta?.dayStartTime || '09:30')
  const [savedName, setSavedName] = useState(restored?.view?.savedName || '')
  const [copyState, setCopyState] = useState('공유')
  const [saveState, setSaveState] = useState(SAVE_LABEL) // 평상시 SAVE_LABEL, 누르면 저장 중… → 저장됨 ✓ / 로그인 필요 / 저장 실패
  // 타임라인에서 사용자가 편집한 결과. currentTimelineDays[일자] = 그 날의 방문 목록.
  const [currentTimelineDays, setCurrentTimelineDays] = useState(() => restored?.edits?.currentTimelineDays || [])
  // 사용자가 순서를 직접 바꾼 날(day index)의 집합. 이 날은 displayPlaces 가 거리 최적화
  // (optimizeRouteOrder)를 건너뛰고 사용자가 정한 순서를 그대로 쓴다 — 안 그러면 위/아래로
  // 옮긴 바로 다음 렌더에서 거리 계산이 다시 원래 순서로 되돌려버린다.
  const [manualOrderDays, setManualOrderDays] = useState(() => new Set(restored?.edits?.manualOrderDays || []))
  const mapInstRef = useRef(null)
  // 장소 카드 줄 끝의 "장소 추가" 카드가 아래 편집 타임라인으로 스크롤할 때 쓴다.
  const scheduleRef = useRef(null)
  const scrollToSchedule = useCallback(() => {
    scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const {
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
    mustVisit,
    setMustVisit,
    mustVisitInput,
    setMustVisitInput,
    addMustVisit,
    removeMustVisit,
    routeStartPoint,
    routeEndPoint,
    courseAnchors,
  } = useTripPlan(restored?.meta)

  // 코스 화면에 머무는 동안 작업 상태를 로컬 스냅샷으로 남긴다. 새로고침하거나 실수로
  // 탭을 닫았다 다시 열어도 보던 코스와 손으로 바꿔 놓은 순서가 그대로 돌아온다.
  //
  // 홈·목적지 화면으로 나가는 건 '새 여행을 시작한다'는 뜻이라 스냅샷을 지운다 — 안 그러면
  // 홈에서 새로고침했는데 지난 코스가 튀어나온다. 그 밖의 화면(내 여행·커뮤니티 등)에서는
  // 손대지 않아, 다녀와서 새로고침해도 편집이 살아 있게 한다.
  useEffect(() => {
    if (screen === 'home' || screen === 'destinations') {
      clearTripSession()
      return
    }
    if (screen !== 'course') return

    saveTripSession({
      screen,
      meta: {
        destination,
        pickedDestination,
        journeyTheme,
        budget,
        transport,
        style,
        tripStartDate,
        tripEndDate,
        duration,
        dayStartTime,
        mustVisit,
        tripOrigin,
        tripLodging,
      },
      edits: {
        currentTimelineDays,
        // Set 은 JSON 으로 못 내보내므로 배열로 펼쳐 저장한다.
        manualOrderDays: [...manualOrderDays],
      },
      view: { selectedDay, savedName },
    })
  }, [
    screen,
    destination,
    pickedDestination,
    journeyTheme,
    budget,
    transport,
    style,
    tripStartDate,
    tripEndDate,
    duration,
    dayStartTime,
    mustVisit,
    tripOrigin,
    tripLodging,
    currentTimelineDays,
    manualOrderDays,
    selectedDay,
    savedName,
  ])

  const {
    user,
    needsProfile,
    refreshProfile,
    authOpen,
    setAuthOpen,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authMessage,
    authLoading,
    socialLoading,
    submitLogin,
    signOut,
    signInWithGoogle,
    signInWithKakao,
    closeAuthPanel,
  } = useAuth()

  const cityKey = allDestinations.find((item) => destination.includes(item.name))?.name || fallbackCity
  const { data: cityData, status: cityPoolStatus, retry: retryCityPool } = useCityPool(cityKey)
  const { photos: cityPhotos, trends: cityTrends } = useCityHighlights()

  // "오늘의 추천 AI 코스" — 날짜로 도시·테마를 회전시켜 매일 다른 1일 코스를 보여준다.
  // ── 오늘의 추천 코스 ────────────────────────────────────────
  // 조건을 하나도 고르지 않은 사람에게 결과부터 보여 주기 위한 코스.
  const todayCity = TODAY_CITY
  const todayThemeId = TODAY_THEME_ID
  const { data: todayPool, status: todayStatus, retry: retryTodayPool } = useCityPool(todayCity)
  const todayCourse = useMemo(
    () =>
      (todayPool
        ? buildCourse(todayPool, todayThemeId, '보통', [], {}, '대중교통', { dayCount: 1, dayStartMin: 10 * 60 })
        : null),
    [todayPool, todayThemeId],
  )

  // ── 코스 생성 ───────────────────────────────────────────────
  // 아래 블록이 이 앱의 본체다. 조건 → 장소 풀 → 날씨 → buildCourse 순으로
  // 재료를 모아 코스를 만든다.
  const dayCount = parseDayCount(duration)
  const dayStartMin = parseClock(dayStartTime)

  // 여행 날짜 구간의 일자별 예보 → 비/눈 오는 날은 buildCourse 가 실내 위주로 코스를 짠다.
  const tripForecast = useTripForecast(cityKey, cityData?.center, tripStartDate, tripEndDate)
  const wetDays = useMemo(() => {
    const WET_MAIN = new Set(['Rain', 'Drizzle', 'Thunderstorm', 'Snow'])
    return Array.from({ length: dayCount }, (_, d) => {
      const forecastDay = tripForecast.find((item) => item.date === addDaysISO(tripStartDate, d))
      return Boolean(forecastDay?.available && WET_MAIN.has(forecastDay.main))
    })
  }, [tripForecast, tripStartDate, dayCount])

  const course = useMemo(
    () =>
      (cityData
        ? buildCourse(cityData, journeyTheme, budget, mustVisit, courseAnchors, transport, {
            tripDate: tripStartDate,
            dayCount,
            dayStartMin,
            wetDays,
          })
        : null),
    [cityData, journeyTheme, budget, mustVisit, courseAnchors, transport, tripStartDate, dayCount, dayStartMin, wetDays],
  )
  // 도시/테마/예산/일수가 바뀌면 추천 코스 자체가 달라지므로, 타임라인에서 손으로 편집한 결과는
  // 버리고 새 추천으로 되돌아간다. (예전 ScheduleTimeline 은 이 조합을 key 로 묶어 컴포넌트를
  // 통째로 재마운트하는 방식으로 같은 일을 했다. 여기선 렌더 중에 비교해서 같은 일을 한다 —
  // effect 안에서 setState 하면 렌더가 한 번 더 도는데, 렌더 중에 판단하면 그럴 필요가 없다.)
  const timelineResetKey = `${cityKey}:${journeyTheme || '-'}:${budget || '-'}:${dayCount}`
  const [lastTimelineResetKey, setLastTimelineResetKey] = useState(timelineResetKey)
  if (timelineResetKey !== lastTimelineResetKey) {
    setLastTimelineResetKey(timelineResetKey)
    setCurrentTimelineDays([])
    setManualOrderDays(new Set())
  }
  const placeByName = useMemo(
    () => new Map((cityData?.pool || []).map((place) => [place.name, place])),
    [cityData],
  )
  // 지금 보고 있는 날(selectedDay)의 장소들. 타임라인을 편집했으면 그 결과를, 아니면 추천 코스를 쓴다.
  const activeDayPlaces = useMemo(
    () => (currentTimelineDays.length
      ? (currentTimelineDays[selectedDay] || [])
      : (course?.days?.[selectedDay]?.places || [])),
    [currentTimelineDays, selectedDay, course],
  )
  // 풀 정보(카테고리·영업시간)와 합친 뒤, 하루 시작 시각 기준으로 도착 시각을 다시 계산한다.
  // (course.days 는 buildCourse 가 이미 스케줄해 두지만, 타임라인에서 편집된 날도 여기서 똑같이 시각이 매겨지도록 한 번 더 돌린다.)
  const displayPlaces = useMemo(() => {
    const merged = activeDayPlaces.map((place, index) => ({
      ...placeByName.get(place.name),
      ...place,
      assignedSlot: place.assignedSlot || SLOT_LABELS[Math.min(index, SLOT_LABELS.length - 1)],
    }))
    let ordered
    if (manualOrderDays.has(selectedDay)) {
      // 사용자가 이 날의 순서를 위/아래 버튼으로 직접 바꿨으면, 거리 최적화를 건너뛰고
      // 저장된 순서를 그대로 쓴다 — 안 그러면 바로 다음 렌더에서 optimizeRouteOrder 가 되돌려버린다.
      ordered = merged
    } else {
      // 거리 최적화(optimizeRouteOrder)는 추천 코스 장소만 대상으로 한다. 직접 추가한 장소를
      // 같이 넣으면 좌표가 가깝다는 이유만으로 시간대 라벨과 무관하게 아무 자리에나 꽂힌다.
      const recommended = merged.filter((place) => !place.manual)
      const manual = merged.filter((place) => place.manual)
      ordered = insertManualBySlot(optimizeRouteOrder(recommended, courseAnchors), manual)
    }
    return scheduleDay(ordered, { dayStartMin, transport })
  }, [activeDayPlaces, placeByName, dayStartMin, transport, courseAnchors, manualOrderDays, selectedDay])
  // "여행 일정 미리보기" 패널용: 모든 날짜를 한 번에 시각까지 매겨 슬롯별로 묶는다.
  const allDaysScheduled = useMemo(() => {
    const daysSource = currentTimelineDays.length
      ? currentTimelineDays
      : (course?.days || []).map((day) => day.places)
    return daysSource.map((dayPlaces) => {
      const merged = dayPlaces.map((place, index) => ({
        ...placeByName.get(place.name),
        ...place,
        assignedSlot: place.assignedSlot || SLOT_LABELS[Math.min(index, SLOT_LABELS.length - 1)],
      }))
      return scheduleDay(merged, { dayStartMin, transport })
    })
  }, [currentTimelineDays, course, placeByName, dayStartMin, transport])
  // 지금까지 어느 날에든 들어간 장소 이름(추천 코스 + 편집 결과) 전체.
  // "장소 추가" 검색에서 이미 일정에 있는 곳은 후보로 다시 띄우지 않으려고 쓴다.
  const usedPlaceNames = useMemo(
    () => new Set(allDaysScheduled.flatMap((dayPlaces) => dayPlaces.map((place) => place.name))),
    [allDaysScheduled],
  )
  const journeyThemeLabel = (journeyThemes.find((item) => item.id === journeyTheme) || {}).label || ''

  // 새 코스 상세 화면(CourseDetail)이 쓰는 모양으로 변환한다.
  // 장소: 타임라인 카드에 필요한 필드만 골라서.
  // 사진은 서버가 풀에 실어 준 대표 사진(관광지=TourAPI, 맛집·카페=Google Places 프록시).
  // 없는 곳은 빈 문자열이고, 카드가 알아서 자리표시 타일로 대체한다.
  const coursePlaces = useMemo(
    () =>
      displayPlaces.map((place, index) => ({
        id: place.name,
        order: index + 1,
        name: place.name,
        kind: placeKindOf(place),
        bestTime: place.assignedSlot,
        // 사용자가 직접 적은 "꼭 가고 싶은 곳"인지 — 타임라인 카드에 배지로 표시된다.
        mustVisit: Boolean(place.mustVisit),
        timeRange: Number.isFinite(place.arriveMin)
          ? `${formatClock(place.arriveMin)} – ${formatClock(place.departMin)}`
          : '',
        image: resolveImageUrl(place.imageUrl),
        // 딥데이터(별점·리뷰수·한줄요약·홈페이지)는 지금은 맛집·카페(Google 소스)만 값이 있다.
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? null,
        editorialSummary: place.editorialSummary || '',
        websiteUrl: place.websiteUrl || '',
        desc: place.reason,
        tip: place.caution,
        note: place.hoursNote,
        address: place.address,
        parking: place.parking,
        location: place.location,
        fee: feeLabelOf(place),
        stay: formatStay(place.stayMin ?? 60),
        openHoursText: place.openHoursText,
        closedDayText: place.closedDayText,
        transit: transitLabelOf(place),
      })),
    [displayPlaces],
  )
  // 이동 구간: scheduleDay 가 붙여 준 travelToNextMin 을 그대로 쓴다(장소 인덱스와 1:1로 맞음).
  const courseRoutes = useMemo(() => {
    const mode = transport === '도보' ? 'walk' : transport === '자차' ? 'car' : 'bus'
    return displayPlaces.slice(0, -1).map((place, index) => ({
      from: place.name,
      to: displayPlaces[index + 1].name,
      mode,
      line: transport,
      duration: Number.isFinite(place.travelToNextMin) ? `${place.travelToNextMin}분` : null,
    }))
  }, [displayPlaces, transport])

  // 코스 화면 지도 카드의 확대/축소·처음 위치 버튼 (KakaoRouteMap 이 onMapReady 로 넘겨준 지도 인스턴스를 조작).
  const zoomMap = (delta) => {
    const map = mapInstRef.current
    if (map) map.setLevel(map.getLevel() + delta)
  }
  // "전체 보기": 오늘 장소가 전부 들어오게 범위를 맞춘다. (좌표가 없으면 도시 중심으로)
  const recenterMap = () => {
    const map = mapInstRef.current
    if (!map || !window.kakao?.maps) return
    const located = displayPlaces.filter((place) => place.location)
    if (located.length > 1) {
      const bounds = new window.kakao.maps.LatLngBounds()
      located.forEach((place) => bounds.extend(new window.kakao.maps.LatLng(place.location.lat, place.location.lng)))
      map.setBounds(bounds, 60, 60, 60, 60)
      return
    }
    const center = located[0]?.location || cityData?.center
    if (center) {
      map.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng))
      map.setLevel(5)
    }
  }
  // selectedPlace 는 그대로 두고, 읽을 때만 현재 날의 장소 수에 맞춰 눌러 쓴다 (날 전환·타임라인 편집으로 범위가 줄어도 안전).
  const safeSelectedPlace = Math.min(selectedPlace, Math.max(displayPlaces.length - 1, 0))
  const detail = displayPlaces[safeSelectedPlace] || displayPlaces[0] || null


  const goToSignup = () => {
    closeAuthPanel()
    setScreen('signup')
  }

  // 로그인 팝오버는 바깥 클릭(.auth-backdrop) 말고 Esc 로도 닫힌다 — 모달 관례에 맞춘다.
  useEffect(() => {
    if (!authOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeAuthPanel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [authOpen, closeAuthPanel])

  // 홈 화면 '여행 시작하기': 입력한 목적지로 바로 코스로 가지 않고
  // 테마 -> 예산 -> 날짜(날씨) -> 코스 순서의 단계 흐름으로 들어간다.
  const startCourse = () => {
    const typed = destination.trim()
    if (!typed) return
    setPickedDestination(typed)
    setJourneyTheme('')
    setTripStartDate(todayISO())
    setTripEndDate(todayISO())
    setDayStartTime('09:30')
    slideTo('themes')
  }

  // 현재 화면을 슬라이드로 내보내고 다음 화면을 슬라이드로 들여온다. (홈 -> 여행지 목록 -> 테마 목록)
  const slideTo = (next) => {
    if (screen === next) return
    setLeaving(true)
    window.setTimeout(() => {
      setScreen(next)
      setLeaving(false)
    }, 380)
  }

  // 목차(여행지 카드 / 상단 '목적지') -> 국내 여행지 카탈로그
  const goToDestinations = () => slideTo('destinations')

  // 여행지 카탈로그에서 한 곳을 고르면 -> 테마 선택 화면
  const pickDestination = (name) => {
    setPickedDestination(name)
    setJourneyTheme('')
    setTripStartDate(todayISO())
    setTripEndDate(todayISO())
    setDayStartTime('09:30')
    slideTo('themes')
  }

  // "오늘의 추천 AI 코스" 시작 -> 오늘의 도시·테마를 미리 넣고 예산 선택부터.
  const startTodayCourse = () => {
    setPickedDestination(todayCity)
    setDestination(todayCity)
    setJourneyTheme(todayThemeId)
    setTripStartDate(todayISO())
    setTripEndDate(todayISO())
    setDayStartTime('09:30')
    slideTo('budget')
  }

  // 테마를 고르면 -> 예산 선택 화면
  const pickTheme = (themeId) => {
    setJourneyTheme(themeId)
    slideTo('budget')
  }

  // 예산을 고르면 -> 날짜(+날씨) 선택 화면
  const pickBudget = (budgetValue) => {
    setBudget(budgetValue)
    slideTo('dates')
  }

  // 출발일/귀가일을 고르면 -> 기간을 duration 라벨로 반영하고 출발지/숙소 화면으로.
  const pickDates = () => {
    const nights = nightsBetween(tripStartDate, tripEndDate)
    setDuration(durationLabelFromNights(nights))
    slideTo('origin')
  }

  // 출발지(필수) + 숙소(선택)를 확정하면 -> "꼭 들르고 싶은 곳" 화면으로 슬라이드한다.
  const confirmOrigin = (origin, lodging) => {
    const themeObj = journeyThemes.find((item) => item.id === journeyTheme)
    const dest = pickedDestination || destination
    setTripOrigin(origin)
    setTripLodging(lodging)
    setDestination(dest)
    setSelectedPlace(0)
    setSelectedDay(0)
    setCurrentTimelineDays([])
    setSavedName(`${dest} ${themeObj ? themeObj.label : ''} 여행`.replace(/\s+/g, ' ').trim())
    slideTo('mustvisit')
  }

  // "꼭 들르고 싶은 곳"까지 정리하면 -> 코스 화면으로 슬라이드한다.
  const confirmMustVisit = () => {
    slideTo('course')
  }

  const shareCourse = async () => {
    const daysForShare = currentTimelineDays.length
      ? currentTimelineDays
      : (course?.days || []).map((day) => day.places)
    const body = daysForShare
      .map((dayPlaces, d) => {
        const timed = scheduleDay(
          dayPlaces.map((place, index) => ({
            ...placeByName.get(place.name),
            ...place,
            assignedSlot: place.assignedSlot || SLOT_LABELS[Math.min(index, SLOT_LABELS.length - 1)],
          })),
          { dayStartMin, transport },
        )
        const line = timed.map((place) => `${formatClock(place.arriveMin)} ${place.name}`).join(' → ')
        return `[Day ${d + 1}] ${line}`
      })
      .join('\n')
    const text = `${savedName}\n${body}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('복사됨')
      setTimeout(() => setCopyState('공유'), 1400)
    } catch {
      setCopyState('복사 실패')
      setTimeout(() => setCopyState('공유'), 1400)
    }
  }

  // 지금 보고 있는 코스를 "내 여행"에 저장한다. 로그인 안 했으면 로그인 패널을 연다.
  // 지금 보고 있는 코스를 커뮤니티에 공개한다. payload 모양은 "내 여행" 저장과 동일.
  const [shareState, setShareState] = useState(SHARE_LABEL)
  const shareToCommunity = async () => {
    if (!user) {
      setAuthOpen(true)
      setShareState('로그인 필요')
      setTimeout(() => setShareState(SHARE_LABEL), 1800)
      return
    }
    const days = (allDaysScheduled.length ? allDaysScheduled : (course?.days || []).map((day) => day.places)).map(
      (dayPlaces) => dayPlaces.map((place) => ({ name: place.name, assignedSlot: place.assignedSlot || null })),
    )
    // 출발지·숙소는 일부러 담지 않는다. 출발지에는 집 주소를, 숙소에는 실제 묵는 곳을
    // 적는 경우가 많아서, 공개되는 글에 그대로 실리면 안 된다.
    const payload = {
      meta: {
        destination: pickedDestination || destination,
        journeyTheme, budget, transport, style, tripStartDate, tripEndDate, duration, dayStartTime, mustVisit,
      },
      days,
    }
    setShareState('공유 중…')
    try {
      await sharePost({
        title: savedName.trim() || `${cityKey} ${journeyThemeLabel} 여행`.replace(/\s+/g, ' ').trim(),
        city: cityKey,
        dayCount,
        summary: `${duration} · ${budget} · ${transport}`,
        body: course?.subtitle || '',
        rating: 5,
        payload,
      })
      setShareState('공유됨 ✓')
      setTimeout(() => setShareState(SHARE_LABEL), 2200)
    } catch (error) {
      if (error.status === 401) {
        setAuthOpen(true)
        setShareState('로그인 필요')
      } else {
        setShareState(error.message?.slice(0, 20) || '공유 실패')
      }
      setTimeout(() => setShareState(SHARE_LABEL), 2200)
    }
  }

  const saveCourse = async () => {
    if (!user) {
      setAuthOpen(true)
      setSaveState('로그인 필요')
      setTimeout(() => setSaveState(SAVE_LABEL), 1800)
      return
    }
    const days = (allDaysScheduled.length ? allDaysScheduled : (course?.days || []).map((day) => day.places)).map(
      (dayPlaces) => dayPlaces.map((place) => ({ name: place.name, assignedSlot: place.assignedSlot || null })),
    )
    const payload = {
      meta: {
        destination: pickedDestination || destination,
        journeyTheme,
        budget,
        transport,
        style,
        tripStartDate,
        tripEndDate,
        duration,
        dayStartTime,
        mustVisit,
        // 출발지·숙소도 함께 저장한다. days 에는 들르는 장소만 들어 있어서, 이게 없으면
        // 다시 열었을 때 동선의 시작점·끝점이 사라진다(숙소를 적은 것이 없던 일이 된다).
        // "내 여행"은 본인만 보는 기록이라 주소를 담아도 된다 — 커뮤니티 공유 쪽은
        // 집 주소가 공개될 수 있어 일부러 빼 두었다.
        tripOrigin,
        tripLodging,
      },
      days,
    }
    setSaveState('저장 중…')
    try {
      await saveTrip({ title: savedName.trim() || `${cityKey} 여행`, city: cityKey, dayCount, payload })
      setSaveState('저장됨 ✓')
      setTimeout(() => setSaveState(SAVE_LABEL), 1800)
    } catch (error) {
      if (error.status === 401) {
        setAuthOpen(true)
        setSaveState('로그인 필요')
      } else {
        setSaveState('저장 실패')
      }
      setTimeout(() => setSaveState(SAVE_LABEL), 1800)
    }
  }

  // "내 여행"에서 저장된 여행을 골라 같은 조건으로 코스를 다시 계획한다.
  const replanFromSaved = (payload, title) => {
    const meta = payload?.meta || {}
    const dest = meta.destination || ''
    setDestination(dest)
    setPickedDestination(dest)
    setJourneyTheme(meta.journeyTheme || '')
    setBudget(meta.budget || '보통')
    setTransport(meta.transport || '대중교통')
    setTripStartDate(meta.tripStartDate || todayISO())
    setTripEndDate(meta.tripEndDate || meta.tripStartDate || todayISO())
    setDuration(meta.duration || '당일')
    setDayStartTime(meta.dayStartTime || '09:30')
    setMustVisit(Array.isArray(meta.mustVisit) ? meta.mustVisit : [])
    // 저장할 때 함께 담아 둔 출발지·숙소를 되살린다. 예전에 저장한 코스에는 이 값이 없어서
    // (그때는 저장하지 않았다) null 로 떨어지고, 그러면 앵커 없이 코스를 다시 짠다.
    setTripOrigin(meta.tripOrigin || null)
    setTripLodging(meta.tripLodging || null)
    setSelectedPlace(0)
    setSelectedDay(0)
    setCurrentTimelineDays([])
    setSavedName(title || `${dest} 여행`.trim())
    setScreen('course')
  }

  const handleTimelineDaysChange = useCallback((nextDays) => {
    setCurrentTimelineDays(nextDays)
  }, [])

  // 아직 한 번도 손으로 편집한 적 없으면, 지금 추천 코스(course.days)를 편집 가능한 형태로 복제해
  // 그 자리에서 시작한다. name/location/assignedSlot 만 남기는 이유는 나머지(영업시간·사진 등)는
  // placeByName 으로 다시 채워지기 때문 — course.days 의 스냅샷이 아니라 항상 최신 풀 데이터를 보여준다.
  const editableDaysFromCourse = useCallback(
    () =>
      (course?.days || []).map((day) =>
        // manual·mustVisit 플래그도 같이 넘긴다. 이게 빠지면 좌표 없는 장소(직접 적은 곳)가
        // 거리 최적화 대상으로 들어가 시간대와 무관하게 맨 뒤로 밀려난다.
        day.places.map((place) => ({
          name: place.name,
          location: place.location,
          assignedSlot: place.assignedSlot,
          manual: place.manual,
          mustVisit: place.mustVisit,
        })),
      ),
    [course],
  )

  // 코스 화면에서 "장소 추가"로 고른 장소(도시 풀에서 골랐거나, geocode 로 좌표만 확보한 곳)를
  // 그 날 일정 맨 뒤에 붙인다. candidate: { name, location?, assignedSlot? }
  const handleAddPlace = useCallback((dayIndex, candidate) => {
    const base = currentTimelineDays.length ? currentTimelineDays : editableDaysFromCourse()
    if (!base[dayIndex]) return
    const next = base.map((list) => list.slice())
    // manual: true 로 표시해 둔다 — 거리 최적화(optimizeRouteOrder)에는 안 넣고, 시간대 자리에
    // 따로 끼워 넣기 위해 추천 코스 장소와 구분해야 한다 (insertManualBySlot 참고).
    next[dayIndex] = [...next[dayIndex], { ...candidate, manual: true }]
    handleTimelineDaysChange(next)
  }, [currentTimelineDays, editableDaysFromCourse, handleTimelineDaysChange])

  // 지금 보고 있는 날(selectedDay)에서 카드를 위/아래로 옮긴다. fromIndex/toIndex 는 화면에 보이는
  // displayPlaces 기준 — 사용자가 실제로 보는 순서와 저장되는 순서가 항상 같아야 하므로 그대로 쓴다.
  const handleMovePlace = useCallback((fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= displayPlaces.length || fromIndex === toIndex) return
    const next = displayPlaces.map((place) => ({
      name: place.name,
      location: place.location,
      assignedSlot: place.assignedSlot,
      manual: place.manual,
    }))
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)

    const baseDays = currentTimelineDays.length ? currentTimelineDays.map((list) => list.slice()) : editableDaysFromCourse()
    if (!baseDays[selectedDay]) return
    baseDays[selectedDay] = next
    setManualOrderDays((prev) => {
      const nextSet = new Set(prev)
      nextSet.add(selectedDay)
      return nextSet
    })
    handleTimelineDaysChange(baseDays)
  }, [displayPlaces, currentTimelineDays, editableDaysFromCourse, selectedDay, handleTimelineDaysChange])


  // ── 화면 그리기 ─────────────────────────────────────────────
  // 아래부터는 JSX. screen 값에 따라 해당 화면 컴포넌트를 하나씩 보여 준다.
  const mapUrl = detail ? `https://map.kakao.com/link/search/${encodeURIComponent(`${cityKey} ${detail.name}`)}` : ''

  return (
    <main className={darkMode ? 'app dark' : 'app'}>
      <div className="edge-bg edge-bg-left" style={{ backgroundImage: `url(${leftEdgeBg})` }} aria-hidden="true" />
      <div className="edge-bg edge-bg-right" style={{ backgroundImage: `url(${rightEdgeBg})` }} aria-hidden="true" />

      <div className={screen === 'course' && course ? 'app-stage stage-course' : 'app-stage'}>
      <nav className="topbar">
        <button className="brand" type="button" onClick={() => slideTo('home')} aria-label="홈으로 이동">
          <img src={balgilLogoMark} alt="" aria-hidden="true" className="brand-logo" />
          <span>발길따라</span>
        </button>
        <div className="nav-links">
          <button className={screen === 'home' ? 'active' : ''} type="button" onClick={() => slideTo('home')}>홈</button>
          <button className={screen === 'destinations' ? 'active' : ''} type="button" onClick={goToDestinations}>목적지</button>
          <button className={screen === 'course' ? 'active' : ''} type="button" onClick={() => setScreen('course')}>여행 코스</button>
          <button className={screen === 'mytrips' ? 'active' : ''} type="button" onClick={() => setScreen('mytrips')}>내 여행</button>
          <button className={screen === 'community' ? 'active' : ''} type="button" onClick={() => setScreen('community')}>커뮤니티</button>
        </div>
        <div className="top-actions">
          {user && <span className="user-email">{user.email || user.name}</span>}
          {user ? (
            <button className="auth-button" type="button" onClick={signOut}>로그아웃</button>
          ) : (
            <button className="auth-button" type="button" onClick={() => setAuthOpen((value) => !value)}>
              로그인
            </button>
          )}
          <button className="theme-toggle" type="button" onClick={() => setDarkMode((value) => !value)}>
          {darkMode ? '라이트모드' : '다크모드'}
          </button>
        </div>
      </nav>

      {authOpen && !user && (
        <>
          {/* 뒤를 살짝 눌러 주는 막 — 클릭하면 닫힌다. 화면을 가리지 않을 만큼만 어둡게. */}
          <div className="auth-backdrop" onClick={closeAuthPanel} aria-hidden="true" />
          <section className="auth-panel" role="dialog" aria-modal="true" aria-label="로그인">
            <div className="auth-card">
              <button className="auth-close" type="button" onClick={closeAuthPanel} aria-label="닫기">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>

              <div className="auth-head">
                <img src={balgilLogoMark} alt="" aria-hidden="true" className="auth-logo" />
                <div className="auth-head-text">
                  <p className="auth-welcome">다시 만나 반가워요</p>
                  <p className="auth-sub">로그인하고 나만의 여행 기록을 이어가세요</p>
                </div>
              </div>

              <div className="auth-tabs">
                <button className="selected" type="button" aria-current="page">
                  로그인
                </button>
                <button type="button" onClick={goToSignup}>
                  회원가입
                </button>
              </div>

              <form onSubmit={submitLogin}>
                <label>
                  <span className="auth-field-label">이메일</span>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="travel@balgil.kr"
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  <span className="auth-field-label">비밀번호</span>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="6자 이상"
                    autoComplete="current-password"
                    minLength="6"
                    required
                  />
                </label>
                {authMessage && <p className="auth-message">{authMessage}</p>}
                <button type="submit" disabled={authLoading}>
                  {authLoading ? '처리 중...' : '로그인'}
                </button>
              </form>

              <div className="auth-divider">
                <span>또는</span>
              </div>

              <div className="auth-social">
                <button
                  type="button"
                  className="auth-social-button is-google"
                  onClick={signInWithGoogle}
                  disabled={Boolean(socialLoading)}
                >
                  <svg className="auth-social-icon" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                  </svg>
                  {socialLoading === 'google' ? '구글로 연결 중...' : '구글로 계속하기'}
                </button>
                <button
                  type="button"
                  className="auth-social-button is-kakao"
                  onClick={signInWithKakao}
                  disabled={Boolean(socialLoading)}
                >
                  <svg className="auth-social-icon" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#3C1E1E" d="M9 1.5c-4.14 0-7.5 2.6-7.5 5.82 0 2.06 1.38 3.87 3.46 4.9-.15.53-.55 1.98-.63 2.29-.1.38.14.38.3.27.12-.08 1.9-1.28 2.67-1.8.55.08 1.12.13 1.7.13 4.14 0 7.5-2.6 7.5-5.79S13.14 1.5 9 1.5z" />
                  </svg>
                  {socialLoading === 'kakao' ? '카카오로 연결 중...' : '카카오로 계속하기'}
                </button>
              </div>

              <p className="auth-hint">
                아직 계정이 없으신가요?{' '}
                <button type="button" className="auth-link" onClick={goToSignup}>
                  회원가입하기
                </button>
              </p>
            </div>
          </section>
        </>
      )}

      {needsProfile ? (
        <SignupScreen
          mode="complete"
          onBack={signOut}
          onSuccess={() => refreshProfile()}
        />
      ) : screen === 'signup' ? (
        <SignupScreen
          onBack={() => setScreen('home')}
          onSuccess={() => {
            refreshProfile()
            setScreen('home')
          }}
        />
      ) : screen === 'themes' ? (
        <ThemeScreen
          items={journeyThemes}
          destination={pickedDestination}
          selected={journeyTheme}
          onSelect={pickTheme}
          onBack={() => slideTo('destinations')}
          leaving={leaving}
        />
      ) : screen === 'dates' ? (
        <DatesScreen
          destination={pickedDestination}
          startDate={tripStartDate}
          endDate={tripEndDate}
          startTime={dayStartTime}
          onChangeStart={setTripStartDate}
          onChangeEnd={setTripEndDate}
          onChangeStartTime={setDayStartTime}
          onNext={pickDates}
          onBack={() => slideTo('budget')}
          leaving={leaving}
        />
      ) : screen === 'origin' ? (
        <OriginScreen
          destination={pickedDestination}
          nights={nightsBetween(tripStartDate, tripEndDate)}
          initialOrigin={tripOrigin}
          initialLodging={tripLodging}
          onConfirm={confirmOrigin}
          onBack={() => slideTo('dates')}
          leaving={leaving}
        />
      ) : screen === 'mustvisit' ? (
        <MustVisitScreen
          destination={pickedDestination}
          mustVisit={mustVisit}
          mustVisitInput={mustVisitInput}
          onAddMustVisit={addMustVisit}
          onChangeMustVisitInput={setMustVisitInput}
          onRemoveMustVisit={removeMustVisit}
          onNext={confirmMustVisit}
          onBack={() => slideTo('origin')}
          leaving={leaving}
        />
      ) : screen === 'budget' ? (
        <BudgetScreen
          options={budgets}
          destination={pickedDestination}
          theme={journeyThemeLabel}
          selected={budget}
          onSelect={pickBudget}
          onBack={() => slideTo('themes')}
          leaving={leaving}
        />
      ) : screen === 'destinations' ? (
        <DestinationsScreen
          items={destinationCatalog}
          groups={destinationGroups}
          photos={cityPhotos}
          trends={cityTrends}
          onPick={pickDestination}
          onBack={() => setScreen('home')}
          leaving={leaving}
        />
      ) : screen === 'home' ? (
        <TravelSketchHome
          cityPhotos={cityPhotos}
          destination={destination}
          leaving={leaving}
          todayCity={todayCity}
          todayCourse={todayCourse}
          todayStatus={todayStatus}
          onChangeDestination={setDestination}
          onPickCity={pickDestination}
          onRetryToday={retryTodayPool}
          onStartCourse={startCourse}
          onStartToday={startTodayCourse}
        />
      ) : screen === 'community' ? (
        <CommunityScreen
          user={user}
          leaving={leaving}
          onRequireLogin={() => setAuthOpen(true)}
          onBack={() => setScreen('home')}
        />
      ) : screen === 'mytrips' ? (
        <MyTripsScreen
          user={user}
          leaving={leaving}
          onRequireLogin={() => setAuthOpen(true)}
          onReplan={replanFromSaved}
          onBack={() => setScreen('home')}
        />
      ) : !course ? (
        <CoursePoolNotice
          cityKey={cityKey}
          status={cityPoolStatus}
          onRetry={retryCityPool}
          onBack={() => setScreen('home')}
        />
      ) : (
        <section className="course-screen">
          <div className="course-controls">
            <div className="course-ctl course-ctl-dest">
              <span className="course-ctl-label">목적지</span>
              <span className="course-dest-input">
                <span className="course-dest-pin" aria-hidden="true"><Icon type="pin" /></span>
                <input value={pickedDestination || destination || cityKey} readOnly aria-label="목적지" />
                <button type="button" onClick={() => setScreen('destinations')} aria-label="목적지 변경">×</button>
              </span>
            </div>
            <div className="course-ctl course-ctl-theme">
              <span className="course-ctl-label">여행 테마</span>
              <div className="course-theme-chips" role="group" aria-label="여행 테마">
                {journeyThemes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={journeyTheme === item.id ? 'course-theme-chip is-active' : 'course-theme-chip'}
                    onClick={() => setJourneyTheme(item.id)}
                  >
                    <span className="course-theme-chip-ic" aria-hidden="true"><Icon type={item.icon} /></span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="course-share-community-btn" onClick={shareToCommunity}>
              <span aria-hidden="true">♡</span> {shareState}
            </button>
            <button type="button" className="course-make-btn" onClick={scrollToSchedule}>
              <span aria-hidden="true">☆</span> 코스 만들기
            </button>
          </div>

          {/* 코스를 짜면서 생긴 안내(휴무로 뺀 곳, 비 오는 날 실내 위주, 위치를 못 찾은 필수 방문 등).
              buildCourse 가 만들어 두기만 하고 화면에 나오지 않던 것을 여기서 보여 준다 —
              "왜 이렇게 나왔는지"를 알려 주지 않으면 앱이 빠뜨린 것으로 오해하게 된다. */}
          {(course?.notices || []).length > 0 && (
            <ul className="course-notices">
              {course.notices.map((text) => (
                <li className="course-notice" key={text}>{text}</li>
              ))}
            </ul>
          )}

          {/* 출발지·숙소(startAnchor·endAnchor)는 들르는 장소가 아니라 하루의 시작점·끝점이라
              타임라인 위아래에 고정 카드로만 보여 준다. 코스 장소 목록(displayPlaces)에는
              넣지 않는다 — 넣으면 지도에 같은 지점이 번호 마커로 한 번 더 찍히고,
              거리 최적화 대상이 돼 앵커로 고정해 둔 의미가 사라진다. */}
          <CourseDetail
            day={{
              no: selectedDay + 1,
              date: formatShortDate(addDaysISO(tripStartDate, selectedDay)),
              region: pickedDestination || cityKey,
            }}
            days={course.days.map((_, d) => ({ label: formatShortDate(addDaysISO(tripStartDate, d)) }))}
            activeDay={selectedDay}
            onSelectDay={(d) => {
              setSelectedDay(d)
              setSelectedPlace(0)
            }}
            places={coursePlaces}
            routes={courseRoutes}
            selectedIndex={safeSelectedPlace}
            onPickPlace={(index) => selectPlace(index)}
            onMovePlace={handleMovePlace}
            pool={cityData?.pool || []}
            excludeNames={usedPlaceNames}
            onAddPlace={(candidate) => handleAddPlace(selectedDay, candidate)}
            onGeocode={fetchGeocode}
            startAnchor={
              routeStartPoint
                ? { name: routeStartPoint.label, address: routeStartPoint.address, kind: 'origin' }
                : null
            }
            endAnchor={
              routeEndPoint
                ? {
                    name: routeEndPoint.label,
                    address: routeEndPoint.address,
                    kind: routeEndPoint.isLodging ? 'lodging' : 'return',
                  }
                : null
            }
            moveLabel={transport}
            transport={transport}
            onChangeTransport={setTransport}
            onZoomIn={() => zoomMap(-1)}
            onZoomOut={() => zoomMap(1)}
            onRecenter={recenterMap}
            actions={{
              onSave: saveCourse,
              saveLabel: saveState,
              onShare: shareCourse,
              shareLabel: copyState,
              onOpenMap: mapUrl ? () => window.open(mapUrl, '_blank', 'noopener') : undefined,
            }}
            mapSlot={
              <KakaoRouteMap
                course={course}
                places={displayPlaces}
                origin={routeStartPoint}
                endPoint={routeEndPoint}
                transport={transport}
                selectedPlace={safeSelectedPlace}
                selectPulse={selectPulse}
                onSelectPlace={selectPlace}
                onMapReady={(map) => {
                  mapInstRef.current = map
                }}
              />
            }
          />

        </section>
      )}
      </div>
    </main>
  )
}

// 최근 3일 평균 검색량이 그 이전 기간 평균보다 이 배수 이상이면 "지금 뜨는 중" 배지를 붙인다.

export default App
