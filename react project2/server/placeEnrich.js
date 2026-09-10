import { GoogleGenAI, Type } from '@google/genai'

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

// 캐시에 없는 신규 장소들을 한 번에 모아 배치로 추천이유/주의사항/테마/예산대를 생성한다.
// places: [{ id, name, category }]
export async function enrichPlaces(places) {
  if (places.length === 0) return new Map()

  const listText = places
    .map((place) => `- id: ${place.id}, 이름: ${place.name}, 카테고리: ${place.category || '정보 없음'}`)
    .join('\n')

  const response = await generateWithRetry({
    model: 'gemini-2.0-flash',
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
