import { supabase } from './supabase'
import { logger } from './logger'
import type { Ticket } from './supabase'

interface SearchResult extends Ticket {
  rank?: number
}

/**
 * Busca tickets via RPC full-text search no Supabase.
 * Retorna resultados ordenados por relevância (ts_rank).
 */
export async function searchTicketsRPC(
  query: string,
  departmentId?: string,
  maxResults = 50
): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  try {
    const { data, error } = await supabase.rpc('search_tickets', {
      search_query: trimmed,
      dept_id: departmentId || null,
      max_results: maxResults,
    })

    if (error) {
      logger.warn('Search', 'RPC search_tickets falhou, usando fallback client-side', { error: error.message })
      return []
    }

    return (data as SearchResult[]) || []
  } catch (err) {
    logger.error('Search', 'Erro inesperado na busca server-side', { error: err })
    return []
  }
}

/**
 * Busca client-side como fallback quando o RPC não está disponível.
 */
export function searchTicketsLocal(tickets: Ticket[], query: string): Ticket[] {
  const q = query.trim().toLowerCase()
  if (!q) return tickets

  return tickets.filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.description && t.description.toLowerCase().includes(q)) ||
    (t.cliente && t.cliente.toLowerCase().includes(q)) ||
    (t.instancia && t.instancia.toLowerCase().includes(q)) ||
    (t.observacao && t.observacao.toLowerCase().includes(q))
  )
}

/**
 * Cria uma função debounced que atrasa a execução.
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
