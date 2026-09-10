const openWeatherApiKey = process.env.OPENWEATHER_API_KEY

// OpenWeatherMap 의 weather.main 값을 화면에 쓸 이모지로 단순 매핑.
const EMOJI_BY_MAIN = {
  Clear: '☀️',
  Clouds: '⛅',
  Rain: '🌧️',
  Drizzle: '🌦️',
  Thunderstorm: '⛈️',
  Snow: '❄️',
  Mist: '🌫️',
  Fog: '🌫️',
  Haze: '🌫️',
}

export async function fetchCurrentWeather(lat, lng) {
  if (!openWeatherApiKey) throw new Error('OPENWEATHER_API_KEY가 설정되지 않았어요.')

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    appid: openWeatherApiKey,
    units: 'metric',
    lang: 'kr',
  })

  const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params}`)
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.weather?.[0]) {
    throw new Error(data?.message || '날씨 정보를 가져오지 못했어요.')
  }

  return {
    tempC: Math.round(data.main.temp),
    description: data.weather[0].description,
    emoji: EMOJI_BY_MAIN[data.weather[0].main] || '🌡️',
  }
}

// OpenWeatherMap 의 dt(초 단위 유닉스 타임스탬프)는 항상 UTC 기준이다. 이 앱은 국내 여행지만
// 다루니 KST(UTC+9)로 환산해서 날짜/시각을 구해야 "예보 날짜"가 실제 한국 달력 날짜와 맞는다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
function toKstDate(unixSeconds) {
  return new Date(unixSeconds * 1000 + KST_OFFSET_MS)
}
function kstDateString(unixSeconds) {
  return toKstDate(unixSeconds).toISOString().slice(0, 10)
}
function kstHour(unixSeconds) {
  return toKstDate(unixSeconds).getUTCHours()
}

// OpenWeatherMap 무료 티어는 "5일/3시간 간격" 예보만 제공한다. 3시간 단위 항목을
// KST 날짜별로 묶어서 하루 요약(최저/최고 기온 + 정오에 가장 가까운 시각의 날씨)으로 만든다.
export async function fetchForecast(lat, lng, startDateStr, endDateStr) {
  if (!openWeatherApiKey) throw new Error('OPENWEATHER_API_KEY가 설정되지 않았어요.')

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    appid: openWeatherApiKey,
    units: 'metric',
    lang: 'kr',
  })

  const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?${params}`)
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.list) {
    throw new Error(data?.message || '날씨 예보를 가져오지 못했어요.')
  }

  const entriesByDate = new Map()
  for (const entry of data.list) {
    const dateStr = kstDateString(entry.dt)
    if (!entriesByDate.has(dateStr)) entriesByDate.set(dateStr, [])
    entriesByDate.get(dateStr).push(entry)
  }

  // startDateStr/endDateStr("YYYY-MM-DD")를 서버 로컬 타임존으로 파싱하면 UTC 변환 과정에서
  // 하루씩 밀릴 수 있어(예: KST 자정은 전날 UTC 15시), 날짜 문자열을 UTC 자정으로 고정해서 순회한다.
  const days = []
  let cursor = new Date(`${startDateStr}T00:00:00Z`)
  const end = new Date(`${endDateStr}T00:00:00Z`)
  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const entries = entriesByDate.get(dateStr)

    if (!entries || entries.length === 0) {
      days.push({ date: dateStr, available: false })
    } else {
      const temps = entries.map((entry) => entry.main.temp)
      const noonEntry = entries.reduce((closest, entry) =>
        Math.abs(kstHour(entry.dt) - 12) < Math.abs(kstHour(closest.dt) - 12) ? entry : closest,
      )
      days.push({
        date: dateStr,
        available: true,
        minC: Math.round(Math.min(...temps)),
        maxC: Math.round(Math.max(...temps)),
        description: noonEntry.weather[0].description,
        // main: OpenWeatherMap 날씨 대분류(Rain/Snow/Clear…). 프런트에서 "궂은 날" 판정에 쓴다.
        main: noonEntry.weather[0].main,
        emoji: EMOJI_BY_MAIN[noonEntry.weather[0].main] || '🌡️',
      })
    }

    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  return days
}
