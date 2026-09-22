// ─────────────────────────────────────────────────────────────
// server/db.js — Prisma 클라이언트 (앱 전체에서 하나만)
//
// DB 연결 풀을 들고 있는 객체라 파일마다 새로 만들면 연결이 금세 바닥난다.
// 그래서 여기서 한 번만 만들어 모든 서버 모듈이 이걸 가져다 쓴다.
// 테이블 구조는 prisma/schema.prisma 에 정의돼 있다.
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
