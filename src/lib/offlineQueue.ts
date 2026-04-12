/**
 * Fila de mutações offline.
 *
 * Persiste em localStorage as mutações que falharam por falta de rede (navigator.offline
 * ou erros de fetch) e re-executa automaticamente quando o navegador volta online.
 *
 * Uso típico (em APIs que querem opt-in à fila):
 *
 *   import { enqueueIfOffline, withOfflineFallback } from '../lib/offlineQueue'
 *
 *   export async function insertComment(...) {
 *     return withOfflineFallback('insertComment', args, async () => {
 *       return await supabase.from('comments').insert(...)
 *     })
 *   }
 *
 * Intencionalmente simples: não tenta merge/resolução de conflito — apenas retry.
 * Mutações críticas (moveTicket, updateTicket) devem continuar usando optimistic-UI
 * com rollback, e apenas enfileirar o lado de persistência.
 */
import { logger } from './logger'

const STORAGE_KEY = 'chatpro-offline-queue'

interface QueuedMutation {
  id: string
  op: string
  args: unknown
  attempts: number
  createdAt: number
}

type Executor = (args: unknown) => Promise<unknown>
const executors = new Map<string, Executor>()

/** Registra um executor para uma operação. Chame uma vez no bootstrap. */
export function registerOfflineExecutor(op: string, fn: Executor): void {
  executors.set(op, fn)
}

function loadQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // localStorage cheio: dropa o item mais antigo
    const trimmed = queue.slice(-50)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)) } catch { /* sem recurso */ }
  }
}

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')
}

/** Enfileira uma operação para retry futuro. */
export function enqueueMutation(op: string, args: unknown): void {
  const queue = loadQueue()
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    op,
    args,
    attempts: 0,
    createdAt: Date.now(),
  })
  saveQueue(queue)
  logger.info('OfflineQueue', `Enfileirado: ${op}`, { total: queue.length })
}

/** Wrapper: tenta a mutação; se falhar por rede, enfileira e retorna null. */
export async function withOfflineFallback<T>(
  op: string,
  args: unknown,
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    if (isNetworkError(err)) {
      enqueueMutation(op, args)
      return null
    }
    throw err
  }
}

/** Re-executa a fila. Itens que falharem novamente voltam à fila. */
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const queue = loadQueue()
  if (queue.length === 0) return { ok: 0, failed: 0 }

  const remaining: QueuedMutation[] = []
  let ok = 0
  let failed = 0

  for (const item of queue) {
    const exec = executors.get(item.op)
    if (!exec) {
      logger.warn('OfflineQueue', `Sem executor para ${item.op} — descartando`)
      continue
    }
    try {
      await exec(item.args)
      ok++
    } catch (err) {
      failed++
      item.attempts++
      if (item.attempts < 5) {
        remaining.push(item)
      } else {
        logger.error('OfflineQueue', `Item ${item.op} falhou 5x — descartando`, { err: String(err) })
      }
    }
  }

  saveQueue(remaining)
  logger.info('OfflineQueue', `Flush: ${ok} ok, ${failed} falhas`, { remaining: remaining.length })
  return { ok, failed }
}

/** Tamanho atual da fila (diagnóstico). */
export function queueSize(): number {
  return loadQueue().length
}

/** Instala listener global que dá flush automático no `online`. */
export function installOfflineListener(): () => void {
  if (typeof window === 'undefined') return () => { /* noop */ }
  const onOnline = () => { void flushQueue() }
  window.addEventListener('online', onOnline)
  // Flush inicial se já estiver online
  if (navigator.onLine !== false) void flushQueue()
  return () => window.removeEventListener('online', onOnline)
}
