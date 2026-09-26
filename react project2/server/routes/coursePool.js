// ─────────────────────────────────────────────────────────────
// server/routes/coursePool.js — 도시 장소 풀 만들기
//
// 이 서버에서 가장 무거운 작업이다. 한 도시의 장소를 모으려면
//   TourAPI(관광지·문화시설) → 카카오 로컬(맛집·카페) → Google Places(영업시간·사진)
//   → 교통 접근성 → Gemini(추천 이유·테마) → DB 저장
// 을 차례로 거친다. 그래서 비용을 아끼는 장치가 곳곳에 들어가 있다.
//
//   · 이미 Gemini 보강을 받은 장소는 다시 보내지 않는다 (enrichmentFromRows)
//   · Google 은 30일 이내에 받아 둔 장소를 다시 부르지 않는다 (GOOGLE_REFRESH_MS)
//   · 한 번 돌 때의 호출 수에 상한을 둔다 (GOOGLE_LIMIT_PER_RUN · ENRICH_LIMIT_PER_RUN)
//     상한에 밀린 장소는 다음 갱신 때 차례가 오므로 커버리지가 조금씩 넓어진다
//
// buildCityPoolRows 는 server/prewarm.js 에서도 직접 부른다(캐시 미리 채우기).
// ─────────────────────────────────────────────────────────────

import express from 'express'
import { searchCafes, searchRestaurants } from '../kakaoLocal.js'
import { enrichPlaces } from '../placeEnrich.js'
import { fetchGoogleHoursMany, googlePhotoPath } from '../googlePlaces.js'
import { findCachedByIds, findCityPool, toPoolPlace, updatePlaceImages, upsertPlaces } from '../placeCache.js'
import { fetchPlaceDetailsMany, searchAttractions, searchCultureSpots } from '../tourApi.js'
import { fetchTransitAccessMany } from '../transit.js'

export const router = express.Router()

// 슬롯별 예상 체류/이동시간 기본값 (규칙 기반 — 실제 이동시간은 카카오맵이 별도로 계산한다).
const SLOT_DEFAULTS = {
  오전: { stay: '1시간', time: '15분' },
  '점심 맛집': { stay: '1시간', time: '10분' },
  '오후 카페': { stay: '50분', time: '12분' },
  저녁: { stay: '40분', time: '15분' },
}

function dedupeById(places) {
  const seen = new Map()
  for (const place of places) {
    if (!seen.has(place.id)) seen.set(place.id, place)
  }
  return [...seen.values()]
}

function cityCenter(places) {
  const withLocation = places.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
  if (withLocation.length === 0) return null
  const sum = withLocation.reduce((acc, place) => ({ lat: acc.lat + place.lat, lng: acc.lng + place.lng }), { lat: 0, lng: 0 })
  return { lat: sum.lat / withLocation.length, lng: sum.lng / withLocation.length }
}

// PlaceCache 에 JSON 배열 문자열로 저장된 칼럼(themes/budgetTiers)을 배열로 되돌린다.
function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// 이미 Gemini 보강을 받아 DB 에 저장된 장소의 추천문구/테마/예산대를 꺼내온다. -> Map(id -> enriched)
// 이 값들은 시간이 지나도 변하지 않는데(영업시간·폐업과 달리), 7일 staleness 갱신 때마다
// 도시 전체를 다시 Gemini 로 보내면 무료 티어 할당량이 새로 얻는 것 없이 나간다.
// 재사용 판별은 themes 가 비어있지 않은지로 한다 — 응답 스키마상 테마는 1~3개가 항상 붙으므로,
// 보강이 실패해 폴백 문구만 저장된 행은 "[]" 로 남아 있어 다음 갱신 때 자연히 다시 시도된다.
async function loadCachedRows(ids) {
  const rows = await findCachedByIds(ids).catch((error) => {
    console.warn(`[course-pool] 기존 캐시 조회 실패 — 전부 새로 받아옵니다: ${error.message}`)
    return []
  })
  return new Map(rows.map((row) => [row.id, row]))
}

