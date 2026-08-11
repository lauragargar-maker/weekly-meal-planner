/// <reference types="vitest" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
)

// The feedback sheet promises to send "la versión de la app". The package
// version has been 1.0.0 since day one and cannot tell two deploys apart, so
// the build stamps the commit Vercel is building on top of it.
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(`${version}+${commit}`),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})








