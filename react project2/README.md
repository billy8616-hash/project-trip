# 발길따라

> 조건만 고르면 국내 여행 하루 코스가 시간표까지 완성되는 웹 앱.
> 여행지·테마·예산·교통편·날짜를 고르면, 실제 장소 데이터와 날씨·영업시간·이동거리를
> 반영해 오전·점심·오후·저녁 네 개 시간대의 코스를 만들고 지도에 동선을 그려 준다.

`React 19` · `Vite` · `Express 5` · `Prisma` · `Supabase(Postgres + Auth)` · `Gemini` · 외부 API 10종

---

## 목차

- [무엇을 해결하는가](#무엇을-해결하는가)
- [화면](#화면)
- [핵심 기능](#핵심-기능)
- [기술적으로 공들인 지점](#기술적으로-공들인-지점)
- [아키텍처](#아키텍처)
- [기술 스택](#기술-스택)
- [외부 API](#외부-api)
- [실행 방법](#실행-방법)
- [프로젝트 구조](#프로젝트-구조)
- [설계 판단 기록](#설계-판단-기록)
- [알려진 한계와 다음 계획](#알려진-한계와-다음-계획)

---

## 무엇을 해결하는가

국내 여행 계획의 실제 병목은 "어디 갈까"가 아니라 **"고른 곳들을 하루에 어떻게 넣을까"** 다.
블로그에서 장소 열 곳을 모아도, 그중 몇 곳이 그날 휴무인지, 동선이 왔다 갔다 하지 않는지,
비 오는 날 야외 코스만 남지 않았는지는 직접 확인해야 한다.

발길따라는 그 조립 단계를 대신한다. 사용자는 **조건만 고르고**, 앱이

1. 그 도시의 실제 장소를 모아 (관광지·문화시설·맛집·카페)
2. 조건과 맥락으로 점수를 매겨 시간대별로 한 곳씩 뽑고
3. 총 이동거리가 짧아지도록 순서를 다시 짜고
4. 체류시간과 이동시간을 누적해 **도착 시각이 붙은 시간표**로 만든다.

## 화면

<!-- TODO: 실행 화면 캡처 4장을 docs/screenshots/ 에 넣고 아래 주석을 해제하세요.
     추천 구성: (1) 홈 (2) 여행지 선택 (3) 코스 타임라인 + 지도 (4) 커뮤니티

| 홈 | 여행지 선택 |
|---|---|
| ![홈](docs/screenshots/home.png) | ![여행지](docs/screenshots/destinations.png) |

| 코스 타임라인 | 커뮤니티 |
|---|---|
| ![코스](docs/screenshots/course.png) | ![커뮤니티](docs/screenshots/community.png) |
-->

## 핵심 기능

**코스 생성**
- 여행지 40곳(대표 10곳 + 지역별 30곳), 테마 5종, 예산 3단계, 교통편 3종 조합
- 당일 ~ 3박 4일까지 일수별 코스. 날짜가 달라도 같은 장소를 두 번 넣지 않는다
- "꼭 가고 싶은 곳"을 직접 입력하면 가중치를 크게 줘서 코스에 반드시 포함시킨다
- 출발지·숙소를 지정하면 그 지점을 동선의 시작·끝으로 고정한다

**맥락 반영**
- **영업시간·휴무일**: 여행 날짜에 정기 휴무인 장소는 후보에서 제외. 도착 시각이 마감 이후면 배치하지 않는다
- **날씨**: 비·눈 예보인 날은 야외 노출이 큰 장소를 감점하고 실내 위주를 가점한다
- **교통편**: 자차면 주차 가능 여부, 도보·대중교통이면 최근접 지하철역 등급으로 가감점
- **예산**: 입장료·가격대를 등급화해 선택한 예산대에 맞춰 보정

**편집과 지도**
- 타임라인에서 장소를 드래그해 순서 변경, 슬롯별 장소 교체·추가·삭제
- 직접 순서를 바꾼 날은 자동 최적화에서 제외해 편집 결과를 보호한다
- 교통 모드별 실제 경로: 자차(카카오모빌리티), 대중교통(ODsay), 도보(Tmap)
- 장소 상세 모달, 주변 주차장 조회, 카카오맵·네이버지도 연결

**계정과 공유**
- Supabase Auth 기반 이메일 가입 + 카카오·구글 소셜 로그인
- "내 여행"에 코스 저장 → 다시 열어보기 / 다시 계획하기
- 커뮤니티에 코스 공유, 후기 작성, 좋아요

## 기술적으로 공들인 지점

포트폴리오로서 봐 주셨으면 하는 부분을 따로 모았다.

### 1. 동선 최적화 — 외부 API 없이 브라우저에서

[`src/lib/geo.js`](src/lib/geo.js)

하루 4~8곳의 방문 순서를 **최근접 이웃으로 초기 경로를 만든 뒤 2-opt로 개선**한다.
출발지·숙소 앵커가 있으면 그 두 점을 고정하고 사이 순서만 뒤집는다.

haversine 직선거리 기준이라 도로 실측은 아니지만, 이 규모에서 "왔다 갔다"를 없애기에는 충분하고
**외부 길찾기 API 호출이 0회**라는 이점이 있다. 이렇게 정한 순서를 자차 모드에서만
카카오모빌리티에 넘겨 실제 도로로 다시 그린다 — 최적화는 무료로, 실측은 필요할 때만.

### 2. 외부 API 비용을 캐시 설계로 흡수

[`server/placeCache.js`](server/placeCache.js) · [`server/app.js`](server/app.js)

도시 하나의 장소 풀을 만들려면 TourAPI(관광지·문화시설) + 카카오 로컬(맛집·카페) +
Google Places(영업시간·사진) + Gemini(추천 이유·주의사항)를 모두 거쳐야 한다. 매 요청마다 하면
느리고 비싸다. 그래서 `PlaceCache` 테이블에 결과를 모아 두고 **stale-while-revalidate**로 응답한다.

- 캐시가 있으면 **오래됐어도 즉시 응답**하고, 갱신은 백그라운드로 돌린다
- 캐시가 전혀 없는 첫 조회만 외부 API를 기다린다
- 사진이 비어 있는 과거 행은 응답과 별개로 조용히 채운다

결과적으로 같은 도시 두 번째 조회부터는 외부 호출이 0회다.

### 3. LLM 응답을 신뢰할 수 있게 받는 방법

[`server/placeEnrich.js`](server/placeEnrich.js)

Gemini에 장소 목록을 주고 추천 이유·주의사항·테마 태그를 받는다. 자유 텍스트로 받으면
파싱이 깨지므로 **`responseSchema`로 구조를 강제**하고, 테마·예산 값은 `enum`으로 고정해
모델이 임의 라벨을 만들어내지 못하게 했다.

배치 크기도 실측으로 정했다 — 한 번에 70곳을 보내면 응답이 잘리거나 503을 맞고,
40곳은 안정적으로 성공한다. 429·5xx는 지수 백오프로 3회까지 재시도한다.

### 4. 외부 API가 하나 죽어도 앱이 죽지 않게

[`server/concurrency.js`](server/concurrency.js)

- `mapLimit`으로 동시 호출 수를 제한한다 — 수십 개를 한꺼번에 던져 일부가 멈추면 전체가 지연된다
- 모든 외부 fetch에 `AbortSignal.timeout`을 건다
- 선택적 API(Tmap·Google Places·네이버 트렌드)는 키가 없으면 **그 기능만 빠지고 나머지는 동작**한다.
  도보 경로는 직선 동선으로, 맛집은 영업시간·사진 없이 표시된다

### 5. 키를 브라우저에 내보내지 않기

외부 API 키 중 **브라우저에 노출되는 것은 카카오맵 JavaScript 키와 Supabase anon 키뿐**이다
(둘 다 공개 전제로 설계된 키). 나머지는 전부 서버에서만 쓰고 프록시 엔드포인트로 중계한다.

Google Places 사진도 키가 필요해서, 키를 내보내는 대신 `/api/place-photo`가 실제 이미지 주소를
받아 302로 리다이렉트한다. 이때 서버가 임의 URL로 요청을 날리는 SSRF를 막기 위해
**Google 사진 리소스 이름 형태만 통과시킨다**.

## 아키텍처

```
┌─────────────────────────── 브라우저 ────────────────────────────┐
│  React 19 (Vite)                                                │
│    screens/  조건 선택 → 코스 → 내 여행 → 커뮤니티              │
│    lib/course.js   조건·맥락 기반 장소 스코어링 + 슬롯 배치      │
│    lib/geo.js      동선 최적화 (최근접이웃 + 2-opt)             │
│    lib/schedule.js 체류·이동시간 누적 → 도착 시각 계산           │
│    카카오맵 JS SDK  지도 렌더링 · 경로 폴리라인                  │
└────────────┬─────────────────────────────┬──────────────────────┘
             │ /api/*                      │ Supabase JS
             │ (Bearer 액세스 토큰)         │ (로그인 · 세션)
┌────────────▼─────────────────────────┐   │
│  Express 5  (server/app.js)          │   │
│    requireAuth → Supabase 토큰 검증   │   │
│    외부 API 프록시 + 캐시 계층        │   │
└──┬───────────────────────────────┬───┘   │
   │ Prisma                        │ fetch │
┌──▼───────────────────────┐  ┌────▼───────▼──────────────────────┐
│ Supabase Postgres        │  │ TourAPI · 카카오 로컬/모빌리티    │
│  Profile                 │  │ Google Places · Gemini            │
│  SavedCourse             │  │ ODsay · Tmap · OpenWeather · 네이버│
│  PlaceCache  ← 캐시       │  └───────────────────────────────────┘
│  CoursePost/Review/Like  │
└──────────────────────────┘
```

**개발 중에는 프로세스가 하나다.** [`vite.config.js`](vite.config.js)가 Express 앱을 Vite 개발 서버의
미들웨어로 직접 마운트해서, `npm run dev` 한 번이면 프런트와 API가 같은 포트(5173)에서 함께 뜬다.
`configureServer`는 `vite dev`에서만 실행되므로 **프로덕션 빌드에는 서버 코드가 섞이지 않는다.**
백엔드를 따로 띄우고 싶으면 `npm run server`(4000 포트)를 쓴다.

## 기술 스택

| 영역 | 사용 기술 | 선택 이유 |
|---|---|---|
| 프런트엔드 | React 19, Vite 8 | 상태 관리 라이브러리 없이 훅으로 해결 — 화면 수가 적고 전역 상태가 여행 조건 하나로 수렴해서 |
| 스타일 | 커스텀 CSS + Tailwind 3 (부분 도입) | 아래 설명 참고 |
| 백엔드 | Express 5 | async 라우트 에러가 자동 전달돼 프록시 엔드포인트 코드가 단순해진다 |
| DB | Supabase Postgres + Prisma 6 | 스키마를 코드로 관리하고, Auth·DB를 한 곳에서 |
| 인증 | Supabase Auth | 이메일 + 카카오·구글 OAuth를 직접 구현하지 않고 확보 |
| LLM | Gemini (`@google/genai`) | 구조화 출력(`responseSchema`) 지원 + 무료 티어 |
| 린트 | ESLint 10 (flat config) | 현재 경고 0 |

**Tailwind를 전면 도입하지 않은 이유** — 기존 화면은 전부 손으로 쓴 `src/index.css`로 스타일링돼 있었고,
Tailwind는 나중에 만든 "코스 상세" 화면 하나에만 필요했다. 전역 도입은 기존 화면을 깨뜨리므로
[`tailwind.config.js`](tailwind.config.js)에서 **preflight(전역 리셋)를 끄고 모든 유틸에 `tw-` 접두사**를 붙여
클래스 이름 충돌을 원천 차단했다. 새 화면에 필요한 최소 리셋만 `.course-detail-root` 스코프에 따로 넣었다.

## 외부 API

아래 10종을 쓰지만 **전부 필수는 아니다.** 없으면 해당 기능만 빠진다.

| API | 역할 | 없으면 | 발급 |
|---|---|---|---|
| 카카오맵 JavaScript | 지도 렌더링, 경로 표시 | 지도 안 나옴 | [developers.kakao.com](https://developers.kakao.com) · 무료 |
| 카카오 로컬 (REST) | 맛집·카페 검색, 지오코딩 | 맛집·카페 없음 | 같은 앱의 REST API 키 · 무료 |
| 카카오모빌리티 (REST) | 자차 모드 실제 도로 경로 | 직선 동선으로 대체 | 위와 같은 키 · 무료 |
| TourAPI (한국관광공사) | 관광지·문화시설·야경, 영업시간, 주차 | 코스 후보 대부분 없음 | [data.go.kr](https://data.go.kr) · 무료 |
| Gemini | 추천 이유·주의사항·테마 태그 생성 | 설명 문구 없음 | [aistudio.google.com](https://aistudio.google.com/apikey) · 무료 |
| Supabase | 로그인, DB | 로그인·저장 불가 | [supabase.com](https://supabase.com) · 무료 티어 |
| OpenWeatherMap | 날씨 배지, 비 예보 반영 | 날씨 미반영 | [openweathermap.org](https://openweathermap.org) · 무료 |
| Google Places (New) | 맛집·카페 영업시간·사진 | 영업시간·사진 없음 | Google Cloud Console · 월 $200 무료 크레딧 |
| ODsay | 대중교통 경로·소요시간 | 직선 동선으로 대체 | [lab.odsay.com](https://lab.odsay.com) · 무료 |
| Tmap | 도보 경로 | 직선 동선으로 대체 | [developers.sktelecom.com](https://developers.sktelecom.com) · 무료 |
| 네이버 데이터랩 | "지금 뜨는 중" 배지 | 배지 없음 | [developers.naver.com](https://developers.naver.com) · 무료 |

> **최소 구성으로 돌려보려면** 카카오(JS + REST) · TourAPI · Supabase 네 개만 있으면 코스 생성과
> 지도까지 동작한다. 각 키의 발급 경로와 콘솔 설정은 [`.env.example`](.env.example)에 단계별로 적어 두었다.

## 실행 방법

**요구 사항** — Node.js 20 이상 (개발 환경 24.18.0), npm

```bash
# 1. 설치
npm install

# 2. 환경변수 — .env.example 을 복사해 키를 채운다
cp .env.example .env

# 3. DB 스키마를 Supabase 에 반영
npm run db:push

# 4. 개발 서버 (프런트 + API 가 함께 5173 포트에 뜬다)
npm run dev
```

http://localhost:5173 으로 접속한다. 포트는 5173으로 고정돼 있다 —
카카오 디벨로퍼스에 등록하는 도메인과 `CLIENT_ORIGIN`이 이 포트를 전제로 하므로,
이미 사용 중이면 다른 포트로 조용히 넘어가는 대신 에러를 낸다.

### 그 밖의 스크립트

| 명령 | 설명 |
|---|---|
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run server` | 백엔드만 따로 4000 포트에 띄운다 |
| `npm run lint` | ESLint (현재 경고 0) |
| `npm run db:studio` | Prisma Studio 로 DB 열기 |
| `npm run db:prewarm` | 주요 도시의 장소 캐시를 미리 채운다 |
| `npm run db:clear-places` | `PlaceCache` 비우기 |

### 소셜 로그인을 쓰려면

카카오·구글 OAuth는 코드는 이미 연결돼 있고 `.env`에 추가할 키가 없다. 대신 대시보드
두 곳(각 Provider 콘솔 + Supabase Authentication → Providers)을 한 번 설정해야 한다.
단계별 설명은 [`.env.example`](.env.example) 하단에 있다.

## 프로젝트 구조

```
react project2/
├─ src/
│  ├─ App.jsx              화면 전환 · 여행 조건 전역 상태 · 코스 편집
│  ├─ screens/             조건 선택(출발지·날짜·테마·예산·필수방문) · 코스 · 내 여행 · 커뮤니티
│  ├─ components/          지도 · 타임라인 · 장소 모달 · 홈 · 아이콘
│  ├─ hooks/               useAuth · useTripPlan · useCityPool · useTripForecast · useCityHighlights
│  ├─ lib/
│  │  ├─ course.js         조건·맥락 스코어링 + 슬롯 배치  ← 코스 생성의 핵심
│  │  ├─ geo.js            동선 최적화 (최근접이웃 + 2-opt)
│  │  ├─ schedule.js       체류·이동시간 누적 → 도착 시각
│  │  ├─ openingHours.js   휴무일·영업시간 판정
│  │  ├─ cost.js           예산 등급 보정
│  │  └─ api*.js           백엔드 · Supabase 통신
│  └─ data/                여행지 40곳 · 테마·예산·교통 옵션
├─ server/
│  ├─ app.js               Express 라우트 24개 + 인증 미들웨어
│  ├─ placeCache.js        stale-while-revalidate 캐시
│  ├─ placeEnrich.js       Gemini 구조화 출력
│  ├─ tourApi.js / kakaoLocal.js / googlePlaces.js / odsay.js / tmap.js / weather.js / naverTrend.js
│  └─ concurrency.js       동시 호출 제한 · fetch 타임아웃
├─ prisma/schema.prisma    Profile · SavedCourse · PlaceCache · CoursePost/Review/Like
├─ ROADMAP.md              다음 마일스톤(함께 짜는 코스) 설계와 판단 근거
└─ IMPROVEMENT_PLAN.md     기술 부채 진단과 우선순위
```

## 설계 판단 기록

기능을 넣은 이유만큼 **넣지 않은 이유**도 남겨 두었다.

- [`ROADMAP.md`](ROADMAP.md) — 다음 마일스톤인 "함께 짜는 여행 코스"에서 실시간 공동 편집(A안)을
  검토했지만 **제안 기반 편집(B안)을 택한 근거**. 현재 저장 단위가 코스 전체 JSON 한 덩이라
  실시간 공동 편집은 last-write-wins로 **데이터가 조용히 사라지는 버그**가 구조적으로 발생한다.
  그리고 자동 동선 최적화와 수동 편집 보호 규칙이 편집자가 여럿이면 무너진다 —
  "누구를 기준으로 최적화할 것인가"에 정답이 없다.
- [`IMPROVEMENT_PLAN.md`](IMPROVEMENT_PLAN.md) — 기술 부채를 스스로 진단하고 우선순위를 매긴 기록.

## 알려진 한계와 다음 계획

솔직하게 적는다.

| 한계 | 현재 상태 | 계획 |
|---|---|---|
| 코스 편집 결과가 서버에 없다 | 브라우저 로컬 스냅샷으로 새로고침만 견딘다. 기기를 바꾸면 사라진다 | 서버 저장으로 승격 (ROADMAP 0단계) |
| 공개 프록시 엔드포인트에 레이트 리밋이 없다 | 무인증 호출 가능 | IP당 상한 추가 |
| 테스트가 없다 | 순수 함수는 테스트 가능하게 분리해 두었다 | `course.js` · `geo.js` · `schedule.js` 유닛 테스트 |
| `index.css`가 한 파일에 쌓였다 | JS는 화면·컴포넌트 단위로 분리했지만 CSS는 미분리 | 화면별 분할 |
| 타임라인 순서 변경이 마우스 전용 | `draggable` 기반, 키보드 대체 조작 없음 | ↑↓ 버튼 추가 |
| 동선 최적화가 직선거리 기준 | 하루 4~8곳 규모에서는 충분 | 자차 모드는 이미 실측 경로로 보정 |

---

국내 여행 코스를 **조건에서 시간표까지** 자동으로 조립하는 것을 목표로 만들었다.
실행에 막히는 부분이 있으면 [`.env.example`](.env.example)의 주석을 먼저 확인해 주세요 —
각 키의 발급 경로와 없을 때 어떤 기능이 빠지는지를 적어 두었습니다.
