import { supabase } from '../supabase'
import { logger } from '../logger'
import type { AnnouncementAttachment, AnnouncementAttachmentType } from '../supabase'

const BUCKET = 'attachments'

function classify(mime: string): AnnouncementAttachmentType {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return 'file'
}

function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').slice(0, 120)
}

/**
 * Faz upload de um anexo de aviso no bucket `attachments` sob o prefixo
 * `{deptId}/announcements/...` (herda as policies escopadas por dept da
 * migration 012). Retorna metadata serializável para gravar no JSONB do
 * announcement, ou null em caso de falha.
 */
export async function uploadAnnouncementAttachment(
  file: File,
  departmentId: string,
): Promise<AnnouncementAttachment | null> {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${departmentId}/announcements/${ts}-${rand}/${safeName(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false })

  if (uploadError) {
    logger.error('AnnouncementAttachments', 'Falha no upload', { error: uploadError.message })
    return null
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)

  let url = signed?.signedUrl
  if (signError || !url) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    url = data.publicUrl
    logger.warn('AnnouncementAttachments', 'Signed URL falhou, usando public', { error: signError?.message })
  }

  return {
    name: file.name,
    url,
    storage_path: path,
    type: classify(file.type),
    mime: file.type || 'application/octet-stream',
    size: file.size,
  }
}

/** Renova signed URLs de uma lista de anexos (URLs Supabase expiram em 1h). */
export async function refreshAttachmentUrls(
  attachments: AnnouncementAttachment[],
): Promise<AnnouncementAttachment[]> {
  if (!attachments.length) return attachments
  return Promise.all(attachments.map(async att => {
    if (!att.storage_path) return att
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(att.storage_path, 3600)
    return data?.signedUrl ? { ...att, url: data.signedUrl } : att
  }))
}

/** Remove um objeto do Storage. Falhas são logadas mas não propagadas — o
 *  registro JSONB é o source-of-truth e já terá sido removido pelo caller. */
export async function deleteAnnouncementAttachmentObject(storagePath: string): Promise<void> {
  if (!storagePath) return
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) logger.warn('AnnouncementAttachments', 'Falha ao remover do storage', { error: error.message })
}
