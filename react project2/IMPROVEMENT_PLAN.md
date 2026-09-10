# 발길따라(balgil-ttara) 개선 계획 (재진단)

기존 계획 문서 작성 이후 실제로 많이 진행되어 있어서, 지금 코드 기준으로 다시 훑어보고 새로 정리했습니다. 이미 끝난 항목과 아직 남은 항목을 나눴습니다.

## 이미 해결된 것들 (이전 계획 대비)

- **App.jsx 구조 분리 완료**: `data/`, `lib/`, `hooks/`, `screens/`, `components/`로 이미 잘 쪼개져 있음 (App.jsx는 532줄로 정리됨)
- **Prisma 실제 연결됨**: `prisma/schema.prisma`(User, PlaceCache) 존재, `authStore.js`가 실제로 Prisma Client 사용 중. JSON 파일 저장소는 더 이상 안 씀
- **JWT_SECRET 안전장치 완비**: 프로덕션에서 시크릿 없음/예시값/짧은 값이면 서버 부팅 자체를 막음 (`resolveJwtSecret`, `assertJwtSecret`)
- **로그인/가입 rate limiting 구현됨**: 계정별(`loginAccountLimiter`) + IP별(`loginIpLimiter`, `signupIpLimiter`) 이중 방어
- **비밀번호 해싱**: pbkdf2 12만 회 + `timingSafeEqual`로 타이밍 공격 방어
- **서버사이드 재검증**: `validateSignup`, `validateCredentials`로 클라이언트 검증 우회 대비
- **외부 API 키 전부 서버 전용**: Kakao REST, ODsay, TourAPI, Gemini, OpenWeather, Naver 키 모두 서버에서만 쓰고 클라이언트에 노출 안 됨
- **인증 쿠키 기반**: httpOnly + sameSite + (프로덕션에서) secure. localStorage에 토큰 저장 안 해서 XSS 노출면이 작음
- **`.gitignore`가 `.env`, `dev.db`, `users.json` 제대로 제외**

이 부분들은 잘 짜여 있어서 손 댈 필요 없습니다.

## 지금 진짜 남은 문제 (우선순위별)

### 0순위 — 바로 정리 가능 (30분 이내)

1. **죽은 코드**: `authStore.js`의 `readUsers`/`writeUsers`가 실제로 어디서도 호출되지 않습니다 (`migrateUsersToDb.js`는 자체 `upsert` 로직을 씀). 특히 `writeUsers`는 `deleteMany` 후 `createMany`라서, 실수로든 나중에든 호출되면 유저 테이블 전체가 날아가는 위험한 코드입니다. 안 쓰면 지우세요.
2. **미사용 이미지 자산**: `src/assets/`의 `scrapbook-left-collage.png`(3.1MB), `scrapbook-right-collage.png`(3.0MB), `camera-sticker.png`(313KB) — 코드 어디서도 import되지 않습니다. 합쳐서 6.4MB가 그냥 저장소에 들어있습니다. 나중에 쓸 계획이 없으면 삭제하세요.
3. **`img.file/` 폴더**: 프로젝트 루트에 `카메라.jpg`, `travel inter.jpg`가 든 폴더가 있는데, 코드에서 참조되지 않는 참고용 이미지로 보입니다. 소스 트리에 있을 이유가 없으니 지우거나 최소 `.gitignore`에 추가하세요.

### 1순위 — 이미지 용량 (여전히 큼)

`src/assets/` 전체가 15.9MB이고, 실제로 쓰이는 3장(지도, 배낭, 폴라로이드)만 해도 9.5MB입니다. 홈 화면 배경 장식치고 매우 무겁습니다.

- PNG → WebP 변환 (품질 유지하며 보통 70~80% 용량 절감)
- 실제 렌더링 폭(최대 640px)에 맞춰 리사이즈 — 지금은 원본 고해상도를 CSS로 줄여서 보여주고 있을 가능성이 높음
- 위 미사용 자산 정리(0순위 2번)까지 합치면 15.9MB → 2~3MB대로 줄일 수 있을 것으로 예상

### 2순위 — CSS 정리 (해결 안 됨, 오히려 더 커짐)

이전 계획 작성 시점엔 `index.css`가 2,507줄이었는데, 지금은 **4,588줄**로 거의 두 배가 됐습니다. JS는 화면/컴포넌트 단위로 잘 쪼갰는데 CSS만 한 파일에 계속 쌓이는 중이라 갈수록 더 벌어질 구조입니다.

- 권장: 각 `screens/*.jsx`, `components/*.jsx` 옆에 동명의 `.css`를 두고 CSS Modules로 전환
- 당장 전면 전환이 부담되면 최소 `layout.css` / `screens.css` / `components.css`로 섹션만이라도 분리

### 3순위 — 테스트 0개 (해결 안 됨)

Vitest 등 테스트 프레임워크가 아예 없습니다. 순수 함수부터 우선순위로 추가하는 걸 추천합니다:

- 프런트: `lib/course.js`, `lib/datetime.js`, `lib/geo.js`, `lib/travelTime.js`
- 서버: `validateSignup`, `validateCredentials`, `createRateLimiter` (rateLimit.js 자체가 순수 로직이라 테스트하기 좋음)

### 4순위 — 스케일 시 고려할 것 (지금 당장은 급하지 않음)

- **rate limiter가 메모리 기반**: `rateLimit.js` 주석에도 명시되어 있듯, 서버 재시작하면 초기화되고 인스턴스를 여러 대로 늘리면 인스턴스마다 따로 셉니다. 지금 규모(단일 서버)에선 문제없지만, 서버를 여러 대로 늘릴 계획이 생기면 Redis 등 공유 저장소로 옮겨야 합니다.

### 5순위 — 세부 재확인 필요 (코드만으로 확인 불가)

- Kakao Map JS 키에 HTTP 리퍼러 제한이 걸려 있는지 Kakao Developers 콘솔에서 재확인 (클라이언트에 노출되는 키라 필수)
- `KakaoRouteMap`(이전 `GoogleRouteMap`에서 이름 변경된 듯) 쪽 에러 처리가 `console.warn`에 머무는 곳이 있는지 재점검 — 있다면 사용자에게 보이는 메시지로 승격
- `ScheduleTimeline`의 드래그 앤 드롭에 키보드 전용 사용자를 위한 대체 조작(버튼으로 순서 이동 등)이 있는지 재확인

---

## 실행 순서 제안

1. **(30분)** 0순위 — 죽은 코드(`readUsers`/`writeUsers`)와 미사용 이미지 3장, `img.file/` 폴더 정리
2. **(1~2시간)** 1순위 — 이미지 WebP 변환 + 리사이즈
3. **(반나절~1일)** 2순위 — CSS를 화면/컴포넌트 단위로 분리
4. **(여유 될 때)** 3순위 — 순수 함수 유닛 테스트 추가
5. **(스케일 아웃 시점에)** 4순위 — rate limiter를 Redis 등으로 교체
6. **(수시로)** 5순위 — 콘솔에서 직접 확인해야 하는 항목들 점검

원하시면 0순위(죽은 코드/자산 정리)부터 바로 같이 진행해드릴게요 — 가장 빠르고 리스크도 없습니다.
