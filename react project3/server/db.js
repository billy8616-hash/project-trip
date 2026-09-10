/* =========================================================================
   db.js — SQLite 데이터베이스 (회원 + 세션)
   -------------------------------------------------------------------------
   - Node 24 내장 모듈 node:sqlite 를 사용한다. 네이티브 빌드가 필요 없다.
   - better-sqlite3 로 바꾸고 싶으면:
       import Database from 'better-sqlite3'
       export const db = new Database(join(__dirname, 'app.db'))
     로만 교체하면 나머지 코드(prepare/run/get/all)는 거의 그대로 동작한다.
   - 데이터는 server/app.db 파일 하나에 저장된다. (.gitignore 처리됨)
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const db = new DatabaseSync(join(__dirname, 'app.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    nickname      TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`)
