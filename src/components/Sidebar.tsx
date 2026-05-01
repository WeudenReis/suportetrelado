import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../lib/icons'
const INTEGRATIONS = [
  { label: 'Email',  icon: '✉️', border: '#3b82f6', isNew: false },
  { label: 'Chrome', icon: '🌐', border: '#f59e0b', isNew: false },
  { label: 'Phone',  icon: '📱', border: '#22c55e', isNew: false },
  { label: 'Teams',  icon: '🟣', border: '#8b5cf6', isNew: true },
]

const MIN_WIDTH = 52
const MAX_WIDTH = 420
const DEFAULT_WIDTH = 280
const COLLAPSE_THRESHOLD = 120

interface SidebarProps {
  user: string
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ user: _user, collapsed, onToggle }: SidebarProps) {
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const isResizing = useRef(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX))
      if (newWidth < COLLAPSE_THRESHOLD && !collapsed) {
        onToggle()
        isResizing.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      } else if (newWidth >= COLLAPSE_THRESHOLD) {
        if (collapsed) onToggle()
        setWidth(newWidth)
      }
    }
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [collapsed, onToggle])

  const currentWidth = collapsed ? MIN_WIDTH : width

  return (
    <div ref={sidebarRef} className={`sidebar-root h-full flex-shrink-0 relative z-30 flex ${collapsed ? 'sidebar-root--collapsed' : ''}`} style={{ width: currentWidth }}>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Toggle button */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-5 z-40 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          {collapsed ? <Icon name="ChevronRight" size={14} /> : <Icon name="ChevronLeft" size={14} />}
        </button>

        {collapsed ? (
          <div className="flex flex-col items-center pt-4 gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Icon name="Inbox" size={16} className="text-blue-400" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full px-3 pt-3 pb-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.16)' }}>
                  <Icon name="Inbox" size={15} className="text-blue-300" />
                </div>
                <span className="text-xl font-bold truncate" style={{ color: '#ffffff' }}>Caixa de entrada</span>
              </div>
              <div className="flex items-center gap-1">
                <button className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: '#9fb0c2' }}>
                  <Icon name="SlidersHorizontal" size={14} />
                </button>
                <button className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: '#9fb0c2' }}>
                  <Icon name="MoreHorizontal" size={14} />
                </button>
              </div>
            </div>

            {/* Quick add */}
            <input
              placeholder="Adicionar um cartão"
              className="w-full rounded-lg px-3 py-2.5 text-sm mb-4 outline-none"
              style={{ background: 'rgba(34,39,43,0.85)', border: '1px solid rgba(255,255,255,0.08)', color: '#dfe1e6' }}
            />

            {/* Consolidate section */}
            <div className="rounded-2xl p-5 mb-4 flex-1 flex flex-col" style={{ background: '#1f3a63', border: '1px solid rgba(255,255,255,0.12)' }}>
              <h3 className="text-[26px] font-semibold text-center mb-1" style={{ color: '#f5f7fb' }}>
                Consolide suas tarefas
              </h3>
              <p className="text-sm leading-relaxed text-center mb-6" style={{ color: 'rgba(229,238,249,0.88)' }}>
                Envie por e-mail, diga, encaminhe-da forma que for, coloque isso no Trello rapidamente.
              </p>

              {/* Integration icons */}
              <div className="grid grid-cols-3 gap-y-3 place-items-center mt-1 mb-auto">
                {INTEGRATIONS.map(ig => (
                  <motion.div
                    key={ig.label}
                    whileHover={{ scale: 1.08, y: -1 }}
                    onHoverStart={() => setHoveredIcon(ig.label)}
                    onHoverEnd={() => setHoveredIcon(null)}
                    className="relative w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-shadow"
                    style={{
                      background: 'rgba(20,25,35,0.38)',
                      border: `1.5px solid ${ig.border}`,
                      boxShadow: hoveredIcon === ig.label ? `0 0 10px ${ig.border}55` : 'none',
                    }}
                  >
                    <span className="text-lg">{ig.icon}</span>
                    {ig.isNew && (
                      <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black px-1.5 py-px rounded-md text-white" style={{ background: '#1e63d8' }}>
                        NOVO
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Bottom lock */}
              <div className="flex items-center gap-2 pt-3 mt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.14)' }}>
                <Icon name="Lock" size={12} style={{ color: 'rgba(229,238,249,0.88)' }} />
                <span className="text-sm leading-tight font-semibold" style={{ color: 'rgba(229,238,249,0.88)' }}>
                  A Caixa de Entrada é visível apenas para você
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      {!collapsed && (
        <div
          onMouseDown={startResize}
          className="sidebar-resize-handle"
          title="Arrastar para redimensionar"
        />
      )}
    </div>
  )
}
