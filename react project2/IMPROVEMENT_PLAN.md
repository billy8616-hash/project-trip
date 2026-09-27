# 발길따라(balgil-ttara) 개선 계획 (재진단 — 2026-09-27)

기존 계획 문서가 지금 코드 상태와 크게 어긋나 있었습니다(예: 이미 삭제된 `authStore.js`/자체 JWT 인증을 여전히 "구현됨"으로 적어 둠). 코드 기준으로 처음부터 다시 훑어서 새로 정리했습니다.

## 이미 해결된 것들

**이번 정리 세션에서 새로 끝난 것**
- **`index.css` 분리**: 9,596줄 → 32줄(순서대로 @import만 함). 실제 내용은 `src/styles/` 아래 화면별 14개 파일로 나눔.
- **죽은 CSS 제거**: 위 분리 과정에서 발견 — `.schedule`/`.sch-*`(옛 타임라인), 카메라·캐리어·폴라로이드 등 홈 화면 옛 손그림 소품 일러스트, 옛 필수방문 화면 스타일 등 2,000줄 이상이 실제로 어떤 JSX에서도 안 쓰이는 죽은 CSS였음. `07-course-timeline.css`(2,641줄)는 실제로 살아있던 부분만 남겨 `07-shared-overrides.css`(390줄)로 교체.
- **죽은 JS 컴포넌트 제거**: `ScheduleTimeline.jsx`·`SlotAdder.jsx`·`PlaceDetailModal.jsx`·`MapMarks.jsx`·`lib/ids.js`·`hooks/useNearbyParking.js` — 전부 App.jsx에 import만 되고 실제 렌더링은 안 되던 옛 코스 편집 시스템(지금은 `CourseDetail.jsx`로 교체됨). 딸려 있던 서버 라우트(`/api/parking`)와 함수도 함께 제거.
- **`App.jsx` 구조 분리**: 1,124줄 → 964줄. 코스 생성 파이프라인을 `hooks/useCourseBuilder.js`로 분리(장소 풀 조회 → buildCourse → 화면용 데이터 변환).
- **`server/app.js` 라우트 분리**: 929줄 → 71줄. 인증 미들웨어는 `server/authMiddleware.js`로, 라우트는 `server/routes/`에 도메인별(profile·trips·community·directions·coursePool·misc)로 분리.
- **화면 내부 컴포넌트 분리**: `CourseDetail.jsx`(886→94줄), `CommunityScreen.jsx`(852→206줄)를 각각 `screens/course-detail/`, `screens/community/`에 컴포넌트별 파일로 나눔.

**예전부터 이미 해결돼 있던 것 (이번에 확인만 함)**
- **인증은 Supabase Auth**: 이전 계획 문서가 언급하던 자체 JWT/pbkdf2/rate-limit 구현(`authStore.js`, `rateLimit.js`)은 존재하지 않음 — 현재는 Supabase 액세스 토큰을 서버가 검증하는 방식(`server/authMiddleware.js`)으로 완전히 교체돼 있음.
- **외부 API 키 전부 서버 전용**: Kakao REST, ODsay, TourAPI, Gemini, OpenWeather, Naver 키 모두 서버에서만 쓰고 클라이언트에 노출 안 됨 (브라우저에 나가는 키는 카카오맵 JS 키·Supabase anon 키뿐 — 둘 다 공개 전제 키).
- **미사용 디자인 원본 이미지**: `src/assets/_original/`, `home-original.png` 등은 이미 `.gitignore`에 등록돼 있어 레포에는 안 들어감 (로컬 디스크에만 있음, 아래 참고).
- **`img.file/` 폴더**: 이미 삭제됨.

이 부분들은 잘 짜여 있어서 손 댈 필요 없습니다.

## 지금 진짜 남은 문제 (우선순위별)

### 1순위 — 테스트 0개

Vitest 등 테스트 프레임워크가 아예 없습니다. 순수 함수부터 우선순위로 추가하는 걸 추천합니다:

- 프런트: `lib/course.js`, `lib/datetime.js`, `lib/geo.js`, `lib/travelTime.js`, `lib/schedule.js`
- 서버: `server/communityStore.js`의 별점 계산 로직처럼 순수 함수로 분리 가능한 부분

### 2순위 — 로컬 디스크의 디자인 원본 용량

`src/assets/` 로컬 디스크 전체가 35MB인데, 이 중 `_original/`(20MB, PNG 원본)과 `home-original.png`/`home-approved-preview.png`/`home-typo-fixed.png`(약 13MB, 디자인 검수용 스크린샷)는 `.gitignore`로 레포에는 안 들어가지만 로컬엔 계속 쌓여 있습니다. 실제로 다시 열어볼 계획이 없으면 로컬에서 지워도 무방합니다 — 레포 용량과는 무관하고, 순전히 개인 디스크 정리 문제입니다.

### 3순위 — 세부 재확인 필요 (코드만으로 확인 불가하거나 깊은 점검이 필요)

- Kakao Map JS 키에 HTTP 리퍼러 제한이 걸려 있는지 Kakao Developers 콘솔에서 재확인 (클라이언트에 노출되는 키라 필수)
- `KakaoRouteMap.jsx`에 `console.warn`/`console.error`로만 처리되고 사용자에게는 안 보이는 에러 경로가 3곳 있음 — 실제로 사용자 경험에 영향 주는 실패인지 확인 후, 필요하면 화면에 보이는 안내로 승격
- (구 계획의 "ScheduleTimeline 키보드 접근성" 항목은 더 이상 해당 없음 — `ScheduleTimeline`은 삭제됐고, 지금 `CourseDetail.jsx`는 처음부터 위/아래 버튼으로 순서를 바꾸는 방식이라 키보드로도 조작 가능합니다.)

### 4순위 — 스케일 시 고려할 것 (지금 당장은 급하지 않음)

- 지금은 단일 서버·단일 인스턴스 규모라 문제없지만, 서버를 여러 대로 늘릴 계획이 생기면 세션/캐시 관련 부분(예: `server/placeCache.js`의 메모리 상태)이 공유 저장소를 필요로 할 수 있습니다. 지금 당장 손볼 필요는 없습니다.

---

## 실행 순서 제안

1. **(여유 될 때)** 1순위 — 순수 함수 유닛 테스트 추가
2. **(5분, 하고 싶으면)** 2순위 — 로컬 디스크에서 안 쓰는 디자인 원본 정리 (레포엔 영향 없음)
3. **(수시로)** 3순위 — 콘솔에서 직접 확인해야 하는 항목들 점검
4. **(스케일 아웃 시점에)** 4순위

원하시면 1순위(테스트 추가)부터 같이 시작해드릴게요.
