import { useEffect, useMemo, useRef, useState } from 'react'
import { getCurrentUser, login, logout } from './authApi'
import SignupScreen from './SignupScreen.jsx'

const themes = [
  { id: 'healing', label: '힐링', icon: 'leaf' },
  { id: 'food', label: '맛집', icon: 'fork' },
  { id: 'family', label: '가족', icon: 'family' },
  { id: 'couple', label: '연인', icon: 'heart' },
]

const budgets = ['저예산', '보통', '프리미엄']
const transports = ['도보', '대중교통', '자차']
const styles = ['느긋한 일정', '빡빡한 일정', '사진 중심', '맛집 중심']

const courseDatabase = {
  제주: {
    title: '제주 힐링 여행',
    subtitle: '바다와 숲을 천천히 걷는 하루',
    center: { lat: 33.3891, lng: 126.5466 },
    places: [
      { name: '함덕해수욕장', address: '제주특별자치도 제주시 조천읍 조함해안로 525', stay: '1시간 20분', reason: '맑은 바다와 산책로가 있어 첫 코스로 부담이 적어요.', caution: '바람이 강한 날은 겉옷을 챙기면 좋아요.', time: '22분', location: { lat: 33.5433, lng: 126.6698 } },
      { name: '비자림', address: '제주특별자치도 제주시 구좌읍 비자숲길 55', stay: '1시간', reason: '그늘진 숲길이 많아 힐링 테마와 잘 맞아요.', caution: '비 온 뒤에는 산책로가 미끄러울 수 있어요.', time: '34분', location: { lat: 33.4912, lng: 126.8114 } },
      { name: '성산일출봉', address: '제주특별자치도 서귀포시 성산읍 일출로 284-12', stay: '1시간 30분', reason: '제주의 대표 풍경을 사진으로 남기기 좋아요.', caution: '오르막 구간이 있어 편한 신발을 추천해요.', time: '28분', location: { lat: 33.4580, lng: 126.9425 } },
      { name: '섭지코지', address: '제주특별자치도 서귀포시 성산읍 고성리', stay: '50분', reason: '노을과 해안 산책이 좋아 마무리 코스로 잘 어울려요.', caution: '일몰 시간대 주차가 혼잡할 수 있어요.', time: '18분', location: { lat: 33.4239, lng: 126.9297 } },
    ],
  },
  부산: {
    title: '부산 맛집 코스',
    subtitle: '바다 풍경 사이로 맛집을 콕콕 찍는 하루',
    center: { lat: 35.1595, lng: 129.0756 },
    places: [
      { name: '감천문화마을', address: '부산광역시 사하구 감내2로 203', stay: '1시간', reason: '골목 사진과 간식 코스가 함께 좋아요.', caution: '주민 거주 지역이라 조용히 이동해 주세요.', time: '19분', location: { lat: 35.0975, lng: 129.0106 } },
      { name: '자갈치시장', address: '부산광역시 중구 자갈치해안로 52', stay: '1시간 10분', reason: '부산다운 해산물 식사를 즐기기 좋은 핵심 지점이에요.', caution: '점심 시간대는 대기 시간이 길 수 있어요.', time: '14분', location: { lat: 35.0969, lng: 129.0305 } },
      { name: '광안리해수욕장', address: '부산광역시 수영구 광안해변로 219', stay: '1시간 30분', reason: '카페, 야경, 바다 산책을 한 번에 즐길 수 있어요.', caution: '주말 저녁은 교통 정체가 잦아요.', time: '31분', location: { lat: 35.1532, lng: 129.1187 } },
      { name: '해운대 블루라인파크', address: '부산광역시 해운대구 청사포로 116', stay: '1시간', reason: '바다열차와 사진 포인트가 많아 마무리가 예뻐요.', caution: '인기 시간대는 사전 예매가 편해요.', time: '24분', location: { lat: 35.1601, lng: 129.1710 } },
    ],
  },
  경주: {
    title: '경주 연인 산책',
    subtitle: '밤 산책과 한옥 골목을 엮은 감성 코스',
    center: { lat: 35.8349, lng: 129.2196 },
    places: [
      { name: '첨성대', address: '경상북도 경주시 인왕동 839-1', stay: '40분', reason: '경주의 시작점으로 상징성이 크고 사진이 잘 나와요.', caution: '낮에는 그늘이 적어 양산이나 모자가 좋아요.', time: '12분', location: { lat: 35.8347, lng: 129.2187 } },
      { name: '황리단길', address: '경상북도 경주시 포석로 1080', stay: '1시간 20분', reason: '카페와 소품샵이 많아 취향 탐색에 좋아요.', caution: '주말에는 골목이 붐벼 이동 시간을 넉넉히 잡으세요.', time: '18분', location: { lat: 35.8380, lng: 129.2094 } },
      { name: '동궁과 월지', address: '경상북도 경주시 원화로 102', stay: '1시간', reason: '야경이 아름다워 연인 테마의 하이라이트예요.', caution: '야간 입장 마감 시간을 확인해 주세요.', time: '25분', location: { lat: 35.8345, lng: 129.2266 } },
      { name: '월정교', address: '경상북도 경주시 교동 274', stay: '45분', reason: '은은한 조명과 강변 산책로가 마무리에 잘 맞아요.', caution: '강변은 밤에 기온이 낮아질 수 있어요.', time: '15분', location: { lat: 35.8297, lng: 129.2146 } },
    ],
  },
}

