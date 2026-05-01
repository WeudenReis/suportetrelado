import '@testing-library/jest-dom/vitest'
import React from 'react'

// Mock variáveis de ambiente do Vite
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://fake-test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'fake-anon-key-for-tests',
    VITE_ENV: 'test',
    MODE: 'test',
    DEV: true,
    PROD: false,
  },
})

// Mock Sentry para evitar inicialização real nos testes
vi.mock('../lib/sentry', () => ({
  initSentry: vi.fn(),
  setSentryUser: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// Mock logger para silenciar logs nos testes
vi.mock('../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock framer-motion para evitar problemas de animação nos testes
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          // Retorna componente wrapper que passa todas as props para o elemento HTML
          const Component = (props: Record<string, unknown>) => {
            const filteredProps: Record<string, unknown> = {}
            for (const [key, value] of Object.entries(props)) {
              // Filtrar props específicas do framer-motion
              if (
                !key.startsWith('animate') &&
                !key.startsWith('initial') &&
                !key.startsWith('exit') &&
                !key.startsWith('transition') &&
                !key.startsWith('variants') &&
                !key.startsWith('whileHover') &&
                !key.startsWith('whileTap') &&
                !key.startsWith('whileFocus') &&
                !key.startsWith('whileInView') &&
                !key.startsWith('layout') &&
                key !== 'drag' &&
                key !== 'dragConstraints' &&
                key !== 'onAnimationComplete'
              ) {
                filteredProps[key] = value
              }
            }
            return React.createElement(prop, filteredProps)
          }
          Component.displayName = `motion.${prop}`
          return Component
        },
      }
    ),
    animate: vi.fn().mockResolvedValue(undefined),
    useReducedMotion: () => false,
    useAnimation: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      set: vi.fn(),
    }),
  }
})

// Limpar mocks após cada teste
afterEach(() => {
  vi.clearAllMocks()
})
