import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, Lock, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

const INTEGRATIONS = [
  { label: 'Email',  icon: '✉️', border: '#3b82f6', isNew: false },
  { label: 'Chrome', icon: '🌐', border: '#f59e0b', isNew: false },
  { label: 'Slack',  icon: '💬', border: '#e11d48', isNew: true },
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

export default function Sidebar({ user, collapsed, onToggle }: SidebarProps) {
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
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {collapsed ? (
          <div className="flex flex-col items-center pt-4 gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Inbox size={16} className="text-blue-400" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full px-4 pt-4 pb-3">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
                <Inbox size={16} className="text-blue-400" />
              </div>
              <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>Caixa de Entrada</span>
            </div>

            {/* Consolidate section */}
            <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-[13px] font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                Consolide suas tarefas
              </h3>
              <p className="text-[11px] leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
                Conecte ferramentas que você usa para receber notificações e transformar mensagens em tickets.
              </p>

              {/* Integration icons */}
              <div className="flex items-center justify-center gap-2.5 mb-1 flex-wrap">
                {INTEGRATIONS.map(ig => (
                  <motion.div
                    key={ig.label}
                    whileHover={{ scale: 1.15, y: -2 }}
                    onHoverStart={() => setHoveredIcon(ig.label)}
                    onHoverEnd={() => setHoveredIcon(null)}
                    className="relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-shadow"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: `2px solid ${ig.border}33`,
                      boxShadow: hoveredIcon === ig.label ? `0 0 12px ${ig.border}44` : 'none',
                    }}
                  >
                    <span className="text-base">{ig.icon}</span>
                    {ig.isNew && (
                      <span className="absolute -top-1.5 -right-1.5 text-[7px] font-black px-1 py-px rounded-full text-white" style={{ background: '#3b82f6' }}>
                        NEW
                      </span>
                    )}
                    <AnimatePresence>
                      {hoveredIcon === ig.label && (
                        <motion.span
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute -bottom-5 text-[9px] font-semibold whitespace-nowrap"
                          style={{ color: ig.border }}
                        >
                          {ig.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="space-y-1 mb-auto">
              <NavItem label="Não lidos" count={0} />
              <NavItem label="Menções" count={0} />
              <NavItem label="Atribuídos a mim" count={0} active />
            </div>

            {/* Bottom lock */}
            <div className="flex items-center gap-2 pt-3 mt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <Lock size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                A Caixa de Entrada é visível apenas para você
              </span>
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

function NavItem({ label, count, active }: { label: string; count: number; active?: boolean }) {
  return (
    <button
      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-colors text-left"
      style={{
        background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
        color: active ? '#60a5fa' : 'var(--text-secondary)',
      }}
    >
      <span className="font-medium">{label}</span>
      {count > 0 && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>
          {count}
        </span>
      )}
    </button>
  )
}
