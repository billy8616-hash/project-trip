import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchCarRoute, fetchTransitRoute } from '../lib/api.js'
import { kakaoMapApiKey, legColor, loadKakaoMaps } from '../lib/kakaoMaps.js'
import { estimateTravelMin, formatMinutes } from '../lib/travelTime.js'
import MapNotice from './MapNotice.jsx'

function stopLabel(stop) {
  if (stop.kind === 'origin') return '출발'
  if (stop.kind === 'lodging') return '숙소'
  if (stop.kind === 'return') return '복귀'
  return `${stop.placeNo}`
}

// 좌표열의 각 마디를 per 등분해 촘촘하게 만든다 — 직선 구간을 부드럽게 자라나게 하려고.
function densifyPath(pts, per, kakao) {
  if (pts.length < 2) return pts
  const out = [pts[0]]
  for (let s = 1; s < pts.length; s += 1) {
    const aLat = pts[s - 1].getLat()
    const aLng = pts[s - 1].getLng()
    const dLat = pts[s].getLat() - aLat
    const dLng = pts[s].getLng() - aLng
    for (let k = 1; k <= per; k += 1) {
      out.push(new kakao.maps.LatLng(aLat + (dLat * k) / per, aLng + (dLng * k) / per))
    }
  }
  return out
}

// 한 구간 선을 path 를 비웠다가 좌표를 조금씩 이어붙여 "톡-톡-톡" 그려 넣는다.
// 반환값을 호출하면 애니메이션을 멈추고 원본 전체 경로로 되돌린다.
function traceEntries(entries, { steps = 16, intervalMs = 22 } = {}) {
  const kakao = window.kakao
  const plans = entries.map((entry) => {
    const full = entry.line.getPath()
    const dense = full.length <= 3 ? densifyPath(full, 24, kakao) : full
    entry.line.setPath([])
    entry.outline.setPath([])
    return { entry, full, dense }
  })

  let step = 0
  let timer = null
  let cancelled = false
  const tick = () => {
    if (cancelled) return
    step += 1
    plans.forEach(({ entry, full, dense }) => {
      const slice = step >= steps ? full : dense.slice(0, Math.max(2, Math.round((dense.length * step) / steps)))
      entry.line.setPath(slice)
      entry.outline.setPath(slice)
    })
    if (step < steps) timer = window.setTimeout(tick, intervalMs)
  }
  tick()

  return () => {
    cancelled = true
    window.clearTimeout(timer)
    plans.forEach(({ entry, full }) => {
      entry.line.setPath(full)
      entry.outline.setPath(full)
    })
  }
}

