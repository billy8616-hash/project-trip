import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SignupScreen from './SignupScreen.jsx'
import { budgets, journeyThemes, SLOT_LABELS, transports } from './data/travelOptions.js'
import { allDestinations, destinationCatalog, destinationGroups, fallbackCity } from './data/destinations.js'
import { buildCourse } from './lib/course.js'
import { placeKindOf } from './lib/placeKind.js'
import { formatClock, parseClock, scheduleDay } from './lib/schedule.js'
import { formatStay } from './lib/stayTime.js'
import { formatDurationMin } from './lib/travelTime.js'
import { estimateDayCost, feeLabelOf } from './lib/cost.js'
import { transitLabelOf } from './lib/transit.js'
import { resolveImageUrl } from './lib/api.js'
import { addDaysISO, durationLabelFromNights, formatShortDate, nightsBetween, parseDayCount, todayISO } from './lib/datetime.js'
import { useAuth } from './hooks/useAuth.js'
import { useCityHighlights, useCityWeather } from './hooks/useCityHighlights.js'
import { useNearbyParking } from './hooks/useNearbyParking.js'
import { useTripForecast } from './hooks/useTripForecast.js'
import { useCityPool } from './hooks/useCityPool.js'
import { useTripPlan } from './hooks/useTripPlan.js'
import { legColor } from './lib/kakaoMaps.js'
import { haversineKm, optimizeRouteOrder } from './lib/geo.js'
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
const SORT_MODES = ['distance', 'slot']
const SORT_LABELS = { distance: '이동거리 최소 순서', slot: '시간대 순서' }

// 구간 이동 뱃지에 붙일 교통수단 아이콘.
const TRANSPORT_ICON = { 도보: '🚶', 대중교통: '🚌', 자차: '🚗' }

// "73분" 같은 문자열에서 숫자를 뽑아 "N시간 M분"으로. 파싱 실패 시 원문 유지.
function railDurationLabel(raw) {
  const min = Number.parseInt(raw, 10)
  return Number.isFinite(min) ? formatDurationMin(min) : raw
}

// "여행 일정 미리보기"는 스크랩북 지면처럼 하루를 오전/오후/저녁 세 칸으로만 접어서 보여준다.
// 내부 슬롯(점심 맛집·오후 카페)은 "오후" 한 칸으로 합친다.
const PREVIEW_BUCKETS = [
  { key: '오전', label: '오전', icon: '☀️', slots: ['오전'] },
  { key: '오후', label: '오후', icon: '⛅', slots: ['점심 맛집', '오후 카페'] },
  { key: '저녁', label: '저녁', icon: '🌙', slots: ['저녁'] },
]

// 하루치 방문 목록(방문 순서대로)을 오전/오후/저녁 칸으로 나눈다.
function bucketByPreview(places) {
  return PREVIEW_BUCKETS.map((bucket) => ({
    ...bucket,
    items: places.filter((place) => bucket.slots.includes(place.assignedSlot || '오전')),
  }))
}

// 코스 안내 문구 앞에 붙일 아이콘 — 문구 내용으로 종류를 추정한다.
function noticeIcon(message) {
  if (/비·눈|비\/눈|☔|우천|실내 위주/.test(message)) return '☔'
  if (/지하철|대중교통|자차/.test(message)) return '🚇'
  if (/쉬는 곳|휴무|정기 휴무/.test(message)) return '🗓️'
  if (/늦어|마감|문을 닫는/.test(message)) return '⏰'
  if (/넉넉지|채우지 못|직접 추가/.test(message)) return '✏️'
  return '💡'
}

// km -> "약 52km" 형태의 짧은 문자열 (10km 미만은 소수 1자리).
function formatKm(km) {
  return km >= 10 ? `${Math.round(km)}km` : `${km.toFixed(1)}km`
}

// 주소 문자열에서 "시/군/구" 단위 지역명만 뽑는다 (예: "제주특별자치도 서귀포시 성산읍..." -> "서귀포시").
function shortRegionOf(address, fallback = '') {
  const tokens = String(address || '').trim().split(/\s+/)
  const hit = tokens.find((token, index) => index > 0 && token.length <= 5 && /(시|군|구)$/.test(token))
  return hit || fallback
}

