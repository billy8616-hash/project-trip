// ─────────────────────────────────────────────────────────────
// lib/datetime.js — 날짜 계산·표기 헬퍼
//
// 앱은 날짜를 항상 ISO 문자열(YYYY-MM-DD)로 들고 다닌다. Date 객체를 그대로
// 돌리면 시간대·시각이 섞여 비교가 어긋나기 때문이다. 이 파일은 그 문자열을
// 만들고·더하고·사람이 읽는 라벨로 바꾸는 일만 한다.
//
// 주요 함수
//   formatShortDate(iso)        "3/14 (금)" 형태의 짧은 표기
//   todayISO()                  오늘 날짜(YYYY-MM-DD)
//   addDaysISO(iso, n)          n일 뒤 날짜
//   nightsBetween(start, end)   두 날짜 사이 박수
//   durationLabelFromNights(n)  박수 → "2박 3일" 라벨
//   parseDayCount(label)        "2박 3일" 라벨 → 일수(3)
//
// 쓰는 곳: App.jsx · DateRangeField · useTripPlan · DatesScreen · MyTripsScreen
// ─────────────────────────────────────────────────────────────

import { durationToDays } from '../data/travelOptions.js'

// Date.getDay() 가 돌려주는 0~6 을 그대로 인덱스로 쓰기 위해 일요일부터 시작한다.
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// ISO 날짜를 "3/14 (금)" 처럼 짧게 표기한다. 타임라인 헤더·내 여행 카드에 쓴다.
// T00:00:00 을 붙여 로컬 자정으로 해석시킨다 — 안 붙이면 UTC 로 읽혀 하루가 밀릴 수 있다.
export function formatShortDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`)
  return `${date.getMonth() + 1}/${date.getDate()} (${WEEKDAYS[date.getDay()]})`
}

// 날짜 선택 화면(출발일/귀가일)에서 여행 기간(duration 라벨)을 계산할 때 쓰는 헬퍼들.
export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ISO 날짜(YYYY-MM-DD)에 n일을 더한 ISO 날짜. Day 2·Day 3 탭의 날짜 라벨에 쓴다.
export function addDaysISO(dateStr, n) {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setDate(date.getDate() + n)
  return date.toISOString().slice(0, 10)
}

// 출발일~귀가일 사이의 박수. 같은 날이면 0(당일치기)이다.
export function nightsBetween(startDateStr, endDateStr) {
  const start = new Date(`${startDateStr}T00:00:00`)
  const end = new Date(`${endDateStr}T00:00:00`)
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

// 박수를 사용자에게 보여 줄 라벨로 바꾼다. 0박은 "당일"로 따로 표기한다.
export function durationLabelFromNights(nights) {
  return nights <= 0 ? '당일' : `${nights}박 ${nights + 1}일`
}

// durations 배열에 없는(4박 5일 이상) 라벨도 날짜 선택 화면에서 만들어질 수 있어
// durationToDays 고정 매핑 대신 라벨 끝의 "N일"을 직접 읽어서 일수를 구한다.
export function parseDayCount(label) {
  const match = /(\d+)일$/.exec(label || '')
  if (match) return Number(match[1])
  return durationToDays[label] || 1
}
