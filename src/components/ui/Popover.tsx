import { useEffect, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PopoverProps {
  open: boolean
  onClose: () => void
  /** Elemento âncora (botão). Renderizado sempre. */
  anchor: ReactNode
  /** Conteúdo do painel flutuante. Renderizado quando `open=true`. */
  children: ReactNode
  /** `end` = alinha direita ao âncora (padrão). `start` = alinha esquerda. */
  align?: 'start' | 'end'
  /** Largura fixa do popover. Default 320. */
  width?: number
  /** Offset vertical em px. Default 8. */
  offsetY?: number
}

/**
 * Painel flutuante posicionado relativo ao âncora.
 * Fecha automaticamente em clique externo ou Escape.
 */
export default function Popover({
  open,
  onClose,
  anchor,
  children,
  align = 'end',
  width = 320,
  offsetY = 8,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {anchor}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: `calc(100% + ${offsetY}px)`,
              [align === 'end' ? 'right' : 'left']: 0,
              width,
              maxHeight: 'calc(100vh - 96px)',
              zIndex: 100,
              background: '#22272b',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              fontFamily: "'Space Grotesk', sans-serif",
              color: '#E6E5E8',
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
