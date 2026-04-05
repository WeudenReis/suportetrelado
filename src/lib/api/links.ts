import { supabase } from '../supabase'
import { logger } from '../logger'
import type { UsefulLink } from '../supabase'

export async function fetchUsefulLinks(departmentId?: string): Promise<UsefulLink[]> {
  let query = supabase.from('useful_links').select('*')
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query
    .order('category', { ascending: true })
    .order('title', { ascending: true })
  if (error) { logger.warn('Links', 'Erro ao buscar links', { error: error.message }); return [] }
  return (data ?? []) as UsefulLink[]
}

export async function insertUsefulLink(link: { title: string; url: string; description?: string; category: string; added_by: string }): Promise<UsefulLink | null> {
  const { data, error } = await supabase
    .from('useful_links')
    .insert(link)
    .select()
    .single()
  if (error) { logger.error('Links', 'Falha ao inserir link', { error: error.message }); return null }
  return data as UsefulLink
}

export async function updateUsefulLink(id: string, updates: Partial<UsefulLink>): Promise<void> {
  await supabase.from('useful_links').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteUsefulLink(id: string): Promise<boolean> {
  const { error } = await supabase.from('useful_links').delete().eq('id', id)
  if (error) {
    logger.error('Links', 'Falha ao deletar link', { error: error.message })
    return false
  }
  return true
}
