import { supabase } from './supabase'

export interface BoardColumn {
  id: string
  title: string
  position: number
  dot_color: string
  is_archived: boolean
  created_at: string
  updated_at: string
}

export async function fetchBoardColumns(): Promise<BoardColumn[]> {
  const { data, error } = await supabase
    .from('board_columns')
    .select('*')
    .eq('is_archived', false)
    .order('position', { ascending: true })
  if (error) throw error
  return (data ?? []) as BoardColumn[]
}

export async function insertBoardColumn(title: string, position: number, dot_color = '#579dff'): Promise<BoardColumn> {
  const { data, error } = await supabase
    .from('board_columns')
    .insert({
      title: title.trim(),
      position,
      dot_color,
      is_archived: false,
    })
    .select()
    .single()
  if (error) throw error
  return data as BoardColumn
}

export async function archiveBoardColumn(id: string): Promise<void> {
  const { error } = await supabase
    .from('board_columns')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function restoreBoardColumn(id: string): Promise<void> {
  const { error } = await supabase
    .from('board_columns')
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteBoardColumn(id: string): Promise<void> {
  const { error } = await supabase
    .from('board_columns')
    .delete()
    .eq('id', id)
  if (error) throw error
}
