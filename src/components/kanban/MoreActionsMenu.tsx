import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MoreHorizontal, RefreshCw, Share2, LayoutGrid, List,
  Minimize2, Maximize2, ChevronsUpDown, ChevronsDownUp,
  CheckSquare, Keyboard, Plug, Loader2,
} from 'lucide-react'

interface MoreActionsMenuProps {
  onRefresh: () => void
  refreshing: boolean
  onShare: () => void
  viewMode: 'kanban' | 'list'
  onChangeViewMode: (mode: 'kanban' | 'list') => void
  compactMode: boolean
  onToggleCompact: () => void
  bulkMode: boolean
  onToggleBulk: () => void
  onShowShortcuts: () => void
  onOpenInstance: () => void
  /** Quando estiver em modo lista, expõe o controle de recolher tudo. */
  collapseAllAvailable: boolean
  allCollapsed: boolean
  onCollapseAll: () => void
  onExpandAll: () => void
}

interface ActionItemProps {
  icon: ReactNode
  label: string
  hint?: string
  active?: boolean
  onClick: () => void
}

function ActionItem({ icon, label, hint, active, onClick }: ActionItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 12px', borderRadius: 8,
        background: active ? 'rgba(37,208,102,0.1)' : 'transparent',
        color: active ? '#25D066' : '#B6C2CF',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        fontFamily: "'Space Grotesk', sans-serif", fontSize: 12.5, fontWeight: 500,
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0, color: active ? '#25D066' : '#8C96A3' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {hint && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#596773',
          padding: '1px 5px', borderRadius: 4,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>{hint}</span>
      )}
    </button>
  )
}

function MenuDivider() {
  return <span style={{ display: 'block', height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />
}

function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{
      display: 'block', padding: '8px 12px 4px',
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#596773',
    }}>{children}</span>
  )
}

export default function MoreActionsMenu({
  onRefresh, refreshing, onShare,
  viewMode, onChangeViewMode,
  compactMode, onToggleCompact,
  bulkMode, onToggleBulk,
  onShowShortcuts, onOpenInstance,
  collapseAllAvailable, allCollapsed, onCollapseAll, onExpandAll,
}: MoreActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)
  const fire = (fn: () => void) => () => { fn(); close() }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="trello-icon-btn"
        title="Mais ações"
        aria-haspopup="menu"
        aria-expanded={open}
        style={open ? { color: '#25D066', background: 'rgba(37,208,102,0.12)' } : undefined}
      >
        <MoreHorizontal size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 240, zIndex: 100,
              background: '#22272b',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)',
              padding: 6,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <MenuLabel>Visualização do quadro</MenuLabel>
            <ActionItem
              icon={viewMode === 'kanban' ? <LayoutGrid size={14} /> : <List size={14} />}
              label={viewMode === 'kanban' ? 'Modo Kanban' : 'Modo Lista'}
              onClick={fire(() => onChangeViewMode(viewMode === 'kanban' ? 'list' : 'kanban'))}
            />
            <ActionItem
              icon={compactMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              label={compactMode ? 'Modo compacto (ativo)' : 'Modo compacto'}
              hint="C"
              active={compactMode}
              onClick={fire(onToggleCompact)}
            />
            {collapseAllAvailable && (
              <ActionItem
                icon={allCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
                label={allCollapsed ? 'Expandir todas as colunas' : 'Recolher todas as colunas'}
                onClick={fire(allCollapsed ? onExpandAll : onCollapseAll)}
              />
            )}

            <MenuDivider />
            <MenuLabel>Ações</MenuLabel>
            <ActionItem
              icon={refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              label="Atualizar tickets"
              hint="R"
              onClick={fire(onRefresh)}
            />
            <ActionItem
              icon={<Share2 size={14} />}
              label="Compartilhar link"
              onClick={fire(onShare)}
            />
            <ActionItem
              icon={<CheckSquare size={14} />}
              label={bulkMode ? 'Sair da seleção múltipla' : 'Seleção múltipla'}
              active={bulkMode}
              onClick={fire(onToggleBulk)}
            />
            <ActionItem
              icon={<Plug size={14} />}
              label="Configurar instância"
              onClick={fire(onOpenInstance)}
            />

            <MenuDivider />
            <ActionItem
              icon={<Keyboard size={14} />}
              label="Atalhos de teclado"
              hint="?"
              onClick={fire(onShowShortcuts)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
