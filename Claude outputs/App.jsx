import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SignupScreen from './SignupScreen.jsx'
import { budgets, journeyThemes, SLOT_LABELS, transports } from './data/travelOptions.js'
import { allDestinations, destinationCatalog, destinationGroups, fallbackCity } from './data/destinations.js'
import { buildCourse } from './lib/course.js'
import { placeKindOf } from './lib/placeKind.js'
import { formatClock, parseClock, scheduleDay } from './lib/schedule.js'
import { formatStay } from './lib/stayTime.js'
import { estimateDayCost, feeLabelOf } from './lib/cost.js'
import { addDaysISO, durationLabelFromNights, formatShortDate, nightsBetween, parseDayCount, todayISO } from './lib/datetime.js'
import { useAuth } from './hooks/useAuth.js'
import { useCityHighlights, useCityWeather } from './hooks/useCityHighlights.js'
import { useCityPool } from './hooks/useCityPool.js'
import { useTripPlan } from './hooks/useTripPlan.js'
import { legColor } from './lib/kakaoMaps.js'
import CoursePoolNotice from './components/CoursePoolNotice.jsx'
import Icon from './components/Icon.jsx'
import KakaoRouteMap from './components/KakaoRouteMap.jsx'
import ScheduleTimeline from './components/ScheduleTimeline.jsx'
import Segment from './components/Segment.jsx'
import TravelSketchHome from './components/TravelSketchHome.jsx'
import balgilLogoMark from './assets/balgil-logo-mark.png'
import BudgetScreen from './screens/BudgetScreen.jsx'
import DatesScreen from './screens/DatesScreen.jsx'
import DestinationsScreen from './screens/DestinationsScreen.jsx'
import OriginScreen from './screens/OriginScreen.jsx'
import ThemeScreen from './screens/ThemeScreen.jsx'
import leftEdgeBg from './assets/left_bg.png'
import rightEdgeBg from './assets/right_bg.png'

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