const fallbackCity = '경주'
const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
let googleMapsPromise

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google)
  if (googleMapsPromise) return googleMapsPromise

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&language=ko&region=KR`
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google)
    script.onerror = () => reject(new Error('Google Maps script failed to load'))
    document.head.appendChild(script)
  })

  return googleMapsPromise
}

function App() {
  const [screen, setScreen] = useState('home')
  const [destination, setDestination] = useState('경주')
  const [theme, setTheme] = useState('couple')
  const [budget, setBudget] = useState('보통')
  const [transport, setTransport] = useState('대중교통')
  const [style, setStyle] = useState('사진 중심')
  const [darkMode, setDarkMode] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(0)
  const [savedName, setSavedName] = useState('경주 연인 산책')
  const [copyState, setCopyState] = useState('공유')
  const [routeLegs, setRouteLegs] = useState([])
  const [authOpen, setAuthOpen] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [user, setUser] = useState(null)

  const cityKey = Object.keys(courseDatabase).find((city) => destination.includes(city)) || fallbackCity
  const course = useMemo(() => courseDatabase[cityKey], [cityKey])
  const activeTheme = themes.find((item) => item.id === theme)
  const legsForDisplay = routeLegs.length ? routeLegs : course.places.slice(0, -1).map((place, index) => ({
    from: course.places[index].name,
    to: course.places[index + 1].name,
    duration: place.time,
  }))
  const totalTime = legsForDisplay.reduce((sum, leg) => sum + (Number.parseInt(leg.duration, 10) || 0), 0)
  const detail = course.places[selectedPlace]

  useEffect(() => {
    let isMounted = true

    getCurrentUser()
      .then(({ user: currentUser }) => {
        if (isMounted) setUser(currentUser)
      })
      .catch(() => {
        if (isMounted) setUser(null)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // 로그인 패널 전용 제출 핸들러. (회원가입은 별도 화면 SignupScreen 에서 처리)
  const submitLogin = async (event) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthMessage('')

    login(authEmail.trim(), authPassword)
      .then(({ user: authenticatedUser }) => {
        setUser(authenticatedUser)
        setAuthOpen(false)
        setAuthMessage('')
        setAuthPassword('')
      })
      .catch((error) => {
        setAuthMessage(error.message)
      })
      .finally(() => {
        setAuthLoading(false)
      })
  }

  const goToSignup = () => {
    setAuthOpen(false)
    setAuthMessage('')
    setAuthPassword('')
    setScreen('signup')
  }

  const signOut = async () => {
    await logout().catch(() => null)
    setUser(null)
  }

  const startCourse = () => {
    setSavedName(`${cityKey} ${activeTheme.label} 여행`)
    setSelectedPlace(0)
    setRouteLegs([])
    setScreen('course')
  }

  const shareCourse = async () => {
    const text = `${savedName}: ${course.places.map((place, index) => `${index + 1}. ${place.name}`).join(' -> ')}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('복사됨')
      setTimeout(() => setCopyState('공유'), 1400)
    } catch {
      setCopyState('복사 실패')
      setTimeout(() => setCopyState('공유'), 1400)
    }
  }

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cityKey} ${detail.name}`)}`
  const naverUrl = `https://map.naver.com/p/search/${encodeURIComponent(`${cityKey} ${detail.name}`)}`

  return (
    <main className={darkMode ? 'app dark' : 'app'}>
      <nav className="topbar">
        <button className="brand" type="button" onClick={() => setScreen('home')} aria-label="홈으로 이동">
          <span className="brand-mark">⌾</span>
          <span>발길따라</span>
        </button>
        <div className="nav-links">
          <button className={screen === 'home' ? 'active' : ''} type="button" onClick={() => setScreen('home')}>홈</button>
          <button type="button">목적지</button>
          <button type="button">테마</button>
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
      ) : screen === 'home' ? (
        <section className="home">
          <div className="desk-object camera"></div>
          <div className="desk-object paper-map"></div>
          <div className="desk-object ticket">
            <b>서울 → 부산</b>
            <span>07:45 · 3호차</span>
          </div>
          <div className="desk-object suitcase"><span></span></div>
          <div className="desk-object tag">
            <b>오늘도</b>
            <span>설레는 여행 중</span>
          </div>
          <div className="desk-object photo-stack"></div>
          <div className="desk-object postcard">오늘, 여행하기 좋은 날</div>
          <div className="desk-object compass"></div>
          <div className="travel-rope one"></div>
          <div className="travel-rope two"></div>

          <div className="hero-panel">
            <p className="eyebrow">AI 국내 여행 코스 메이커</p>
            <h1>AI가 추천하는 국내 여행 코스</h1>
            <p className="hero-copy">가고 싶은 곳만 입력하세요. 예산, 이동수단, 스타일에 맞춰 하루 동선을 귀엽고 알차게 짜드릴게요.</p>

            <div className="hero-search">
              <label>
                <span>목적지</span>
                <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="어디로 떠나고 싶으세요?" />
              </label>
              <button type="button" onClick={startCourse}>여행 시작하기</button>
            </div>

            <div className="korea-map" aria-label="국내 여행지 지도">
              <div className="map-line"></div>
              <span className="map-label label-incheon">인천</span>
              <span className="map-label label-gangneung">강릉</span>
              <span className="map-label label-jeonju">전주</span>
              <span className="map-label label-yeosu">여수</span>
              <span className="map-label label-pohang">포항</span>
              <span className="map-label label-ulleung">울릉도</span>
              <span className="map-doodle mountain-a">⌂</span>
              <span className="map-doodle mountain-b">⌂</span>
              <span className="map-doodle wave-a">∿∿</span>
              <span className="map-doodle wave-b">∿∿</span>
              {['서울', '제주', '경주', '부산'].map((city, index) => (
                <button key={city} className={`map-pin pin-${index + 1}`} type="button" onClick={() => setDestination(city)}>
                  <span>{index + 1}</span>{city}
                </button>
              ))}
            </div>

            <div className="destination-cards">
              {['서울', '제주', '경주', '부산'].map((city, index) => (
                <button className="destination-card" type="button" key={city} onClick={() => setDestination(city)}>
                  <span className={`photo photo-${index + 1}`}></span>
                  <b>{city}</b>
                </button>
              ))}
            </div>

            <div className="option-row">
              {themes.map((item) => (
                <button key={item.id} className={theme === item.id ? 'chip selected' : 'chip'} type="button" onClick={() => setTheme(item.id)}>
                  <Icon type={item.icon} />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="planner-options">
              <Segment title="예산 선택" options={budgets} value={budget} onChange={setBudget} />
              <Segment title="이동수단 선택" options={transports} value={transport} onChange={setTransport} />
              <Segment title="여행 스타일 선택" options={styles} value={style} onChange={setStyle} />
            </div>
          </div>
        </section>
      ) : (
        <section className="course-screen">
          <header className="course-header">
            <div>
              <button className="back-button" type="button" onClick={() => setScreen('home')}>홈으로</button>
              <h1>{course.title}</h1>
              <p>{course.subtitle} · {budget} · {transport} · {style}</p>
            </div>
            <div className="course-actions">
              <label className="name-editor">
                저장한 코스 이름
                <input value={savedName} onChange={(event) => setSavedName(event.target.value)} />
              </label>
              <button type="button" onClick={shareCourse}>{copyState}</button>
            </div>
          </header>

          <div className="course-layout">
            <section className="route-map-card">
              <div className="map-toolbar">
                <h2>지도와 추천 동선</h2>
                <span>총 이동 약 {totalTime || 70}분</span>
              </div>
              <GoogleRouteMap
                course={course}
                transport={transport}
                selectedPlace={selectedPlace}
                onSelectPlace={setSelectedPlace}
                onRouteReady={setRouteLegs}
              />
              <div className="route-leg-strip" aria-label="구간별 소요 시간">
                {legsForDisplay.map((leg, index) => (
                  <button key={`${leg.from}-${leg.to}`} type="button" onClick={() => setSelectedPlace(index)}>
                    <b>{index + 1} → {index + 2}</b>
                    <span>{leg.duration}</span>
                  </button>
                ))}
              </div>
              <div className="map-buttons">
                <a href={naverUrl} target="_blank" rel="noreferrer">네이버지도에서 보기</a>
                <a href={mapUrl} target="_blank" rel="noreferrer">구글맵에서 보기</a>
              </div>
            </section>

            <aside className="timeline">
              <h2>추천 코스</h2>
              {course.places.map((place, index) => (
                <button key={place.name} className={selectedPlace === index ? 'timeline-item selected' : 'timeline-item'} type="button" onClick={() => setSelectedPlace(index)}>
                  <span>{index + 1}</span>
                  <div>
                    <b>{place.name}</b>
                    <small>예상 체류 {place.stay}</small>
                  </div>
                </button>
              ))}
            </aside>

            <section className="score-card">
              <h2>코스 점수</h2>
              <Score label="취향 적합도" value="94" />
              <Score label="이동 효율" value="88" />
              <Score label="일정 밀도" value={style === '빡빡한 일정' ? '91' : '72'} />
            </section>

            <section className="detail-card">
              <h2>장소 상세 보기</h2>
              <div className="detail-title">
                <Icon type="pin" />
                <div>
                  <h3>{detail.name}</h3>
                  <p>{detail.address}</p>
                </div>
              </div>
              <dl>
                <dt>예상 체류 시간</dt>
                <dd>{detail.stay}</dd>
                <dt>추천 이유</dt>
                <dd>{detail.reason}</dd>
                <dt>주의사항</dt>
                <dd>{detail.caution}</dd>
              </dl>
            </section>
          </div>
        </section>
      )}
    </main>
  )
}

