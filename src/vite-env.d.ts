/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_URL_DEV?: string
  readonly VITE_SUPABASE_ANON_KEY_DEV?: string
  readonly VITE_DEV_ADMIN_EMAILS?: string
  readonly VITE_RECAPTCHA_SITE_KEY?: string
  readonly DEV: boolean
}

interface Window {
  grecaptcha?: {
    ready: (cb: () => void) => void
    render: (container: string | HTMLElement, params: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      theme?: 'dark' | 'light'
      size?: 'compact' | 'normal' | 'invisible'
    }) => number
    reset: (widgetId?: number) => void
  }
}