function App() {
  const [screen, setScreen] = useState('home')
  const [leaving, setLeaving] = useState(false)

  // 브라우저 뒤로/앞으로 버튼으로도 화면(screen)이 넘어가도록 History API 와 동기화한다.
  // popstate 로 들어온 화면 변경은 다시 pushState 하지 않도록 플래그로 걸러낸다.
  const skipHistoryPush = useRef(false)
  useEffect(() => {
    window.history.replaceState({ screen: 'home' }, '')
    const onPopState = (event) => {
      skipHistoryPush.current = true
      setLeaving(false)
      setScreen(event.state?.screen || 'home')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => {
    if (skipHistoryPush.current) {
      skipHistoryPush.current = false
      return
    }
    if (window.history.state?.screen === screen) return
    window.history.pushState({ screen }, '')
  }, [screen])

  const [darkMode, setDarkMode] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(0)
  // 지도 구간 트레이싱을 "누를 때마다" 다시 트리거하려고, 같은 번호를 눌러도 값이 바뀌는 카운터.
  const [selectPulse, setSelectPulse] = useState(0)
  const selectPlace = useCallback((index) => {
    setSelectedPlace(index)
    setSelectPulse((n) => n + 1)
  }, [])
  const [selectedDay, setSelectedDay] = useState(0)
  const [dayStartTime, setDayStartTime] = useState('09:30')
  const [savedName, setSavedName] = useState('')
  const [copyState, setCopyState] = useState('공유')
  const [saveState, setSaveState] = useState(SAVE_LABEL) // 평상시 SAVE_LABEL, 누르면 저장 중… → 저장됨 ✓ / 로그인 필요 / 저장 실패
  const [routeLegs, setRouteLegs] = useState([])
  // 타임라인에서 사용자가 편집한 결과. currentTimelineDays[일자] = 그 날의 방문 목록.
  const [currentTimelineDays, setCurrentTimelineDays] = useState([])
  // "여행 일정 미리보기" 패널: 기본은 요약만, 눌러야 하루 전체 타임라인이 펼쳐진다.
  const [previewExpanded, setPreviewExpanded] = useState(false)
  // 지도 위 장소 정렬: 'distance'(이동거리 최소) | 'slot'(오전→저녁 시간대 순).
  const [sortMode, setSortMode] = useState('distance')
  const [sortOpen, setSortOpen] = useState(false)
  // 코스 화면 지도 카드: "교통 정보" 체크박스(이동 시간/거리 요약 표시) + 지도 확대/축소·처음 위치 버튼.
  const [trafficOn, setTrafficOn] = useState(true)
  const mapInstRef = useRef(null)
  // 지도 밑 장소 카드를 누르면 뜨는 상세 모달이 가리키는 장소 인덱스(null 이면 닫힘).
  const [detailPlaceIndex, setDetailPlaceIndex] = useState(null)
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
  } = useTripPlan()

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
    submitLogin,
    signOut,
    signInWithGoogle,
    signInWithKakao,
    closeAuthPanel,
  } = useAuth()

  const cityKey = allDestinations.find((item) => destination.includes(item.name))?.name || fallbackCity
  const { data: cityData, status: cityPoolStatus, retry: retryCityPool } = useCityPool(cityKey)
  const { photos: cityPhotos, trends: cityTrends } = useCityHighlights()
  const weather = useCityWeather(cityKey, cityData?.center)

  // "오늘의 추천 AI 코스" — 날짜로 도시·테마를 회전시켜 매일 다른 1일 코스를 보여준다.
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
    const ordered = sortMode === 'slot'
      ? merged
          .map((place, index) => ({ place, index }))
          .sort(
            (a, b) =>
              SLOT_LABELS.indexOf(a.place.assignedSlot) - SLOT_LABELS.indexOf(b.place.assignedSlot) ||
              a.index - b.index,
          )
          .map((entry) => entry.place)
      : optimizeRouteOrder(merged, courseAnchors)
    return scheduleDay(ordered, { dayStartMin, transport })
  }, [activeDayPlaces, placeByName, dayStartMin, transport, sortMode, courseAnchors])
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
  // 지도가 실제 경로를 그리면 routeLegs 를 쓰고(출발·복귀 앵커 포함), 아직이면 장소들만 이어 임시 구간을 만든다.
  const legsForDisplay = routeLegs.length
    ? routeLegs
    : displayPlaces.slice(0, -1).map((place, index) => ({
        from: displayPlaces[index].name,
        to: displayPlaces[index + 1].name,
        fromLabel: `${index + 1}`,
        toLabel: `${index + 2}`,
        duration: `${place.travelToNextMin || Number.parseInt(place.time, 10) || 0}분`,
        focusIndex: index + 1,
        summary: null,
      }))
  const totalTime = legsForDisplay.reduce((sum, leg) => sum + (Number.parseInt(leg.duration, 10) || 0), 0)
  // 총 이동 거리(직선 기준 추정) — 출발지 + 방문지들 + 복귀지를 순서대로 이은 거리 합.
  const totalKm = useMemo(() => {
    const pts = []
    if (routeStartPoint && Number.isFinite(routeStartPoint.lat)) {
      pts.push({ lat: routeStartPoint.lat, lng: routeStartPoint.lng })
    }
    displayPlaces.forEach((place) => {
      if (place.location && Number.isFinite(place.location.lat)) pts.push(place.location)
    })
    if (routeEndPoint && Number.isFinite(routeEndPoint.lat)) {
      pts.push({ lat: routeEndPoint.lat, lng: routeEndPoint.lng })
    }
    let km = 0
    for (let i = 1; i < pts.length; i += 1) km += haversineKm(pts[i - 1], pts[i])
    return km
  }, [displayPlaces, routeStartPoint, routeEndPoint])
  // 구간 리스트에서 노드 시퀀스를 복원한다: [첫 구간의 출발점, 이후 각 구간의 도착점].
  // 지도 아래 "레일"이 이 노드들 사이에 구간 시간을 끼워 1차원으로 펼친다 (지도 위에 겹칠 일 없음).
  const railNodes = legsForDisplay.length
    ? [
        {
          label: legsForDisplay[0].fromLabel ?? '출발',
          name: legsForDisplay[0].from,
          isTerminus: !/^\d+$/.test(legsForDisplay[0].fromLabel ?? '출발'),
          focusIndex: 0,
        },
        ...legsForDisplay.map((leg, index) => ({
          label: leg.toLabel ?? `${index + 1}`,
          name: leg.to,
          isTerminus: !/^\d+$/.test(leg.toLabel ?? `${index + 1}`),
          focusIndex: leg.focusIndex ?? index,
        })),
      ]
    : []
  // selectedPlace 는 그대로 두고, 읽을 때만 현재 날의 장소 수에 맞춰 눌러 쓴다 (날 전환·타임라인 편집으로 범위가 줄어도 안전).
  const safeSelectedPlace = Math.min(selectedPlace, Math.max(displayPlaces.length - 1, 0))
  const detail = displayPlaces[safeSelectedPlace] || displayPlaces[0] || null
  // 선택한 장소 주변 주차장 (좌표가 있을 때만). 상세 박스 "주변 주차장" 줄에 쓴다.
  const nearbyParking = useNearbyParking(detail?.location?.lat, detail?.location?.lng)


  const goToSignup = () => {
    closeAuthPanel()
    setScreen('signup')
  }

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
    setRouteLegs([])
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
    setTripOrigin(null)
    setTripLodging(null)
    setSelectedPlace(0)
    setSelectedDay(0)
    setRouteLegs([])
    setCurrentTimelineDays([])
    setSavedName(title || `${dest} 여행`.trim())
    setScreen('course')
  }

  const handleTimelineDaysChange = useCallback((nextDays) => {
    setCurrentTimelineDays(nextDays)
    setRouteLegs([])
  }, [])

  // 타임라인 카드 클릭: 그 날로 전환하면서 해당 장소를 선택한다.
  const handleTimelineSelect = useCallback((day, index) => {
    setSelectedDay(day)
    setSelectedPlace(index)
  }, [])

  const mapUrl = detail ? `https://map.kakao.com/link/search/${encodeURIComponent(`${cityKey} ${detail.name}`)}` : ''
  const naverUrl = detail ? `https://map.naver.com/p/search/${encodeURIComponent(`${cityKey} ${detail.name}`)}` : ''

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
          {user && <span className="user-email">{user.email}</span>}
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
        <section className="auth-panel" aria-label="member auth">
          <div className="auth-card">
            <div className="auth-tabs">
              <button className="selected" type="button">
                로그인
              </button>
              <button type="button" onClick={goToSignup}>
                회원가입
              </button>
            </div>
            <form onSubmit={submitLogin}>
              <label>
                이메일
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                비밀번호
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
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
            <div className="auth-social">
              <button type="button" className="auth-social-button" onClick={signInWithGoogle}>
                구글로 계속하기
              </button>
              <button type="button" className="auth-social-button" onClick={signInWithKakao}>
                카카오로 계속하기
              </button>
            </div>
            <p className="auth-hint">
              계정이 없으신가요?{' '}
              <button type="button" className="auth-link" onClick={goToSignup}>
                회원가입하기
              </button>
            </p>
          </div>
        </section>
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
                onRouteReady={setRouteLegs}
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
