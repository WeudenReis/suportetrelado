import { captureException, captureMessage } from './sentry'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

function formatMessage(level: LogLevel, module: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const ctx = context ? ` ${JSON.stringify(context)}` : ''
  return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${ctx}`
}

function log(level: LogLevel, module: string, message: string, context?: LogContext): void {
  const formatted = formatMessage(level, module, message, context)

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
        captureException(context.error, { module, message, ...context })
      } else {
        captureException(new Error(`[${module}] ${message}`), { module, ...context })
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