// 캐시 행에서 재사용 가능한 Gemini 보강만 추려낸다. -> Map(id -> enriched)
function enrichmentFromRows(cachedRows) {
  const cached = new Map()
  for (const [id, row] of cachedRows) {
    const themes = parseJsonArray(row.themes)
    if (themes.length === 0) continue
    cached.set(id, {
      reason: row.reason || '',
      caution: row.caution || '',
      themes,
      budgetTiers: parseJsonArray(row.budgetTiers),
    })
  }
  return cached
}

// Google Places 는 장소 1곳당 유료 호출 1번이고, 영업시간·사진·평점을 한 번에 받아온다.
// 풀이 수백 곳으로 커진 뒤로는 도시 하나를 갱신할 때마다 그 수만큼 과금되므로,
// 한 번 받아둔 장소는 이 기간 동안 DB 값을 그대로 쓴다. (영업시간은 변하지만 매주 변하진 않는다.)
const GOOGLE_REFRESH_MS = 30 * 24 * 60 * 60 * 1000
// 한 번 돌 때 Google 을 부를 최대 장소 수. 넘긴 장소는 이번엔 캐시 값을 쓰고 다음 갱신 때 차례가 온다.
const GOOGLE_LIMIT_PER_RUN = 60

// Google 을 실제로 불러야 하는 장소를 고른다.
// 캐시가 아예 없는 신규 장소를 먼저(영업시간 정보가 0인 상태라 코스 품질에 바로 영향),
// 그 다음 오래된 순으로 채운다.
function selectForGoogle(kakaoPlaces, cachedRows, limit) {
  const fresh = []
  const brandNew = []
  const stale = []

  for (const place of kakaoPlaces) {
    const row = cachedRows.get(place.id)
    const fetchedAt = row?.hoursFetchedAt ? new Date(row.hoursFetchedAt).getTime() : 0
    if (!row || !fetchedAt) brandNew.push(place)
    else if (Date.now() - fetchedAt > GOOGLE_REFRESH_MS) stale.push({ place, fetchedAt })
    else fresh.push(place)
  }

  stale.sort((a, b) => a.fetchedAt - b.fetchedAt)
  const targets = [...brandNew, ...stale.map((entry) => entry.place)].slice(0, limit)
  return { targets, skipped: kakaoPlaces.length - targets.length, fresh: fresh.length }
}

// 캐시 행을 Google 응답과 같은 모양으로 되돌린다 (재사용 시 rows 빌드 코드를 그대로 쓰려고).
function hoursFromRow(row) {
  return {
    openHoursText: row.openHoursText,
    closedDayText: row.closedDayText,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    alwaysOpen: row.alwaysOpen,
    closedWeekdays: parseJsonArray(row.closedWeekdays),
    feeText: row.feeText,
    costTier: row.costTier,
    rating: row.rating,
    userRatingCount: row.userRatingCount,
    editorialSummary: row.editorialSummary,
    websiteUrl: row.websiteUrl,
    photoRef: null, // 사진은 imageUrl 로 이미 저장돼 있어 다시 만들 필요가 없다.
  }
}

// 한 번 돌 때 Gemini 로 보낼 장소 수 상한. 풀은 수백 곳이 될 수 있지만 코스에 실제로 쓰이는 건
// 하루 4곳 x 여행일수뿐이라 전부 보강할 이유가 없고, 무료 티어에서는 호출 수가 곧 비용이다.
// 상한에 걸려 밀린 장소는 다음 갱신 때 자연히 차례가 온다 — 이미 보강된 곳은 후보에서 빠지므로
// 갱신할 때마다 커버리지가 조금씩 넓어진다.
const ENRICH_LIMIT_PER_RUN = 80

