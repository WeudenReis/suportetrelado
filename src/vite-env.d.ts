/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_URL_DEV?: string
  readonly VITE_SUPABASE_ANON_KEY_DEV?: string
  readonly DEV: boolean
}
