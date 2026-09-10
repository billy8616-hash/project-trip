/* 개발용: 백엔드와 프런트엔드(Vite)를 한 프로세스에서 함께 띄운다.
     node dev.js   (npm start / npm run dev 와 동일)

   - ./server/server.js 를 import 하면 그 안의 app.listen 이 실행되어
     백엔드가 http://localhost:8787 에서 뜬다.
   - 이어서 Vite 개발 서버를 프로그램적으로 실행한다.
   - Ctrl+C 한 번으로 둘 다 종료된다. */

import './server/server.js'
import { createServer } from 'vite'

const vite = await createServer()
await vite.listen()
vite.printUrls()
