// ─────────────────────────────────────────────────────────────
// hooks/useCourseBuilder.js — 조건 → 장소 풀 → 코스 계산 파이프라인
//
// App.jsx 에 있던 "코스 생성" 블록을 그대로 옮긴 것이다. 여행 조건(useTripPlan)과
// 타임라인 편집 상태(currentTimelineDays/manualOrderDays)를 받아서, 도시 장소 풀을
// 불러오고 buildCourse 로 코스를 짠 뒤, 화면(타임라인·지도)이 바로 쓸 수 있는
// 모양(coursePlaces·courseRoutes 등)까지 만들어 돌려준다.
//
// 상태 흐름: 조건 → 장소 풀(useCityPool) → buildCourse → course
//           → 편집(currentTimelineDays) → displayPlaces → 타임라인·지도에 표시
//
// currentTimelineDays/manualOrderDays 는 호출부(App.jsx)가 들고 있는 state를
// 그대로 받는다 — 도시/테마/예산/일수가 바뀌면 이 훅이 그 편집 결과를 리셋하기
// 때문에 setter 도 함께 필요하다.
//
// 쓰는 곳: App.jsx
// ─────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { SLOT_LABELS } from '../data/travelOptions.js'
import { buildCourse, insertManualBySlot } from '../lib/course.js'
import { placeKindOf } from '../lib/placeKind.js'
import { formatClock, parseClock, scheduleDay } from '../lib/schedule.js'
import { formatStay } from '../lib/stayTime.js'
import { feeLabelOf } from '../lib/cost.js'
import { transitLabelOf } from '../lib/transit.js'
import { resolveImageUrl } from '../lib/api.js'
import { addDaysISO, parseDayCount } from '../lib/datetime.js'
import { optimizeRouteOrderBySlot } from '../lib/geo.js'
import { useCityPool } from './useCityPool.js'
import { useTripForecast } from './useTripForecast.js'

export function useCourseBuilder({
  cityKey,
  journeyTheme,
  budget,
  transport,
  mustVisit,
  courseAnchors,
  tripStartDate,
  tripEndDate,
  duration,
  dayStartTime,
  selectedDay,
  currentTimelineDays,
  setCurrentTimelineDays,
  manualOrderDays,
  setManualOrderDays,
}) {
  const { data: cityData, status: cityPoolStatus, retry: retryCityPool } = useCityPool(cityKey)

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
      // 거리 최적화(optimizeRouteOrderBySlot)는 추천 코스 장소만 대상으로 한다. 직접 추가한 장소를
      // 같이 넣으면 좌표가 가깝다는 이유만으로 시간대 라벨과 무관하게 아무 자리에나 꽂힌다.
      const recommended = merged.filter((place) => !place.manual)
      const manual = merged.filter((place) => place.manual)
      ordered = insertManualBySlot(optimizeRouteOrderBySlot(recommended, courseAnchors), manual)
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

  return {
    cityData,
    cityPoolStatus,
    retryCityPool,
    dayCount,
    dayStartMin,
    course,
    placeByName,
    displayPlaces,
    allDaysScheduled,
    usedPlaceNames,
    coursePlaces,
    courseRoutes,
  }
}
