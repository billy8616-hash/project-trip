import { durationToDays } from '../data/travelOptions.js'

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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

export function nightsBetween(startDateStr, endDateStr) {
  const start = new Date(`${startDateStr}T00:00:00`)
  const end = new Date(`${endDateStr}T00:00:00`)
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

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