function GoogleRouteMap({ course, transport, selectedPlace, onSelectPlace, onRouteReady }) {
  const mapElementRef = useRef(null)
  const overlaysRef = useRef([])
  const markersRef = useRef([])
  const rendererRef = useRef(null)
  const [mapStatus, setMapStatus] = useState(googleMapsApiKey ? 'loading' : 'missing-key')

  useEffect(() => {
    if (!googleMapsApiKey) {
      setMapStatus('missing-key')
      return undefined
    }

    let isMounted = true

    const clearMapItems = () => {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null))
      markersRef.current.forEach((marker) => marker.setMap(null))
      rendererRef.current?.setMap(null)
      overlaysRef.current = []
      markersRef.current = []
      rendererRef.current = null
    }

    loadGoogleMaps()
      .then(({ maps }) => {
        if (!isMounted || !mapElementRef.current) return

        clearMapItems()

        const map = new maps.Map(mapElementRef.current, {
          center: course.center,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: true,
        })

        const renderer = new maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: false,
          polylineOptions: {
            strokeColor: '#ee5b4f',
            strokeOpacity: 0.92,
            strokeWeight: 6,
          },
        })
        rendererRef.current = renderer

        const service = new maps.DirectionsService()
        const travelMode = transport === '도보' ? maps.TravelMode.WALKING : maps.TravelMode.DRIVING

        service.route(
          {
            origin: course.places[0].location,
            destination: course.places.at(-1).location,
            waypoints: course.places.slice(1, -1).map((place) => ({
              location: place.location,
              stopover: true,
            })),
            optimizeWaypoints: false,
            travelMode,
          },
          (result, status) => {
            if (!isMounted) return

            if (status !== 'OK' || !result) {
              setMapStatus('route-error')
              return
            }

            renderer.setDirections(result)
            const route = result.routes[0]
            const bounds = new maps.LatLngBounds()
            const nextLegs = route.legs.map((leg, index) => {
              bounds.extend(leg.start_location)
              bounds.extend(leg.end_location)

              const marker = new maps.Marker({
                map,
                position: leg.start_location,
                title: course.places[index].name,
                label: { text: `${index + 1}`, color: '#ffffff', fontWeight: '800' },
              })
              marker.addListener('click', () => onSelectPlace(index))
              markersRef.current.push(marker)

              const midpoint = {
                lat: (leg.start_location.lat() + leg.end_location.lat()) / 2,
                lng: (leg.start_location.lng() + leg.end_location.lng()) / 2,
              }
              const overlay = createRouteTimeOverlay(maps, midpoint, leg.duration?.text || course.places[index].time)
              overlay.setMap(map)
              overlaysRef.current.push(overlay)

              return {
                from: course.places[index].name,
                to: course.places[index + 1].name,
                duration: leg.duration?.text || course.places[index].time,
              }
            })

            const finalMarker = new maps.Marker({
              map,
              position: route.legs.at(-1).end_location,
              title: course.places.at(-1).name,
              label: { text: `${course.places.length}`, color: '#ffffff', fontWeight: '800' },
            })
            finalMarker.addListener('click', () => onSelectPlace(course.places.length - 1))
            markersRef.current.push(finalMarker)

            map.fitBounds(bounds, 80)
            onRouteReady(nextLegs)
            setMapStatus('ready')
          },
        )
      })
      .catch(() => {
        if (isMounted) setMapStatus('load-error')
      })

    return () => {
      isMounted = false
      clearMapItems()
    }
  }, [course, transport, onRouteReady, onSelectPlace])

  useEffect(() => {
    markersRef.current.forEach((marker, index) => {
      marker.setAnimation(index === selectedPlace ? window.google?.maps?.Animation?.BOUNCE : null)
      if (index === selectedPlace) {
        window.setTimeout(() => marker.setAnimation(null), 700)
      }
    })
  }, [selectedPlace])

  return (
    <div className="route-map google-route-map">
      <div ref={mapElementRef} className="google-map-canvas" aria-label="구글맵 추천 동선" />
      {mapStatus === 'loading' && <MapNotice title="구글맵 불러오는 중" text="경로와 소요 시간을 계산하고 있어요." />}
      {mapStatus === 'missing-key' && <MapNotice title="Google Maps API 키가 필요해요" text="react project2/.env 파일에 VITE_GOOGLE_MAPS_API_KEY를 넣으면 실제 지도와 경로가 표시됩니다." />}
      {mapStatus === 'load-error' && <MapNotice title="지도 로드 실패" text="API 키, 결제 설정, 도메인 제한을 확인해 주세요." />}
      {mapStatus === 'route-error' && <MapNotice title="경로 계산 실패" text="선택한 이동수단으로 경로를 찾지 못했어요. 자차 또는 도보로 다시 시도해 주세요." />}
      <div className="map-api-badges">
        <span>Google Maps API</span>
        <span>Directions API</span>
      </div>
    </div>
  )
}