export default function KakaoRouteMap({ course, places, origin, endPoint, transport, selectedPlace, selectPulse = 0, onSelectPlace, onRouteReady }) {
  const mapElementRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const polylinesRef = useRef([])
  const traceTimerRef = useRef(null)
  const clickTraceCancelRef = useRef(null)
  const firstTraceRef = useRef(true)
  const prevSelRef = useRef({ selectedPlace: null, selectPulse: -1 })
  // 마지막으로 그리기를 끝낸 입력(stops/transport)과 그 결과를 함께 들고 있는다.
  // effect 안에서 'loading' 으로 되돌리는 대신, 지금 입력이 그려진 입력과 다르면
  // 아직 그리는 중으로 렌더 중에 판단한다 (재렌더가 한 번 줄고, effect 가 상태를 되감지 않는다).
  const [drawn, setDrawn] = useState(null) // { stops, transport, status, source }

  // 실제 그릴 정류장 목록: [출발지] + 좌표가 있는 장소들 + [숙소 또는 복귀지].
  // 장소는 placeNo(1,2,3…)와 focusIndex(선택 동기화용 원래 인덱스)를 갖고,
  // 앵커(출발지·숙소·복귀지)는 kind 로 구분한다.
  const stops = useMemo(() => {
    const real = places
      .map((place, index) => ({ ...place, kind: 'place', placeNo: index + 1, focusIndex: index }))
      .filter((place) => place.location)
    const list = []
    if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
      list.push({
        name: origin.label || '출발지',
        location: { lat: origin.lat, lng: origin.lng },
        kind: 'origin',
        focusIndex: 0,
      })
    }
    list.push(...real)
    if (endPoint && Number.isFinite(endPoint.lat) && Number.isFinite(endPoint.lng)) {
      list.push({
        name: endPoint.label || (endPoint.isLodging ? '숙소' : '복귀'),
        location: { lat: endPoint.lat, lng: endPoint.lng },
        kind: endPoint.isLodging ? 'lodging' : 'return',
        focusIndex: Math.max(0, real.length - 1),
      })
    }
    return list
  }, [places, origin, endPoint])

  const isCurrent = Boolean(drawn) && drawn.stops === stops && drawn.transport === transport
  const mapStatus = !kakaoMapApiKey ? 'missing-key' : isCurrent ? drawn.status : 'loading'
  const routeSource = isCurrent ? drawn.source : 'estimate'

  useEffect(() => {
    // kakaoMapApiKey 는 빌드 시점에 정해지는 모듈 상수라, 없으면 위 파생에서 이미 'missing-key' 다.
    if (!kakaoMapApiKey) return undefined

    let isMounted = true

    const clearMapItems = () => {
      window.clearTimeout(traceTimerRef.current)
      clickTraceCancelRef.current?.()
      clickTraceCancelRef.current = null
      markersRef.current.forEach((marker) => marker?.overlay.setMap(null))
      polylinesRef.current.forEach((entry) => {
        entry.outline?.setMap(null)
        entry.line?.setMap(null)
      })
      markersRef.current = []
      polylinesRef.current = []
    }

    // 구간 선을 구간번호(legIndex)·기본 두께·색과 함께 보관한다 — 나중에 번쩍이기(flash)에 쓴다.
    const registerLeg = (outline, line, legIndex, baseWeight, baseColor) => {
      polylinesRef.current.push({ outline, line, legIndex, baseWeight, baseColor })
    }

    loadKakaoMaps()
      .then((kakao) => {
        if (!isMounted || !mapElementRef.current) return

        clearMapItems()

        const map = new kakao.maps.Map(mapElementRef.current, {
          center: new kakao.maps.LatLng(course.center.lat, course.center.lng),
          level: 6,
        })
        mapRef.current = map

        const fitToStops = () => {
          if (stops.length === 1) {
            map.setCenter(new kakao.maps.LatLng(stops[0].location.lat, stops[0].location.lng))
            map.setLevel(4)
          } else if (stops.length > 1) {
            const bounds = new kakao.maps.LatLngBounds()
            stops.forEach((stop) =>
              bounds.extend(new kakao.maps.LatLng(stop.location.lat, stop.location.lng)),
            )
            map.setBounds(bounds, 80, 80, 80, 80)
          }
        }

        // 장소는 번호(1,2,3…) 마커, 출발지·숙소·복귀지는 라벨 마커로 구분해서 찍는다.
        const placeStopMarker = (stop) => {
          const position = new kakao.maps.LatLng(stop.location.lat, stop.location.lng)
          const el = document.createElement('button')
          el.type = 'button'
          el.title = stop.name
          el.textContent = stopLabel(stop)
          if (stop.kind === 'place') {
            el.className = 'kakao-place-marker'
            // 번호 마커 색을 그 지점에서 "나가는" 구간 선 색과 맞춘다 (마지막 지점은 "들어오는" 구간 색).
            const stopIndex = stops.indexOf(stop)
            const legIndex = stopIndex < stops.length - 1 ? stopIndex : Math.max(0, stopIndex - 1)
            el.style.setProperty('--marker-color', legColor(legIndex))
            el.addEventListener('click', () => onSelectPlace(stop.focusIndex))
          } else {
            el.className = `kakao-place-marker kakao-anchor-marker is-${stop.kind}`
          }

          const overlay = new kakao.maps.CustomOverlay({
            map,
            position,
            content: el,
            yAnchor: 0.5,
            zIndex: stop.kind === 'place' ? 3 : 4,
          })
          markersRef.current.push({
            overlay,
            element: el,
            position,
            placeNo: stop.kind === 'place' ? stop.placeNo : null,
            stopIndex: stops.indexOf(stop),
          })
        }

        // 구간(정류장 i -> i+1)의 라벨과, 클릭 시 선택할 장소 인덱스.
        // 지도 위에는 구간 시간을 더 이상 얹지 않는다 — 그 정보는 지도 아래 레일(route-rail)이 담당한다.
        const legMeta = (index) => {
          const a = stops[index]
          const b = stops[index + 1]
          return {
            from: a.name,
            to: b.name,
            fromLabel: stopLabel(a),
            toLabel: stopLabel(b),
            label: `${stopLabel(a)} → ${stopLabel(b)}`,
            focusIndex: b.kind === 'place' ? b.focusIndex : a.focusIndex,
          }
        }

        // 구간 선을 한 번에 띄우지 않고 앞 구간부터 톡-톡-톡 순서대로 그려 넣는다(트레이싱).
        const traceLegs = () => {
          window.clearTimeout(traceTimerRef.current)
          const plans = polylinesRef.current.map((entry) => {
            const full = entry.line.getPath()
            const dense = full.length <= 3 ? densifyPath(full, 24, kakao) : full
            entry.line.setPath([])
            entry.outline.setPath([])
            return { entry, full, dense }
          })

          const STEPS = 18
          let li = 0
          const runLeg = () => {
            if (!isMounted || li >= plans.length) return
            const { entry, full, dense } = plans[li]
            let step = 0
            const grow = () => {
              if (!isMounted) return
              step += 1
              const upto = Math.max(2, Math.round((dense.length * step) / STEPS))
              const slice = dense.slice(0, upto)
              entry.line.setPath(slice)
              entry.outline.setPath(slice)
              if (step < STEPS) {
                traceTimerRef.current = window.setTimeout(grow, 18)
              } else {
                entry.line.setPath(full)
                entry.outline.setPath(full)
                li += 1
                traceTimerRef.current = window.setTimeout(runLeg, 90) // 구간 사이 짧은 텀
              }
            }
            grow()
          }
          runLeg()
        }

        if (stops.length < 2) {
          stops.forEach(placeStopMarker)
          fitToStops()
          onRouteReady([])
          setDrawn({ stops, transport, status: 'ready', source: 'estimate' })
          return
        }

        // 카카오맵 JS SDK는 길찾기 API를 제공하지 않아 장소 좌표를 직선으로 이어 예상 동선을 그린다.
        // (대중교통·도보 기본값이자, 자동차 모드에서 실제 경로 조회에 실패했을 때의 대체 경로)
        const drawFallbackRoute = () => {
          const nextLegs = stops.slice(0, -1).map((stop, index) => {
            const from = stops[index].location
            const to = stops[index + 1].location
            const color = legColor(index)
            const segPath = [
              new kakao.maps.LatLng(from.lat, from.lng),
              new kakao.maps.LatLng(to.lat, to.lng),
            ]
            // 지도 배경(도로 빨간선 등) 위에서도 눈에 띄도록 흰 테두리를 먼저 깔고, 그 위에 구간별 색선을 얹는다.
            const outline = new kakao.maps.Polyline({
              map,
              path: segPath,
              strokeWeight: 8,
              strokeColor: '#ffffff',
              strokeOpacity: 0.85,
              strokeStyle: 'solid',
            })
            const polyline = new kakao.maps.Polyline({
              map,
              path: segPath,
              strokeWeight: 5,
              strokeColor: color,
              strokeOpacity: 0.95,
              strokeStyle: 'shortdash',
            })
            registerLeg(outline, polyline, index, 5, color)

            const meta = legMeta(index)
            const estMinutes = stops[index].kind === 'place' && stops[index].time ? stops[index].time : `${estimateTravelMin(stops[index], stops[index + 1], transport)}분`
            placeStopMarker(stops[index])
            return { ...meta, duration: estMinutes, summary: null }
          })

          placeStopMarker(stops[stops.length - 1])
          fitToStops()
          onRouteReady(nextLegs)
          setDrawn({ stops, transport, status: 'ready', source: 'estimate' })
          traceLegs()
        }

        // 자동차 모드: 카카오모빌리티 길찾기(서버 경유)로 실제 도로를 따라가는 경로를 그린다.
        const drawCarRoute = () => {
          fetchCarRoute(stops)
            .then((data) => {
              if (!isMounted) return

              const bounds = new kakao.maps.LatLngBounds()

              const nextLegs = data.sections.map((section, index) => {
                const color = legColor(index)
                const segPath = section.path.map((point) => {
                  const latlng = new kakao.maps.LatLng(point.lat, point.lng)
                  bounds.extend(latlng)
                  return latlng
                })
                // 지도 배경(도로 빨간선 등) 위에서도 눈에 띄도록 흰 테두리를 먼저 깔고, 그 위에 구간별 색선을 얹는다.
                const outline = new kakao.maps.Polyline({
                  map,
                  path: segPath,
                  strokeWeight: 11,
                  strokeColor: '#ffffff',
                  strokeOpacity: 0.9,
                  strokeStyle: 'solid',
                })
                const polyline = new kakao.maps.Polyline({
                  map,
                  path: segPath,
                  strokeWeight: 6,
                  strokeColor: color,
                  strokeOpacity: 0.97,
                  strokeStyle: 'solid',
                })
                registerLeg(outline, polyline, index, 6, color)

                const minutes = formatMinutes(section.duration)
                const meta = legMeta(index)
                placeStopMarker(stops[index])
                return { ...meta, duration: minutes, summary: null }
              })

              placeStopMarker(stops[stops.length - 1])
              stops.forEach((stop) => bounds.extend(new kakao.maps.LatLng(stop.location.lat, stop.location.lng)))
              map.setBounds(bounds, 80, 80, 80, 80)
              onRouteReady(nextLegs)
              setDrawn({ stops, transport, status: 'ready', source: 'car' })
              traceLegs()
            })
            .catch((error) => {
              if (!isMounted) return
              console.warn(`[route] 카카오모빌리티 길찾기 실패: ${error.message}`)
              drawFallbackRoute()
            })
        }

        // 대중교통 모드: ODsay 경로가 있는 구간은 실제 노선을 따라 실선으로 그리고 배지에 노선명(2호선, 402번)을 넣는다.
        // 경로가 없는 구간(지방 시골 등)은 그 구간만 직선 점선 + 추정치로 남긴다.
        const drawTransitRoute = () => {
          fetchTransitRoute(stops)
            .then((data) => {
              if (!isMounted) return

              const bounds = new kakao.maps.LatLngBounds()

              const nextLegs = stops.slice(0, -1).map((_stop, index) => {
                const section = data.sections[index]
                const color = legColor(index)
                const meta = legMeta(index)
                const from = stops[index].location
                const to = stops[index + 1].location

                const coords = section ? section.path : [from, to]
                const segPath = coords.map((point) => {
                  const latlng = new kakao.maps.LatLng(point.lat, point.lng)
                  bounds.extend(latlng)
                  return latlng
                })

                // 지도 배경(도로 빨간선 등) 위에서도 눈에 띄도록 흰 테두리를 먼저 깔고, 그 위에 구간별 색선을 얹는다.
                const outline = new kakao.maps.Polyline({
                  map,
                  path: segPath,
                  strokeWeight: section ? 11 : 8,
                  strokeColor: '#ffffff',
                  strokeOpacity: 0.88,
                  strokeStyle: 'solid',
                })
                const polyline = new kakao.maps.Polyline({
                  map,
                  path: segPath,
                  strokeWeight: section ? 6 : 5,
                  strokeColor: color,
                  strokeOpacity: 0.96,
                  strokeStyle: section ? 'solid' : 'shortdash',
                })
                registerLeg(outline, polyline, index, section ? 6 : 5, color)

                const duration = section
                  ? `${section.totalMinutes}분`
                  : `${estimateTravelMin(stops[index], stops[index + 1], transport)}분`
                placeStopMarker(stops[index])
                return { ...meta, duration, summary: section?.summary || null }
              })

              placeStopMarker(stops[stops.length - 1])
              stops.forEach((stop) => bounds.extend(new kakao.maps.LatLng(stop.location.lat, stop.location.lng)))
              map.setBounds(bounds, 80, 80, 80, 80)
              onRouteReady(nextLegs)
              setDrawn({ stops, transport, status: 'ready', source: 'transit' })
              traceLegs()
            })
            .catch((error) => {
              if (!isMounted) return
              console.warn(`[route] ODsay 대중교통 길찾기 실패: ${error.message}`)
              drawFallbackRoute()
            })
        }

        if (transport === '자차') {
          drawCarRoute()
        } else if (transport === '대중교통') {
          drawTransitRoute()
        } else {
          drawFallbackRoute()
        }
      })
      .catch(() => {
        if (isMounted) setDrawn({ stops, transport, status: 'load-error', source: 'estimate' })
      })

    return () => {
      isMounted = false
      clearMapItems()
      mapRef.current = null
    }
  }, [course.center, stops, transport, onRouteReady, onSelectPlace])

  useEffect(() => {
    let selectedMarker = null
    markersRef.current.forEach((marker) => {
      if (!marker || marker.placeNo == null) return
      const isSelected = marker.placeNo - 1 === selectedPlace
      marker.element.classList.toggle('is-selected', isSelected)
      if (isSelected) {
        selectedMarker = marker
        mapRef.current?.panTo(marker.position)
        marker.element.classList.add('is-bouncing')
        window.setTimeout(() => marker.element.classList.remove('is-bouncing'), 700)
      }
    })

    // 번호를 누르면 그 번호와 같은 색 구간 선을 트레이싱으로 다시 그린다
    // (그 번호에서 나가는 구간, 마지막 번호면 들어오는 구간).
    const selChanged =
      prevSelRef.current.selectedPlace !== selectedPlace || prevSelRef.current.selectPulse !== selectPulse
    prevSelRef.current = { selectedPlace, selectPulse }
    if (!selChanged) return undefined // stops 변경 등으로 다시 돈 경우엔 (전체 트레이싱이 따로 돌므로) 무시
    // 첫 렌더(선택값 0)에서는 전체 트레이싱이 이미 돌므로 건너뛴다.
    if (firstTraceRef.current) {
      firstTraceRef.current = false
      return undefined
    }
    if (!selectedMarker) return undefined
    const lastLeg = Math.max(0, stops.length - 2)
    const targetLeg = Math.min(selectedMarker.stopIndex, lastLeg)
    const legs = polylinesRef.current.filter((entry) => entry.legIndex === targetLeg)
    if (legs.length === 0) return undefined

    clickTraceCancelRef.current?.() // 이전 클릭 트레이싱이 진행 중이면 정리
    clickTraceCancelRef.current = traceEntries(legs, { steps: 16, intervalMs: 24 })

    return () => {
      clickTraceCancelRef.current?.()
      clickTraceCancelRef.current = null
    }
  }, [selectedPlace, selectPulse, stops])

  return (
    <div className="route-map kakao-route-map">
      <div ref={mapElementRef} className="kakao-map-canvas" aria-label="카카오맵 추천 동선" />
      {mapStatus === 'loading' && <MapNotice title="카카오맵 불러오는 중" text="장소와 예상 이동 시간을 표시하고 있어요." />}
      {mapStatus === 'missing-key' && <MapNotice title="Kakao Maps API 키가 필요해요" text="react project2/.env 파일에 VITE_KAKAO_MAP_API_KEY를 넣으면 실제 지도가 표시됩니다." />}
      {mapStatus === 'load-error' && <MapNotice title="지도 로드 실패" text="API 키와 카카오 디벨로퍼스에 등록된 도메인(플랫폼) 설정을 확인해 주세요." />}
      {mapStatus === 'ready' && routeSource === 'estimate' && stops.length > 1 && (
        <div className="map-fallback-note">
          {transport === '자차'
            ? '실시간 자동차 경로를 불러오지 못해 장소를 잇는 예상 동선으로 표시했어요.'
            : '장소를 잇는 예상 동선과 이동 시간이에요. 실제 경로는 카카오맵에서 확인해 주세요.'}
        </div>
      )}
      {mapStatus === 'ready' && stops.length > 1 && (
        <div className="map-legend" aria-label="지도 경로 범례">
          <div className="map-legend-row">
            <span className="lg-swatch lg-seq" aria-hidden="true" />
            <span>번호·선 색: 이동 순서(1·2·3…)</span>
          </div>
          {routeSource !== 'estimate' && (
            <div className="map-legend-row">
              <span className="lg-swatch lg-solid" aria-hidden="true" />
              <span>실선: 실제 도로·노선</span>
            </div>
          )}
          <div className="map-legend-row">
            <span className="lg-swatch lg-dash" aria-hidden="true" />
            <span>점선: 예상 직선 동선</span>
          </div>
        </div>
      )}
      <div className="map-api-badges">
        <span>Kakao Maps API</span>
        {routeSource === 'car' && <span>카카오모빌리티 길찾기</span>}
        {routeSource === 'transit' && <span>ODsay 대중교통 길찾기</span>}
      </div>
    </div>
  )
}
