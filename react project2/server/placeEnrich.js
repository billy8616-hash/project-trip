import { GoogleGenAI, Type } from '@google/genai'
import { mapLimit } from './concurrency.js'

const THEME_VALUES = ['step', 'mood', 'sns', 'view', 'food']
const BUDGET_VALUES = ['저예산', '보통', '프리미엄']

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    places: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          reason: { type: Type.STRING, description: '이 장소를 추천하는 이유, 한국어 1문장' },
          caution: { type: Type.STRING, description: '방문 시 주의사항, 한국어 1문장' },
          themes: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: THEME_VALUES },
          },
          budgetTiers: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: BUDGET_VALUES },
          },
        },
        required: ['id', 'reason', 'caution', 'themes', 'budgetTiers'],
      },
    },
  },
  required: ['places'],
}

let client
function getClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY가 설정되지 않았어요.')
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return client
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function isRetryableError(error) {
  return error?.status === 429 || error?.status >= 500 || /rate limit|overloaded|resource_exhausted|fetch failed/i.test(error?.message || '')
}

async function generateWithRetry(params, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await getClient().models.generateContent(params)
    } catch (error) {
      if (!isRetryableError(error) || attempt === maxAttempts) throw error
      await sleep(attempt * 2000)
    }
  }
  throw new Error('Gemini 요청을 완료하지 못했어요.')
}

// 한 번에 보내는 장소 수. 장소당 2문장을 받아오므로 너무 크면 응답이 길어져
// 모델이 503(high demand)으로 거절하거나 출력이 잘린다. 70곳은 실패, 40곳은 안정적으로 성공했다.
const BATCH_SIZE = 40
const BATCH_CONCURRENCY = 2 // 동시 요청 수. 무료 티어의 분당 호출 제한을 피하려고 낮게 둔다.

function chunk(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

// 신규 장소들의 추천이유/주의사항/테마/예산대를 생성한다. places: [{ id, name, category }]
// BATCH_SIZE 단위로 나눠 병렬 호출하고, 일부 배치가 실패해도 성공한 배치 결과는 그대로 살린다.
export async function enrichPlaces(places) {
  if (places.length === 0) return new Map()

  const batches = chunk(places, BATCH_SIZE)
  if (batches.length === 1) return enrichBatch(batches[0])

  const results = await mapLimit(batches, BATCH_CONCURRENCY, (batch, index) =>
    enrichBatch(batch).catch((error) => {
      console.warn(`[enrich] 배치 ${index + 1}/${batches.length} 실패 — 건너뜁니다: ${String(error?.message).slice(0, 120)}`)
      return new Map()
    }),
  )

  const merged = new Map()
  for (const result of results) {
    for (const [id, value] of result) merged.set(id, value)
  }
  if (merged.size < places.length) {
    console.warn(`[enrich] ${places.length}곳 중 ${merged.size}곳만 보강됨 (나머지는 폴백 문구 사용)`)
  }
  return merged
}

async function enrichBatch(places) {
  const listText = places
    .map((place) => `- id: ${place.id}, 이름: ${place.name}, 카테고리: ${place.category || '정보 없음'}`)
    .join('\n')

  const response = await generateWithRetry({
    model: 'gemini-3.6-flash',
    contents: [
      '아래 국내 여행 장소 목록 각각에 대해 여행 코스 추천 앱에 쓸 텍스트를 만들어줘.',
      '- reason: 이 장소를 추천하는 이유 1문장 (해요체, 과장 없이 담백하게)',
      '- caution: 방문 시 참고할 주의사항 1문장 (예: 혼잡 시간대, 휴무일 유의 등 일반적인 조언, 확인 안 된 구체적 사실 단정 금지)',
      `- themes: [${THEME_VALUES.join(', ')}] 중 이 장소와 어울리는 것 1~3개`,
      `- budgetTiers: [${BUDGET_VALUES.join(', ')}] 중 이 장소 방문에 맞는 예산대 1개 이상`,
      '',
      listText,
    ].join('\n'),
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  })

  const parsed = JSON.parse(response.text || 'null')
  if (!parsed) throw new Error('Gemini 응답을 구조화된 형식으로 파싱하지 못했어요.')

  return new Map(parsed.places.map((place) => [place.id, place]))
}
