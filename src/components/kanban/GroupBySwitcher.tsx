import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../../lib/icons'
import type { GroupByMode } from '../../lib/kanbanGrouping'

interface GroupBySwitcherProps {
  value: GroupByMode
  onChange: (mode: GroupByMode) => void
}

const OPTIONS: { key: GroupByMode; label: string }[] = [
  { key: 'none',     label: 'Sem agrupamento' },
  { key: 'assignee', label: 'Por responsável' },
  { key: 'priority', label: 'Por prioridade' },
  { key: 'cliente',  label: 'Por cliente' },
]

export default function GroupBySwitcher({ value, onChange }: GroupBySwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isActive = value !== 'none'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        className="trello-icon-btn"
        type="button"
        title="Agrupar cards"
        style={isActive ? { color: '#25D066', background: 'rgba(37,208,102,0.12)' } : undefined}
      >
        <Icon name="Layers" size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: '#1a1f23', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: 4, display: 'flex', flexDirection: 'column',
              gap: 2, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 99, fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <p style={{
              margin: 0, padding: '6px 10px 4px', fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em', color: '#596773',
            }}>
              Agrupar por
            </p>
            {OPTIONS.map(opt => {
              const selected = value === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => { onChange(opt.key); setOpen(false) }}
                  style={{
                    padding: '7px 10px', borderRadius: 6, border: 'none',
                    background: selected ? 'rgba(37,208,102,0.12)' : 'transparent',
                    color: selected ? '#25D066' : '#B6C2CF', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8, fontSize: 12, fontWeight: selected ? 700 : 500,
                    transition: 'background 0.12s', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                >
                  <span>{opt.label}</span>
                  {selected && <Icon name="Check" size={13} />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