// 장소 목록을 assignedSlot(오전/점심 맛집/오후 카페/저녁) 기준으로 묶는다.
function groupBySlot(places) {
  const groups = {}
  places.forEach((place) => {
    const slot = place.assignedSlot || '오전'
    if (!groups[slot]) groups[slot] = []
    groups[slot].push(place)
  })
  return groups
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
  const [selectedDay, setSelectedDay] = useState(0)
  const [dayStartTime, setDayStartTime] = useState('09:30')
  const [savedName, setSavedName] = useState('경주 연인 산책')
  const [copyState, setCopyState] = useState('공유')
  const [routeLegs, setRouteLegs] = useState([])
  // 타임라인에서 사용자가 편집한 결과. currentTimelineDays[일자] = 그 날의 방문 목록.
  const [currentTimelineDays, setCurrentTimelineDays] = useState([])
  // "여행 일정 미리보기" 패널: 기본은 요약만, 눌러야 하루 전체 타임라인이 펼쳐진다.
  const [previewExpanded, setPreviewExpanded] = useState(false)

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
    setUser,
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
  const course = useMemo(
    () =>
      (cityData
        ? buildCourse(cityData, journeyTheme, budget, mustVisit, courseAnchors, transport, {
            tripDate: tripStartDate,
            dayCount,
            dayStartMin,
          })
        : null),
    [cityData, journeyTheme, budget, mustVisit, courseAnchors, transport, tripStartDate, dayCount, dayStartMin],
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
    return scheduleDay(merged, { dayStartMin, transport })
  }, [activeDayPlaces, placeByName, dayStartMin, transport])
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

  // 출발지(필수) + 숙소(선택)를 확정하면 -> 코스 화면으로 슬라이드한다.
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

      <div className="app-stage">
      <nav className="topbar">
        <button className="brand" type="button" onClick={() => setScreen('home')} aria-label="홈으로 이동">
          <img src={balgilLogoMark} alt="" aria-hidden="true" className="brand-logo" />
          <span>발길따라</span>
        </button>
        <div className="nav-links">
          <button className={screen === 'home' ? 'active' : ''} type="button" onClick={() => setScreen('home')}>홈</button>
          <button className={screen === 'destinations' ? 'active' : ''} type="button" onClick={goToDestinations}>목적지</button>
          <button className={screen === 'themes' ? 'active' : ''} type="button" onClick={() => slideTo('themes')}>테마</button>
          <button className={screen === 'course' ? 'active' : ''} type="button" onClick={() => setScreen('course')}>여행 코스</button>
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

      <span className="page-number">PAGE 1</span>

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
            <p className="auth-hint">
              계정이 없으신가요?{' '}
              <button type="button" className="auth-link" onClick={goToSignup}>
                회원가입하기
              </button>
            </p>
          </div>
        </section>
      )}

      {screen === 'signup' ? (
        <SignupScreen
          onBack={() => setScreen('home')}
          onSuccess={(newUser) => {
            setUser(newUser)
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
          cityKey={cityKey}
          cityPhotos={cityPhotos}
          destination={destination}
          leaving={leaving}
          mustVisit={mustVisit}
          mustVisitInput={mustVisitInput}
          todayCity={todayCity}
          todayCourse={todayCourse}
          todayStatus={todayStatus}
          onAddMustVisit={addMustVisit}
          onChangeDestination={setDestination}
          onChangeMustVisitInput={setMustVisitInput}
          onPickCity={pickDestination}
          onRemoveMustVisit={removeMustVisit}
          onRetryToday={retryTodayPool}
          onStartCourse={startCourse}
          onStartToday={startTodayCourse}
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
          <header className="course-header">
            <div>
              <button className="back-button" type="button" onClick={() => setScreen('home')}>홈으로</button>
              <div className="course-title-row">
                <h1>{pickedDestination ? `${pickedDestination} 여행 코스` : course.title}</h1>
                {weather && (
                  <span className="weather-badge">
                    {weather.emoji} {weather.tempC}° {weather.description}
                  </span>
                )}
              </div>
              <p>
                {journeyThemeLabel && <><b className="course-theme-tag">{journeyThemeLabel}</b> · </>}
                {course.subtitle} · {duration} · {budget} · {transport} · {style} · {dayStartTime} 출발
              </p>
            </div>
            <div className="course-actions">
              <label className="name-editor">
                저장한 코스 이름
                <input value={savedName} onChange={(event) => setSavedName(event.target.value)} />
              </label>
              <button type="button" onClick={shareCourse}>{copyState}</button>
            </div>
          </header>

          {mustVisit.length > 0 && (
            <div className="course-must-visit">
              <b>필수 방문</b>
              {mustVisit.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
          )}

          {(course.notices || (course.notice ? [course.notice] : [])).map((message) => (
            <p key={message} className="course-notice">{message}</p>
          ))}

          {course.days.length > 1 && (
            <div className="day-tabs" role="tablist" aria-label="여행 일자 선택">
              {course.days.map((day, d) => (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={selectedDay === d}
                  className={selectedDay === d ? 'day-tab selected' : 'day-tab'}
                  onClick={() => {
                    setSelectedDay(d)
                    setSelectedPlace(0)
                  }}
                >
                  <b>Day {d + 1}</b>
                  <span>{formatShortDate(addDaysISO(tripStartDate, d))}</span>
                </button>
              ))}
            </div>
          )}

          <div className="course-layout">
            <section className="route-map-card">
              <div className="map-toolbar">
                <h2>지도</h2>
                <span>이동거리 최소 순서</span>
              </div>
              <KakaoRouteMap
                course={course}
                places={displayPlaces}
                origin={routeStartPoint}
                endPoint={routeEndPoint}
                transport={transport}
                selectedPlace={safeSelectedPlace}
                onSelectPlace={setSelectedPlace}
                onRouteReady={setRouteLegs}
              />
              <Segment title="교통편" options={transports} value={transport} onChange={setTransport} />
              <div className="route-rail-scroll">
                <div className="route-rail" aria-label="구간별 소요 시간">
                  {railNodes.map((node, index) => (
                    <Fragment key={`${node.label}-${index}`}>
                      {index > 0 && (
                        <button
                          type="button"
                          className="rail-seg"
                          onClick={() => setSelectedPlace(legsForDisplay[index - 1].focusIndex ?? index - 1)}
                          aria-label={`${railNodes[index - 1].label}에서 ${node.label}까지 ${legsForDisplay[index - 1].duration}`}
                        >
                          <span className="rail-bar" style={{ background: legColor(index - 1) }} />
                          <span className="rail-mins">{legsForDisplay[index - 1].duration}</span>
                          {legsForDisplay[index - 1].summary && (
                            <span className="rail-sub">{legsForDisplay[index - 1].summary}</span>
                          )}
                        </button>
                      )}
                      {node.isTerminus ? (
                        <span className="rail-node">
                          <span className="rail-dot terminus">{node.label}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={safeSelectedPlace === node.focusIndex ? 'rail-node rail-node-btn selected' : 'rail-node rail-node-btn'}
                          onClick={() => setSelectedPlace(node.focusIndex)}
                        >
                          <span className="rail-dot">{node.label}</span>
                          <small>{node.name}</small>
                        </button>
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>

              <div className="stop-gallery-scroll">
                <div className="stop-gallery" aria-label="오늘 방문할 장소">
                  {displayPlaces.map((place, index) => {
                    const kind = placeKindOf(place)
                    return (
                      <button
                        key={place.name}
                        type="button"
                        className={safeSelectedPlace === index ? 'stop-card is-active' : 'stop-card'}
                        onClick={() => setSelectedPlace(index)}
                      >
                        <span className={`stop-thumb kind-${kind}`}>
                          <span className="stop-num">{index + 1}</span>
                          <span className="stop-emoji" aria-hidden="true">{KIND_EMOJI[kind] || '📍'}</span>
                        </span>
                        <b>{place.name}</b>
                        <small>{KIND_LABEL[kind] || '명소'}</small>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="map-buttons">
                <a href={naverUrl} target="_blank" rel="noreferrer">네이버지도에서 보기</a>
                <a href={mapUrl} target="_blank" rel="noreferrer">카카오맵에서 보기</a>
              </div>
            </section>

            <aside className="timeline">
              <div className="preview-head">
                <h2>여행 일정 미리보기</h2>
                <span className="preview-days-badge">
                  {course.days.length > 1 ? `총 ${course.days.length}일` : '당일'}
                </span>
              </div>

              <div className="preview-days">
                {course.days.map((day, d) => {
                  const dayPlaces = allDaysScheduled[d] || []
                  const groups = groupBySlot(dayPlaces)
                  return (
                    <div key={d} className={selectedDay === d ? 'preview-day is-active' : 'preview-day'}>
                      <button
                        type="button"
                        className="preview-day-tag"
                        onClick={() => {
                          setSelectedDay(d)
                          setSelectedPlace(0)
                        }}
                      >
                        <b>Day {d + 1}</b>
                        {course.days.length > 1 && <span>{formatShortDate(addDaysISO(tripStartDate, d))}</span>}
                      </button>
                      {dayPlaces.length === 0 ? (
                        <p className="preview-slot-empty">추천 장소가 부족해요.</p>
                      ) : (
                        SLOT_LABELS.map((slot) => (
                          groups[slot]?.length ? (
                            <p key={slot} className="preview-slot-row">
                              <span className="preview-slot-icon" aria-hidden="true">{SLOT_EMOJI[slot]}</span>
                              <span className="preview-slot-label">{slot}</span>
                              <span className="preview-slot-items">
                                {groups[slot].map((place) => place.name).join(' · ')}
                              </span>
                            </p>
                          ) : null
                        ))
                      )}
                    </div>
                  )
                })}
              </div>

              <button type="button" className="preview-expand" onClick={() => setPreviewExpanded((value) => !value)}>
                {previewExpanded ? '간단히 보기 ⌃' : '전체 일정 보기 ›'}
              </button>

              {previewExpanded && (
                <div className="timeline-full">
                  <h3>{course.days.length > 1 ? `Day ${selectedDay + 1} 동선` : '오늘 동선'}</h3>
                  <p className="timeline-sum">
                    {dayStartTime} 출발 · {displayPlaces.length}곳 · 이동 약 {totalTime || 0}분
                  </p>
                  {displayPlaces.length > 0 && (() => {
                    const cost = estimateDayCost(displayPlaces, transport, budget)
                    return (
                      <p className="timeline-cost">
                        예상 하루 비용 <b>약 ₩{cost.total.toLocaleString()}</b>
                        <span>
                          {' '}· 입장 ₩{cost.admission.toLocaleString()} · 식사 ₩{cost.meals.toLocaleString()} · 이동 ₩{cost.transit.toLocaleString()}
                        </span>
                        <span className="timeline-cost-note"> (1인 · 추정)</span>
                      </p>
                    )
                  })()}
                  {displayPlaces.length === 0 && (
                    <p className="timeline-empty">이 날은 추천 장소가 부족해요. 아래 타임라인에서 직접 추가해보세요.</p>
                  )}
                  <ol className="timeline-list">
                    {displayPlaces.map((place, index) => (
                      <li key={place.name} className="tl-stop">
                        <button
                          type="button"
                          className={safeSelectedPlace === index ? 'tl-card selected' : 'tl-card'}
                          onClick={() => setSelectedPlace(index)}
                        >
                          <span className="tl-time">{formatClock(place.arriveMin)}</span>
                          <span className="tl-node" aria-hidden="true">{index + 1}</span>
                          <span className="tl-body">
                            <b>{place.name}</b>
                            <span className="tl-meta">머무는 시간 약 {formatStay(place.stayMin)}</span>
                            {place.hoursNote && <span className="tl-warn">⚠ {place.hoursNote}</span>}
                          </span>
                        </button>
                        {place.travelToNextMin ? (
                          <span className="tl-move">{transport} {place.travelToNextMin}분</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </aside>

            <section className="detail-card">
              <h2>장소 상세 보기</h2>
              {!detail ? (
                <p className="timeline-empty">이 날은 아직 장소가 없어요. 타임라인에서 추가하면 여기에 상세 정보가 보여요.</p>
              ) : (
              <>
              <div className="detail-title">
                <Icon type="pin" />
                <div>
                  <h3>{detail.name}</h3>
                  <p>{detail.address}</p>
                </div>
              </div>
              <dl>
                {Number.isFinite(detail.arriveMin) && (
                  <>
                    <dt>도착 예정</dt>
                    <dd>
                      {formatClock(detail.arriveMin)}
                      {Number.isFinite(detail.departMin) && ` ~ ${formatClock(detail.departMin)} 출발`}
                    </dd>
                  </>
                )}
                <dt>예상 체류 시간</dt>
                <dd>약 {formatStay(detail.stayMin ?? 60)}</dd>
                {feeLabelOf(detail) && (
                  <>
                    <dt>입장·비용</dt>
                    <dd>{feeLabelOf(detail)}</dd>
                  </>
                )}
                <dt>추천 이유</dt>
                <dd>{detail.reason}</dd>
                <dt>주의사항</dt>
                <dd>{detail.caution}</dd>
                {detail.parking && (
                  <>
                    <dt>주차</dt>
                    <dd>{detail.parking}</dd>
                  </>
                )}
                {detail.openHoursText && (
                  <>
                    <dt>영업시간</dt>
                    <dd className="detail-hours">{detail.openHoursText}</dd>
                  </>
                )}
                {detail.closedDayText && (
                  <>
                    <dt>휴무일</dt>
                    <dd>{detail.closedDayText}</dd>
                  </>
                )}
                {detail.hoursNote && (
                  <>
                    <dt>참고</dt>
                    <dd className="detail-warn">{detail.hoursNote}</dd>
                  </>
                )}
                {detail.transitScore && (
                  <>
                    <dt>대중교통</dt>
                    <dd>
                      {detail.transitStation
                        ? `${detail.transitStation} 도보 약 ${Math.max(1, Math.round(detail.transitDistanceM / 67))}분`
                        : '주변 지하철역 없음 · 차량 권장'}
                    </dd>
                  </>
                )}
              </dl>
              </>
              )}
            </section>
          </div>

          <ScheduleTimeline
            // 이 조합이 바뀌면 일정을 처음부터 다시 잡아야 하므로 통째로 새로 마운트시킨다.
            // (ScheduleTimeline 안에서 effect 로 되돌리는 대신 key 로 처리)
            key={`${cityKey}:${journeyTheme || '-'}:${budget || '-'}:${dayCount}`}
            cityKey={cityKey}
            seedDays={course.days.map((day) => day.places)}
            dayCount={dayCount}
            transport={transport}
            themeId={journeyTheme}
            budgetTier={budget}
            dayStartMin={dayStartMin}
            placeInfoByName={placeByName}
            selectedDay={selectedDay}
            onDaysChange={handleTimelineDaysChange}
            selectedPlace={safeSelectedPlace}
            onSelectPlace={handleTimelineSelect}
          />
        </section>
      )}
      </div>
    </main>
  )
}

// 최근 3일 평균 검색량이 그 이전 기간 평균보다 이 배수 이상이면 "지금 뜨는 중" 배지를 붙인다.

export default App
