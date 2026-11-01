import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import tailwindConfig from '../tailwind.config.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..')
const realClient = path.join(repo, 'src/lib/supabase.ts')
const fakeClient = path.join(here, 'app/fakeSupabase.ts')

/** Every import of the Supabase client gets the in-memory one instead. */
function fakeSupabase(): Plugin {
  return {
    name: 'nam-promo-fake-supabase',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !/(^|\/)supabase$/.test(source)) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved?.id === realClient ? fakeClient : null
    },
  }
}

// Serves the promo: the demo app under /app and the video composer under /video.
// Run from the repo root: npx vite --config promo/vite.config.ts
export default defineConfig({
  root: here,
  publicDir: path.join(repo, 'public'),
  plugins: [fakeSupabase(), react()],
  define: { __APP_VERSION__: JSON.stringify('promo') },
  // The demo never talks to Amplitude: main.tsx does not initialise it, and the key is dropped too.
  envDir: here,
  css: {
    postcss: {
      plugins: [
        tailwindcss({ ...tailwindConfig, content: [path.join(repo, 'src/**/*.{ts,tsx}'), path.join(here, '**/*.{ts,tsx,html}')] }),
        autoprefixer(),
      ],
    },
  },
  server: { port: 5199, fs: { allow: [repo] } },
})
