import { supabase } from '../supabase'
import type { BoardLabel } from '../supabase'

export async function fetchBoardLabels(departmentId?: string): Promise<BoardLabel[]> {
  let query = supabase.from('board_labels').select('*')
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query.order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as BoardLabel[]
}

export async function insertBoardLabel(name: string, color: string, departmentId?: string): Promise<BoardLabel> {
  const row: Record<string, unknown> = { name, color }
  if (departmentId) row.department_id = departmentId
  const { data, error } = await supabase
    .from('board_labels')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  return data as BoardLabel
}

export async function updateBoardLabel(id: string, updates: { name?: string; color?: string }): Promise<void> {
  const { error } = await supabase
    .from('board_labels')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteBoardLabel(id: string): Promise<void> {
  const { error } = await supabase
    .from('board_labels')
    .delete()
    .eq('id', id)
  if (error) throw error
}
