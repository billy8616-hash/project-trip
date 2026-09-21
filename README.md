# 발길따라 — 국내 여행 코스 자동 생성 웹 앱

> **본 프로젝트는 [`react project2/`](react%20project2/) 폴더에 있습니다.**
> 소개 · 실행 방법 · 아키텍처는 **[react project2/README.md](react%20project2/README.md)** 를 봐 주세요.

조건(여행지 · 테마 · 예산 · 교통편 · 날짜)만 고르면, 실제 장소 데이터와 날씨 · 영업시간 ·
이동거리를 반영해 오전 · 점심 · 오후 · 저녁 네 개 시간대의 여행 코스를 만들고
지도에 동선을 그려 주는 웹 앱입니다.

`React 19` · `Vite` · `Express 5` · `Prisma` · `Supabase` · `Gemini`

## 바로 가기

| 문서 | 내용 |
|---|---|
| [README](react%20project2/README.md) | 기능 · 기술적으로 공들인 지점 · 아키텍처 · 실행 방법 |
| [ROADMAP](react%20project2/ROADMAP.md) | 다음 마일스톤("함께 짜는 코스") 설계와 방식 선택 근거 |
| [IMPROVEMENT_PLAN](react%20project2/IMPROVEMENT_PLAN.md) | 기술 부채 자체 진단과 우선순위 |

## 빠른 실행

```bash
cd "react project2"
npm install
cp .env.example .env   # API 키를 채운다 (발급 경로는 파일 주석 참고)
npm run db:push
npm run dev            # http://localhost:5173
```
