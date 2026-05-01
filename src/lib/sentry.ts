import * as Sentry from '@sentry/react'

const dsn = (import.meta.env.VITE_SENTRY_DSN || '').trim()
const isDevEnvironment = !import.meta.env.VITE_SUPABASE_URL?.includes('qacrxpfoamarslxskcyb')

let initialized = false

export function initSentry(): void {
  if (initialized || !dsn) return
  initialized = true

  Sentry.init({
    dsn,
    environment: isDevEnvironment ? 'development' : 'production',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: isDevEnvironment ? 1.0 : 0.2,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

export function setSentryUser(email: string | null): void {
  if (!initialized) return
  if (email) {
    Sentry.setUser({ email })
  } else {
    Sentry.setUser(null)
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (initialized) {
    Sentry.captureException(error, { extra: context })
  }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (initialized) {
    Sentry.captureMessage(message, level)
  }
}
