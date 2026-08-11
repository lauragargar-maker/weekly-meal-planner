/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Version + commit stamped at build time; see the `define` in vite.config.ts. */
declare const __APP_VERSION__: string








