-- Supabase 는 public 스키마의 테이블을 REST API 로 자동 공개한다.
-- Prisma 가 만든 테이블은 RLS 가 꺼진 채 생성되므로, 그대로 두면 브라우저에 노출되는
-- publishable(anon) 키만으로 누구나 백엔드를 거치지 않고 테이블을 직접 읽고 쓸 수 있다.
--
-- 아래처럼 RLS 만 켜고 정책(policy)을 하나도 만들지 않으면 외부 직접 접근이 전면 차단된다.
-- 서버는 Prisma 가 Postgres 에 소유자(postgres)로 직접 붙어 RLS 를 우회하므로 영향이 없다.
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
-- `prisma db push` 로 테이블을 새로 만들 때마다 다시 한 번 실행하면 된다.

alter table "Profile"      enable row level security;
alter table "SavedCourse"  enable row level security;
alter table "PlaceCache"   enable row level security;
alter table "CoursePost"   enable row level security;
alter table "CourseReview" enable row level security;
alter table "CourseLike"   enable row level security;
