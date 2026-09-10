import { useEffect, useState } from 'react'
import { destinationCatalog } from '../data/destinations.js'
import { fetchCityThumbnails, fetchCityTrends, fetchWeather } from '../lib/api.js'

// 여행지 카드의 대표 사진과 "지금 뜨는 중" 배지. 둘 다 카탈로그 전체를 한 번만 받아 온다.
// 부가 정보라서 실패해도 조용히 넘어간다 — 사진은 일러스트 썸네일로, 배지는 그냥 안 뜨는 것으로 대체된다.
export function useCityHighlights() {
  const [photos, setPhotos] = useState({})
  const [trends, setTrends] = useState({})

  useEffect(() => {
    let isMounted = true
    const cityNames = destinationCatalog.map((item) => item.name)

    fetchCityThumbnails(cityNames)
      .then((thumbnails) => {
        if (isMounted) setPhotos((prev) => ({ ...prev, ...thumbnails }))
      })
      .catch(() => {})

    fetchCityTrends(cityNames)
      .then((cityTrends) => {
        if (isMounted) setTrends((prev) => ({ ...prev, ...cityTrends }))
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [])

  return { photos, trends }
}

// 코스 화면 상단 날씨 배지. 도시 좌표가 정해진 뒤에 한 번만 부르고 도시별로 캐시한다.
// 날씨도 부가 정보라 실패하면 배지만 안 뜨고 코스 화면은 그대로 동작한다.
export function useCityWeather(cityKey, cityCenter) {
  const [weatherByCity, setWeatherByCity] = useState({})

  useEffect(() => {
    if (!cityCenter || weatherByCity[cityKey]) return undefined
    let isMounted = true

    fetchWeather(cityCenter.lat, cityCenter.lng)
      .then((data) => {
        if (isMounted) setWeatherByCity((prev) => ({ ...prev, [cityKey]: data }))
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [cityKey, cityCenter, weatherByCity])

  return weatherByCity[cityKey] || null
}
