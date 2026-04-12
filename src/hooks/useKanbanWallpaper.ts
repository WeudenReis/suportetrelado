import { useState } from 'react'

interface UseKanbanWallpaperProps {
  user: string
  onToast: (msg: string, type: 'ok' | 'err') => void
}

export function useKanbanWallpaper({ user, onToast }: UseKanbanWallpaperProps) {
  const wallpaperStorageKey = `chatpro-wallpaper:${user.toLowerCase()}`
  const recentWallpapersKey = `chatpro-recent-wallpapers:${user.toLowerCase()}`

  const [wallpaper, setWallpaper] = useState<string>(() => {
    try { return localStorage.getItem(wallpaperStorageKey) || '' } catch { return '' }
  })
  const [wallpaperInput, setWallpaperInput] = useState('')
  const [recentWallpapers, setRecentWallpapers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(recentWallpapersKey) || '[]') as string[] } catch { return [] }
  })

  const applyWallpaper = (url: string) => {
    setWallpaper(url)
    try {
      localStorage.setItem(wallpaperStorageKey, url)
    } catch {
      onToast('Sem espaço local para salvar este fundo', 'err')
    }
    if (url && (url.startsWith('data:') || url.startsWith('http'))) {
      setRecentWallpapers(prev => {
        const updated = [url, ...prev.filter(w => w !== url)].slice(0, 4)
        try { localStorage.setItem(recentWallpapersKey, JSON.stringify(updated)) } catch { /* ignore */ }
        return updated
      })
    }
  }

  const readFileAsDataURL = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) return reject(new Error('empty_data_url'))
      resolve(dataUrl)
    }
    reader.onerror = () => reject(new Error('read_error'))
    reader.readAsDataURL(file)
  })

  const loadImageFromFile = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('load_image_error')) }
    img.src = objectUrl
  })

  const estimateDataUrlBytes = (dataUrl: string) => {
    const base64 = dataUrl.split(',')[1] || ''
    return Math.floor(base64.length * 0.75)
  }

  const compressWallpaperImage = async (file: File): Promise<string> => {
    const image = await loadImageFromFile(file)
    const MAX_DIMENSION = 1920
    const TARGET_BYTES = 900 * 1024
    const largestSide = Math.max(image.width, image.height)
    const scale = largestSide > MAX_DIMENSION ? MAX_DIMENSION / largestSide : 1

    let width = Math.max(1, Math.round(image.width * scale))
    let height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas_context_error')

    let quality = 0.86
    let output = ''

    for (let step = 0; step < 6; step += 1) {
      canvas.width = width
      canvas.height = height
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(image, 0, 0, width, height)
      output = canvas.toDataURL('image/jpeg', quality)
      if (estimateDataUrlBytes(output) <= TARGET_BYTES) return output
      if (quality > 0.52) {
        quality = Math.max(0.52, quality - 0.08)
      } else {
        width = Math.max(800, Math.round(width * 0.88))
        height = Math.max(500, Math.round(height * 0.88))
      }
    }

    return output || canvas.toDataURL('image/jpeg', 0.52)
  }

  const handleWallpaperFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onToast('Selecione um arquivo de imagem válido', 'err')
      event.target.value = ''
      return
    }
    try {
      const SOURCE_COMPRESSION_THRESHOLD = 900 * 1024
      const needsCompression = file.size > SOURCE_COMPRESSION_THRESHOLD
      const dataUrl = needsCompression
        ? await compressWallpaperImage(file)
        : await readFileAsDataURL(file)
      applyWallpaper(dataUrl)
      onToast(needsCompression ? 'Fundo importado e comprimido com sucesso' : 'Fundo atualizado com imagem local', 'ok')
    } catch {
      onToast('Erro ao importar imagem', 'err')
    }
    event.target.value = ''
  }

  const removeRecentWallpaper = (index: number) => {
    const updated = recentWallpapers.filter((_, i) => i !== index)
    setRecentWallpapers(updated)
    try { localStorage.setItem(recentWallpapersKey, JSON.stringify(updated)) } catch { /* ignore */ }
  }

  const clearRecentWallpapers = () => {
    setRecentWallpapers([])
    try { localStorage.removeItem(recentWallpapersKey) } catch { /* ignore */ }
  }

  const deleteCurrentWallpaper = () => {
    const wpToRemove = wallpaper
    setWallpaper('')
    try { localStorage.setItem(wallpaperStorageKey, '') } catch { /* ignore */ }
    setRecentWallpapers(prev => {
      const updated = prev.filter(w => w !== wpToRemove)
      try { localStorage.setItem(recentWallpapersKey, JSON.stringify(updated)) } catch { /* ignore */ }
      return updated
    })
  }

  return {
    wallpaper,
    wallpaperInput, setWallpaperInput,
    recentWallpapers,
    applyWallpaper,
    handleWallpaperFileSelect,
    removeRecentWallpaper,
    clearRecentWallpapers,
    deleteCurrentWallpaper,
  }
}
