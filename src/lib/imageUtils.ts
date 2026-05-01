/**
 * Utilitários de compressão e otimização de imagens.
 * Usa Canvas nativo do browser — zero dependências externas.
 */

/** Configuração de compressão */
interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number  // 0-1 (JPEG/WebP quality)
  format?: 'image/webp' | 'image/jpeg'
}

const COVER_OPTS: CompressOptions = { maxWidth: 800, maxHeight: 400, quality: 0.75, format: 'image/webp' }
const THUMB_OPTS: CompressOptions = { maxWidth: 400, maxHeight: 200, quality: 0.6, format: 'image/webp' }

/**
 * Comprime uma imagem File usando Canvas.
 * Retorna um novo File com tamanho reduzido.
 */
function compressImage(file: File, opts: CompressOptions): Promise<File> {
  return new Promise((resolve, _reject) => {
    // Se não for imagem, retorna original
    if (!file.type.startsWith('image/')) {
      resolve(file)
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { maxWidth = 800, maxHeight = 400, quality = 0.75, format = 'image/webp' } = opts

      let { width, height } = img

      // Calcular dimensões mantendo aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }

          // Se o comprimido ficou maior que o original, usar o original
          if (blob.size >= file.size) { resolve(file); return }

          const ext = format === 'image/webp' ? 'webp' : 'jpg'
          const newName = file.name.replace(/\.[^.]+$/, `.${ext}`)
          resolve(new File([blob], newName, { type: format }))
        },
        format,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // fallback: retorna original
    }

    img.src = url
  })
}

/** Comprime imagem para uso como capa (max 800x400, 75% quality) */
export function compressCover(file: File): Promise<File> {
  return compressImage(file, COVER_OPTS)
}

/** Comprime imagem para thumbnail no board (max 400x200, 60% quality) */
export function compressThumbnail(file: File): Promise<File> {
  return compressImage(file, THUMB_OPTS)
}

/** Comprime imagem de attachment (max 1600x1200, 80% quality) */
export function compressAttachment(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return Promise.resolve(file)
  return compressImage(file, { maxWidth: 1600, maxHeight: 1200, quality: 0.8, format: 'image/webp' })
}