function createRouteTimeOverlay(maps, position, text) {
  class RouteTimeOverlay extends maps.OverlayView {
    constructor() {
      super()
      this.position = new maps.LatLng(position.lat, position.lng)
      this.text = text
      this.div = null
    }

    onAdd() {
      this.div = document.createElement('button')
      this.div.type = 'button'
      this.div.className = 'google-time-badge'
      this.div.textContent = this.text
      this.getPanes().floatPane.appendChild(this.div)
    }

    draw() {
      const point = this.getProjection().fromLatLngToDivPixel(this.position)
      if (!point || !this.div) return
      this.div.style.left = `${point.x}px`
      this.div.style.top = `${point.y}px`
    }

    onRemove() {
      this.div?.remove()
      this.div = null
    }
  }

  return new RouteTimeOverlay()
}

function MapNotice({ title, text }) {
  return (
    <div className="map-notice">
      <b>{title}</b>
      <span>{text}</span>
    </div>
  )
}

function Segment({ title, options, value, onChange }) {
  return (
    <fieldset className="segment">
      <legend>{title}</legend>
      <div>
        {options.map((option) => (
          <button key={option} className={value === option ? 'selected' : ''} type="button" onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Score({ label, value }) {
  return (
    <div className="score">
      <div>
        <b>{label}</b>
        <span>{value}점</span>
      </div>
      <meter min="0" max="100" value={value}></meter>
    </div>
  )
}

function Icon({ type }) {
  const icons = {
    leaf: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 4C11 4 6 8.5 6 15a5 5 0 0 0 5 5c6.5 0 9-7 9-16Z" />
        <path d="M4 20c3-6 7-9 12-11" />
      </svg>
    ),
    fork: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3v8" />
        <path d="M9 3v8" />
        <path d="M6 7h3" />
        <path d="M7.5 11v10" />
        <path d="M16 3v18" />
        <path d="M16 3c3 2 3 7 0 9" />
      </svg>
    ),
    family: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="7" r="3" />
        <circle cx="17" cy="8" r="2.5" />
        <path d="M3 21c.5-4 2.5-7 5-7s4.5 3 5 7" />
        <path d="M13 21c.4-3.4 2-5.8 4-5.8s3.6 2.4 4 5.8" />
      </svg>
    ),
    heart: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20s-7-4.4-9-9.2C1.4 7 3.7 4 7 4c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.3 0 5.6 3 4 6.8C19 15.6 12 20 12 20Z" />
      </svg>
    ),
    pin: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  }
  return icons[type] || null
}

export default App