// 상한 안에서 슬롯이 한쪽으로 쏠리지 않게 고른다.
// 그냥 앞에서부터 자르면 검색 결과 순서상 카페만 잔뜩 뽑혀 '저녁'·'점심' 슬롯엔 테마가 안 붙는다.
// 슬롯별로 돌아가며 한 곳씩 집어서, 모든 슬롯이 고르게 보강되도록 한다.
function selectForEnrichment(places, limit) {
  if (places.length <= limit) return places

  const bySlot = new Map()
  for (const place of places) {
    const slot = place.slot || place.slots?.[0] || '오전'
    if (!bySlot.has(slot)) bySlot.set(slot, [])
    bySlot.get(slot).push(place)
  }

  const queues = [...bySlot.values()]
  const picked = []
  while (picked.length < limit) {
    const before = picked.length
    for (const queue of queues) {
      if (picked.length >= limit) break
      const next = queue.shift()
      if (next) picked.push(next)
    }
    if (picked.length === before) break // 모든 큐가 비었다
  }
  return picked
}

// 외부 API/LLM 을 다 돌려 도시 하나의 장소 풀을 만들고 DB 에 저장한다. -> 저장한 rows
// (prewarm 스크립트에서도 직접 부른다.)
export async function buildCityPoolRows(cityKey) {
  const [attractions, cultureSpots, restaurants, cafes] = await Promise.all([
      searchAttractions(cityKey),
      searchCultureSpots(cityKey),
      searchRestaurants(cityKey),
      searchCafes(cityKey),
    ])

  const rawPlaces = dedupeById([...attractions, ...cultureSpots, ...restaurants, ...cafes])
  if (rawPlaces.length === 0) {
    throw new Error(`${cityKey}에서 장소를 찾지 못했어요.`)
  }

  // DB 캐시를 한 번만 읽어 Gemini 보강과 Google 영업시간 재사용 판단에 함께 쓴다.
  const cachedRows = await loadCachedRows(rawPlaces.map((place) => place.id))

  // 이미 보강된 장소는 Gemini 에 다시 보내지 않는다. 갱신 때 신규 장소가 없으면 호출 자체가 0번이 된다.
  const cachedEnrichment = enrichmentFromRows(cachedRows)
  const pending = rawPlaces.filter((place) => !cachedEnrichment.has(place.id))
  const needsEnrichment = selectForEnrichment(pending, ENRICH_LIMIT_PER_RUN)

  // Google 도 마찬가지 — 최근에 받아둔 장소는 DB 값을 그대로 쓴다.
  const kakaoPlaces = rawPlaces.filter((place) => place.source === 'kakao')
  const google = selectForGoogle(kakaoPlaces, cachedRows, GOOGLE_LIMIT_PER_RUN)

  console.log(
    `[course-pool] ${cityKey}: 풀 ${rawPlaces.length}곳 | ` +
      `Gemini 재사용 ${cachedEnrichment.size}·신규 ${needsEnrichment.length}` +
      `${pending.length > needsEnrichment.length ? `(대기 ${pending.length - needsEnrichment.length})` : ''} | ` +
      `Google 호출 ${google.targets.length}/${kakaoPlaces.length}곳 (재사용 ${google.skipped})`,
  )

  // 동시에 조회: 추천 텍스트(Gemini) · 관광지 주차·영업시간(TourAPI detailIntro2) ·
  // 음식점·카페 영업시간(Google Places) · 대중교통 접근성(카카오).
  // Gemini(추천문구·테마)는 실패해도 코스는 만들 수 있으므로(규칙 기반 슬롯/카테고리로 대체) 치명적으로 보지 않는다.
  const [enrichment, detailByPlaceId, googleHoursByPlaceId, transitByPlaceId] = await Promise.all([
      enrichPlaces(needsEnrichment.map((place) => ({ id: place.id, name: place.name, category: place.category }))).catch(
        (error) => {
          console.warn(`[course-pool] Gemini 보강 건너뜀: ${error.message?.slice(0, 120)}`)
          return new Map()
        },
      ),
      fetchPlaceDetailsMany(rawPlaces.filter((place) => place.source === 'tourapi')),
      fetchGoogleHoursMany(google.targets),
      fetchTransitAccessMany(rawPlaces),
    ])

    const rows = rawPlaces
      .map((place) => {
        // 이번에 새로 생성한 것 > DB 에 있던 기존 보강 > 폴백 순.
        const enriched =
          enrichment.get(place.id) || cachedEnrichment.get(place.id) || { reason: '', caution: '', themes: [], budgetTiers: [] }
        const slots = Array.isArray(place.slots) && place.slots.length > 0 ? place.slots : [place.slot || '오전']
        const defaults = SLOT_DEFAULTS[slots[0]] || SLOT_DEFAULTS['오전']
        const transit = transitByPlaceId.get(place.id) || { transitStation: null, transitDistanceM: null, transitScore: 'none' }
        const detail = detailByPlaceId.get(place.id) || {}
        const cachedRow = cachedRows.get(place.id)
        // 영업시간 출처: 카카오 장소는 Google Places, 관광지·문화시설은 TourAPI detailIntro2.
        // 이번에 Google 을 건너뛴 카카오 장소는 지난번에 받아 DB 에 넣어둔 값을 그대로 쓴다.
        const googleHours = googleHoursByPlaceId.get(place.id)
        const reusedHours = !googleHours && cachedRow && place.source === 'kakao' ? hoursFromRow(cachedRow) : null
        const hours = googleHours || reusedHours || detail
        return {
          id: place.id,
          source: place.source,
          cityKey,
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          slot: slots[0],
          slots: JSON.stringify(slots),
          category: place.category || '',
          stay: defaults.stay,
          time: defaults.time,
          parking: detail.parking || null,
          openHoursText: hours.openHoursText || null,
          closedDayText: hours.closedDayText || null,
          opensAt: hours.opensAt ?? null,
          closesAt: hours.closesAt ?? null,
          alwaysOpen: hours.alwaysOpen ?? false,
          closedWeekdays: JSON.stringify(hours.closedWeekdays || []),
          feeText: hours.feeText || '',
          costTier: hours.costTier || '',
          transitStation: transit.transitStation,
          transitDistanceM: transit.transitDistanceM,
          transitScore: transit.transitScore,
          // 대표 사진: 관광지·문화시설은 TourAPI 가 준 절대 URL, 맛집·카페는 Google 사진 프록시 경로.
          imageUrl: place.image || googlePhotoPath(hours.photoRef) || cachedRow?.imageUrl || null,
          // 카드 딥데이터 — 지금은 Google 소스(맛집·카페)만 채워진다. TourAPI(관광지)는 이 필드들이 없어 전부 null.
          rating: hours.rating ?? null,
          userRatingCount: hours.userRatingCount ?? null,
          editorialSummary: hours.editorialSummary ?? null,
          websiteUrl: hours.websiteUrl ?? null,
          reason: enriched.reason || `${place.name}, ${cityKey}에서 들러볼 만한 곳이에요.`,
          caution: enriched.caution || '방문 전 영업시간과 휴무일을 확인해 주세요.',
          themes: JSON.stringify(enriched.themes || []),
          budgetTiers: JSON.stringify(enriched.budgetTiers || []),
          // 이번에 Google 을 실제로 부른 장소만 시각을 새로 찍는다. 건너뛴 장소는 기존 시각을 유지해야
          // 다음 갱신 때 "오래된 순"에서 제 차례가 온다. (관광지는 Google 을 안 쓰므로 계속 null)
          hoursFetchedAt: googleHours ? new Date() : (cachedRow?.hoursFetchedAt ?? null),
        }
      })

  await upsertPlaces(rows)
  return rows
}

