import { useEffect, useRef, useState, useCallback } from 'react'
import { Icon } from '../../lib/icons'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface Props {
  /** Arquivo de imagem original selecionado pelo usuário. */
  file: File
  /** Callback ao salvar — recebe um Blob WebP 512x512 já cropado. */
  onSave: (blob: Blob) => Promise<void> | void
  onClose: () => void
}

const VIEWPORT_SIZE = 320 // tamanho do quadrado do "palco" em px
const OUTPUT_SIZE = 512   // resolução final do avatar exportado
const MIN_ZOOM = 1
const MAX_ZOOM = 3

/**
 * Modal para crop circular ajustável.
 * O usuário arrasta a imagem e ajusta o zoom — a área visível dentro do círculo
 * será exportada como WebP 512x512.
 */
export default function AvatarCropModal({ file, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)

  // Carrega a imagem para obter dimensões naturais
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    const img = new Image()
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
      // Centraliza inicialmente
      setOffset({ x: 0, y: 0 })
      setZoom(1)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Esc fecha
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  /**
   * Calcula a "escala base" — quanto a imagem foi escalada para caber no
   * viewport com object-fit: cover. Tudo o que o usuário vê no viewport
   * é a imagem original × baseScale × zoom, deslocada por offset.
   */
  const baseScale = imgSize
    ? Math.max(VIEWPORT_SIZE / imgSize.w, VIEWPORT_SIZE / imgSize.h)
    : 1

  // Limita o offset para que a imagem não saia do viewport
  const clampOffset = useCallback((nx: number, ny: number, z: number) => {
    if (!imgSize) return { x: 0, y: 0 }
    const scaledW = imgSize.w * baseScale * z
    const scaledH = imgSize.h * baseScale * z
    const maxX = Math.max(0, (scaledW - VIEWPORT_SIZE) / 2)
    const maxY = Math.max(0, (scaledH - VIEWPORT_SIZE) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, nx)),
      y: Math.max(-maxY, Math.min(maxY, ny)),
    }
  }, [imgSize, baseScale])

  // Reaplica clamp quando o zoom muda
  useEffect(() => {
    setOffset(prev => clampOffset(prev.x, prev.y, zoom))
  }, [zoom, clampOffset])

  // Drag handlers
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset(clampOffset(dragRef.current.baseX + dx, dragRef.current.baseY + dy, zoom))
  }
  const onPointerUp = () => { dragRef.current = null }

  // Wheel para zoom
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)))
  }

  // Gera o blob final
  const handleSave = async () => {
    if (!imgUrl || !imgSize || saving) return
    setSaving(true)
    try {
      const img = new Image()
      img.src = imgUrl
      await new Promise<void>((resolve, reject) => {
        if (img.complete) resolve()
        else { img.onload = () => resolve(); img.onerror = () => reject(new Error('img load')) }
      })

      // Calcula a área da imagem original que está visível no viewport
      const totalScale = baseScale * zoom
      const visibleSrcW = VIEWPORT_SIZE / totalScale
      const visibleSrcH = VIEWPORT_SIZE / totalScale
      // O centro da imagem original em pixels
      const centerX = imgSize.w / 2 - offset.x / totalScale
      const centerY = imgSize.h / 2 - offset.y / totalScale
      const sx = centerX - visibleSrcW / 2
      const sy = centerY - visibleSrcH / 2

      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas ctx')

      // Fundo escuro para evitar transparência (caso a imagem saia do círculo)
      ctx.fillStyle = '#1d2125'
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      ctx.drawImage(img, sx, sy, visibleSrcW, visibleSrcH, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob falhou')), 'image/webp', 0.92)
      })
      await onSave(blob)
    } catch (err) {
      console.error('[AvatarCropModal] falha ao gerar blob', err)
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
      ref={dialogRef}
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && !saving && onClose()}
    >
      <div
        className="w-full max-w-md mx-4 rounded-xl shadow-2xl overflow-hidden"
        style={{ background: '#282e33', border: '1px solid rgba(166,197,226,0.16)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ background: '#1d2125', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <Icon name="Image" size={15} style={{ color: '#25D066' }} />
            <h3 id="avatar-crop-title" className="font-bold text-sm" style={{ color: '#b6c2cf' }}>
              Ajustar foto de perfil
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label="Fechar"
          >
            <Icon name="X" size={16} style={{ color: '#596773' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col items-center gap-4">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            className="relative select-none touch-none"
            style={{
              width: VIEWPORT_SIZE,
              height: VIEWPORT_SIZE,
              background: '#1d2125',
              borderRadius: 12,
              overflow: 'hidden',
              cursor: dragRef.current ? 'grabbing' : 'grab',
            }}
          >
            {imgUrl && imgSize && (
              <img
                src={imgUrl}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: imgSize.w * baseScale * zoom,
                  height: imgSize.h * baseScale * zoom,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
            )}
            {/* Overlay com máscara circular */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background:
                  `radial-gradient(circle at center, transparent 0, transparent ${VIEWPORT_SIZE / 2 - 1}px, rgba(0,0,0,0.6) ${VIEWPORT_SIZE / 2}px)`,
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: VIEWPORT_SIZE - 4,
                height: VIEWPORT_SIZE - 4,
                marginLeft: -(VIEWPORT_SIZE - 4) / 2,
                marginTop: -(VIEWPORT_SIZE - 4) / 2,
                borderRadius: '50%',
                border: '2px solid rgba(37, 208, 102, 0.7)',
                pointerEvents: 'none',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
              }}
            />
          </div>

          {/* Slider de zoom */}
          <div className="w-full flex items-center gap-3">
            <Icon name="Image" size={13} style={{ color: '#596773' }} />
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1"
              style={{ accentColor: '#25D066' }}
              aria-label="Zoom"
            />
            <span
              className="font-data tabular-nums text-xs"
              style={{ color: '#8c9bab', minWidth: 36, textAlign: 'right' }}
            >
              {(zoom * 100).toFixed(0)}%
            </span>
          </div>

          <p className="text-xs text-center" style={{ color: '#596773' }}>
            Arraste a imagem para reposicionar · use a roda do mouse ou o controle para zoom
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3.5"
          style={{ background: '#1d2125', borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/5 transition-colors disabled:opacity-50"
            style={{ color: '#9fadbc' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !imgSize}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-60"
            style={{ background: '#25D066', color: '#1d2125' }}
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Icon name="Spinner" size={12} spin /> Salvando…
              </span>
            ) : 'Salvar foto'}
          </button>
        </div>
      </div>
    </div>
  )
}
