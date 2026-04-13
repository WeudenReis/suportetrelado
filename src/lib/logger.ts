import { captureException, captureMessage } from './sentry'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

const IS_PROD = import.meta.env.PROD

/** Keys whose values are always redacted in logs to prevent PII/credential leakage. */
const SENSITIVE_KEYS = new Set(['password', 'senha', 'token', 'secret', 'key', 'apikey', 'api_key', 'authorization'])

function redact(context?: LogContext): LogContext | undefined {
  if (!context) return undefined
  const safe: LogContext = {}
  for (const [k, v] of Object.entries(context)) {
    safe[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v
  }
  return safe
}

function formatMessage(level: LogLevel, module: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const ctx = context ? ` ${JSON.stringify(context)}` : ''
  return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${ctx}`
}

function log(level: LogLevel, module: string, message: string, context?: LogContext): void {
  // In production, silence debug and info to keep DevTools clean for end-users.
  if (IS_PROD && (level === 'debug' || level === 'info')) return

  const safeContext = redact(context)
  const formatted = formatMessage(level, module, message, safeContext)

  switch (level) {
    case 'debug':
      console.debug(formatted)
      break
    case 'info':
      console.info(formatted)
      break
    case 'warn':
      console.warn(formatted)
      captureMessage(`[${module}] ${message}`, 'warning')
      break
    case 'error':
      console.error(formatted)
      if (context?.error instanceof Error) {
        captureException(context.error, { module, message, ...safeContext })
      } else {
        captureException(new Error(`[${module}] ${message}`), { module, ...safeContext })
      }
      break
  }
}

export const logger = {
  debug: (module: string, message: string, context?: LogContext) => log('debug', module, message, context),
  info: (module: string, message: string, context?: LogContext) => log('info', module, message, context),
  warn: (module: string, message: string, context?: LogContext) => log('warn', module, message, context),
  error: (module: string, message: string, context?: LogContext) => log('error', module, message, context),
}
