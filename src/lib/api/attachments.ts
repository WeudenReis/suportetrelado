import { supabase } from '../supabase'
import { logger } from '../logger'
import type { Attachment } from '../supabase'

export async function fetchAttachmentCounts(departmentId?: string): Promise<Record<string, number>> {
  let query = supabase.from('attachments').select('ticket_id')
  if (departmentId) query = query.eq('department_id', departmentId)
  const { data, error } = await query
  if (error) { logger.warn('Attachments', 'Erro ao contar anexos', { error: error.message }); return {} }
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.ticket_id] = (counts[row.ticket_id] || 0) + 1
  }
  return counts
}

export async function fetchAttachments(ticketId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) { logger.warn('Attachments', 'Tabela attachments pode não existir', { error: error.message }); return [] }
  return (data ?? []) as Attachment[]
}

export async function uploadAttachment(ticketId: string, file: File, userName: string, departmentId?: string): Promise<Attachment | null> {
  const fileExt = file.name.split('.').pop()
  // Path prefixado por dept garante isolamento no bucket. 'shared/' preserva compatibilidade com uploads legados sem dept.
  const deptPrefix = departmentId ? `${departmentId}/` : 'shared/'
  const filePath = `${deptPrefix}${ticketId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(filePath, file)
  if (uploadError) { logger.error('Attachments', 'Falha no upload', { error: uploadError.message }); return null }

  const { data: signedData, error: signError } = await supabase.storage
    .from('attachments')
    .createSignedUrl(filePath, 3600)

  const fileUrl = signedData?.signedUrl
  if (signError || !fileUrl) {
    const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath)
    logger.warn('Attachments', 'Signed URL falhou, usando public URL', { error: signError?.message })
    const fallbackUrl = publicUrl
    const fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file'
    const row: Record<string, unknown> = { ticket_id: ticketId, file_name: file.name, file_url: fallbackUrl, file_type: fileType, uploaded_by: userName, storage_path: filePath }
    if (departmentId) row.department_id = departmentId
    const { data, error } = await supabase.from('attachments').insert(row).select().single()
    if (error) { logger.error('Attachments', 'Falha ao salvar anexo', { error: error.message }); return null }
    return data as Attachment
  }

  const fileType = file.type.startsWith('image/') ? 'image'
    : file.type.startsWith('video/') ? 'video' : 'file'

  const row: Record<string, unknown> = { ticket_id: ticketId, file_name: file.name, file_url: fileUrl, file_type: fileType, uploaded_by: userName, storage_path: filePath }
  if (departmentId) row.department_id = departmentId
  const { data, error } = await supabase
    .from('attachments')
    .insert(row)
    .select()
    .single()
  if (error) { logger.error('Attachments', 'Falha ao salvar anexo', { error: error.message }); return null }
  return data as Attachment
}

export async function getSignedAttachmentUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(storagePath, expiresIn)
  if (error) { logger.warn('Attachments', 'Signed URL error', { error: error.message }); return null }
  return data.signedUrl
}

export async function deleteAttachment(id: string, fileUrl: string): Promise<void> {
  try {
    const url = new URL(fileUrl)
    const pathParts = url.pathname.split('/storage/v1/object/public/attachments/')
    if (pathParts[1]) {
      await supabase.storage.from('attachments').remove([decodeURIComponent(pathParts[1])])
    }
  } catch { /* ignore path extraction errors */ }
  await supabase.from('attachments').delete().eq('id', id)
}
