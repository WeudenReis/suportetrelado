import { supabase } from '../supabase'
import { logger } from '../logger'
import type { Ticket, TicketInsert, PaginationOptions } from '../supabase'

export async function fetchTickets(opts?: { departmentId?: string } & PaginationOptions): Promise<Ticket[]> {
  let query = supabase.from('tickets').select('*').eq('is_archived', false)
  if (opts?.departmentId) query = query.eq('department_id', opts.departmentId)
  query = query.order('created_at', { ascending: false })
  if (opts?.page && opts?.pageSize) {
    const from = (opts.page - 1) * opts.pageSize
    query = query.range(from, from + opts.pageSize - 1)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Ticket[]
}

export async function insertTicket(ticket: TicketInsert): Promise<Ticket> {
  const { data, error } = await supabase
    .from('tickets')
    .insert(ticket)
    .select()
    .single()
  if (error) {
    logger.error('Tickets', 'Falha ao inserir ticket', { error })
    if (error.message?.includes('schema cache')) {
      throw new Error('Coluna não encontrada no banco. Execute a migration v7 no Supabase SQL Editor.')
    }
    throw error
  }
  return data as Ticket
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    logger.error('Tickets', 'Falha ao atualizar ticket', { error })
    if (error.message?.includes('schema cache')) {
      throw new Error('Coluna não encontrada no banco. Execute a migration v7 no Supabase SQL Editor.')
    }
    throw error
  }
  return data as Ticket
}

export async function deleteTicket(id: string): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('id', id)
  if (error) throw error
}
