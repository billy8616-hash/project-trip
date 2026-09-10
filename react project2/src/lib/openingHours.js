// 서버가 이미 파싱해 넘겨준 영업시간 필드(opensAt/closesAt/alwaysOpen/closedWeekdays)를
// 코스 로직에서 해석하는 순수 헬퍼. 파싱 자체는 server/openingHours.js 가 담당한다.
// (도착 시각과 영업시간을 대조하는 로직은 schedule.js 로 옮겨갔다.)

// 여행 날짜(YYYY-MM-DD)에 이 장소가 정기 휴무인지. 데이터가 없으면(빈 배열) 항상 false.
export function isClosedOnDate(place, isoDate) {
  const closedWeekdays = place?.closedWeekdays
  if (!isoDate || !Array.isArray(closedWeekdays) || closedWeekdays.length === 0) return false
  const weekday = new Date(`${isoDate}T00:00:00`).getDay()
  return closedWeekdays.includes(weekday)
}