// 사진 칼럼이 생기기 전에 캐시된 장소들을 위한 보강.
// 풀 전체를 다시 만들면 Gemini·상세조회까지 또 돌아가니, 사진만 따로 채워 넣는다.
// (관광지·문화시설은 도시 검색 2번으로 전부 커버되고, 맛집·카페만 장소 단위로 조회한다.)
async function backfillCityImages(cityKey, rows) {
  const missing = rows.filter((row) => !row.imageUrl)
  if (missing.length === 0) return

  const tourRows = missing.filter((row) => row.source === 'tourapi')
  const kakaoRows = missing.filter((row) => row.source === 'kakao')

  const [tourPlaces, googleByPlaceId] = await Promise.all([
    tourRows.length === 0
      ? Promise.resolve([])
      : Promise.all([searchAttractions(cityKey), searchCultureSpots(cityKey)])
          .then(([attractions, cultureSpots]) => [...attractions, ...cultureSpots])
          .catch(() => []),
    fetchGoogleHoursMany(kakaoRows),
  ])

  const tourImageById = new Map(tourPlaces.filter((place) => place.image).map((place) => [place.id, place.image]))
  const updates = missing
    .map((row) => ({
      id: row.id,
      imageUrl: tourImageById.get(row.id) || googlePhotoPath(googleByPlaceId.get(row.id)?.photoRef) || null,
    }))
    .filter((update) => update.imageUrl)

  if (updates.length > 0) await updatePlaceImages(updates)
  console.log(`[course-pool images] ${cityKey}: ${updates.length}/${missing.length}곳 사진 보강`)
}

