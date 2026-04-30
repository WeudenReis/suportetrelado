import { supabase } from '../supabase'
import { logger } from '../logger'

export type ChartType = 'bar' | 'pie' | 'line'
export type BlockDimension = 'column' | 'tag' | 'assignee' | 'priority' | 'due_date'

export interface DashboardBlock {
  id: string
  user_email: string
  department_id: string | null
  chart_type: ChartType
  dimension: BlockDimension
  title: string
  position: number
  created_at: string
  updated_at: string
}

export interface NewDashboardBlock {
  chart_type: ChartType
  dimension: BlockDimension
  title: string
  department_id?: string | null
}

/** Busca todos os blocos do usuario para o departamento atual (e os globais com department_id=NULL). */
export async function fetchUserDashboardBlocks(
  email: string,
  departmentId: string | null,
): Promise<DashboardBlock[]> {
  let query = supabase
    .from('user_dashboard_blocks')
    .select('*')
    .eq('user_email', email)
    .order('position', { ascending: true })

  if (departmentId) {
    query = query.or(`department_id.eq.${departmentId},department_id.is.null`)
  } else {
    query = query.is('department_id', null)
  }

  const { data, error } = await query
  if (error) {
    logger.error('DashboardBlocks', 'Falha ao buscar blocos', { error: error.message })
    return []
  }
  return (data ?? []) as DashboardBlock[]
}

/** Insere um novo bloco ao final da lista (position = max+1). */
export async function insertUserDashboardBlock(
  email: string,
  block: NewDashboardBlock,
): Promise<DashboardBlock | null> {
  // Calcula proxima posicao
  const { data: existing } = await supabase
    .from('user_dashboard_blocks')
    .select('position')
    .eq('user_email', email)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing && existing.length > 0 ? (existing[0].position as number) + 1 : 0

  const { data, error } = await supabase
    .from('user_dashboard_blocks')
    .insert({
      user_email: email,
      chart_type: block.chart_type,
      dimension: block.dimension,
      title: block.title,
      department_id: block.department_id ?? null,
      position: nextPosition,
    })
    .select()
    .single()

  if (error) {
    logger.error('DashboardBlocks', 'Falha ao inserir bloco', { error: error.message })
    return null
  }
  return data as DashboardBlock
}

/** Atualiza titulo, tipo, dimensao ou posicao de um bloco. */
export async function updateUserDashboardBlock(
  id: string,
  patch: Partial<Pick<DashboardBlock, 'title' | 'chart_type' | 'dimension' | 'position'>>,
): Promise<boolean> {
  const { error } = await supabase
    .from('user_dashboard_blocks')
    .update(patch)
    .eq('id', id)
  if (error) {
    logger.error('DashboardBlocks', 'Falha ao atualizar bloco', { error: error.message })
    return false
  }
  return true
}

/** Remove um bloco. */
export async function deleteUserDashboardBlock(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_dashboard_blocks')
    .delete()
    .eq('id', id)
  if (error) {
    logger.error('DashboardBlocks', 'Falha ao remover bloco', { error: error.message })
    return false
  }
  return true
}

/** Atualiza positions em batch (usado para reordenacao). */
export async function reorderUserDashboardBlocks(
  updates: Array<{ id: string; position: number }>,
): Promise<boolean> {
  const results = await Promise.all(
    updates.map(u =>
      supabase.from('user_dashboard_blocks').update({ position: u.position }).eq('id', u.id),
    ),
  )
  const failed = results.filter(r => r.error)
  if (failed.length > 0) {
    logger.error('DashboardBlocks', 'Falha ao reordenar', { count: failed.length })
    return false
  }
  return true
}
