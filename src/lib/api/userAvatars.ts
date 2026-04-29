import { supabase } from '../supabase'
import { logger } from '../logger'

const BUCKET = 'avatars'

export interface UploadedAvatar {
  storage_path: string
  signed_url: string
}

/**
 * Faz upload de uma imagem de avatar (já cropada/redimensionada) para o bucket
 * `avatars`. O caminho fica sob `{userId}/avatar-<ts>.<ext>` para satisfazer a
 * RLS (migration 028) que exige `(storage.foldername(name))[1] = auth.uid()`.
 */
export async function uploadUserAvatar(
  blob: Blob,
  userId: string,
  ext = 'webp',
): Promise<UploadedAvatar | null> {
  const ts = Date.now()
  const path = `${userId}/avatar-${ts}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || `image/${ext}`, upsert: false })

  if (uploadError) {
    logger.error('UserAvatars', 'Falha no upload', { error: uploadError.message })
    return null
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600)

  let url = signed?.signedUrl
  if (signError || !url) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    url = data.publicUrl
    logger.warn('UserAvatars', 'Signed URL falhou, usando public', { error: signError?.message })
  }

  return { storage_path: path, signed_url: url }
}

/** Gera signed URL válido por 1h para um path de avatar. Retorna null em caso de erro. */
export async function getAvatarSignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)
  if (error || !data?.signedUrl) {
    logger.warn('UserAvatars', 'Falha em createSignedUrl', { error: error?.message })
    return null
  }
  return data.signedUrl
}

/** Remove um avatar antigo. Falhas são logadas mas não propagadas. */
export async function deleteUserAvatarObject(storagePath: string): Promise<void> {
  if (!storagePath) return
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) logger.warn('UserAvatars', 'Falha ao remover do storage', { error: error.message })
}

/** Atualiza apenas a coluna avatar_url no perfil do usuário. */
export async function updateUserAvatarUrl(email: string, storagePath: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ avatar_url: storagePath })
    .eq('email', email)
  if (error) {
    logger.error('UserAvatars', 'Falha ao atualizar avatar_url', { error: error.message })
    return false
  }
  return true
}