// 같은 도시를 동시에 두 번 사진 보강하지 않도록.
const backfillingCities = new Set()
function backfillCityImagesInBackground(cityKey, rows) {
  if (backfillingCities.has(cityKey)) return
  backfillingCities.add(cityKey)
  backfillCityImages(cityKey, rows)
    .catch((error) => console.warn(`[course-pool images] ${cityKey}: ${error.message}`))
    .finally(() => backfillingCities.delete(cityKey))
}

// 같은 도시를 동시에 두 번 백그라운드 갱신하지 않도록.
const refreshingCities = new Set()
function refreshCityPoolInBackground(cityKey) {
  if (refreshingCities.has(cityKey)) return
  refreshingCities.add(cityKey)
  buildCityPoolRows(cityKey)
    .catch((error) => console.warn(`[course-pool refresh] ${cityKey}: ${error.message}`))
    .finally(() => refreshingCities.delete(cityKey))
}

function cityPoolResponse(cityKey, rows) {
  return {
    title: `${cityKey} 코스`,
    subtitle: `${cityKey}의 장소를 모아 만든 하루`,
    center: cityCenter(rows.map((row) => ({ lat: row.lat, lng: row.lng }))),
    pool: rows.map(toPoolPlace),
  }
}

// 캐시가 있으면 오래됐어도 즉시 응답하고, 오래됐으면 백그라운드로만 갱신한다.
// 캐시가 전혀 없을 때(그 도시 첫 조회)만 외부 API 를 기다린다.
router.get('/api/course-pool', async (req, res) => {
  const cityKey = String(req.query.city || '').trim()
  if (!cityKey) return res.status(400).json({ message: 'city 파라미터가 필요해요.' })

  try {
    const { rows: cached, stale } = await findCityPool(cityKey)
    if (cached && cached.length > 0) {
      res.json(cityPoolResponse(cityKey, cached))
      if (stale) refreshCityPoolInBackground(cityKey)
      // 사진이 비어 있는 캐시 행(사진 기능 이전에 저장된 것)은 응답과 별개로 조용히 채워 둔다.
      else if (cached.some((row) => !row.imageUrl)) backfillCityImagesInBackground(cityKey, cached)
      return
    }

    const rows = await buildCityPoolRows(cityKey)
    return res.json(cityPoolResponse(cityKey, rows))
  } catch (error) {
    console.error('[course-pool]', error)
    return res.status(502).json({ message: error.message || '여행지 정보를 가져오지 못했어요.' })
  }
})
