// ─────────────────────────────────────────────────────────────
// eslint.config.js — 린트 설정 (ESLint 9+ 의 flat config 형식)
//
// 이 프로젝트는 브라우저 코드와 Node 코드가 한 저장소에 같이 있다.
// 전역 객체가 서로 달라서(window vs process) 설정을 두 블록으로 나눴다 —
// 그래야 서버 코드에서 window 를 쓰면 에러가 나고, 그 반대도 잡힌다.
//
//   npm run lint       검사 (현재 경고 0)
//   npm run lint:fix   자동 수정 가능한 것만 고치기
// ─────────────────────────────────────────────────────────────

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src/assets/**'] },

  // 브라우저에서 도는 프런트엔드 코드
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // JSX 안에서만 쓰이는 컴포넌트를 "안 쓰는 변수"로 오인하지 않도록,
      // 대문자로 시작하는 식별자는 사용된 것으로 본다.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },

  // Node 에서 도는 서버 코드
  {
    files: ['server/**/*.js', 'vite.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
]
