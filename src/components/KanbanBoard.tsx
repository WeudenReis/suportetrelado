import { useState, useCallback, useEffect, useRef } from 'react'
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LogOut, RefreshCw, Wifi, WifiOff, LayoutGrid, Settings, X, Loader2, Image } from 'lucide-react'
import { useTheme, type ThemeConfig } from '../lib/theme'
import { clsx } from 'clsx'
import Card from './Card'
import CardDetailModal from './CardDetailModal'
import { supabase, fetchTickets, insertTicket, updateTicket, sendToSlack, insertActivityLog } from '../lib/supabase'
import type { Ticket, TicketStatus } from '../lib/supabase'

interface KanbanBoardProps { user: string; onLogout: () => void }

const COLUMNS: { id: TicketStatus; label: string; color: string; accent: string }[] = [
  { id: 'backlog',      label: 'Backlog',           color: 'rgba(209,209,213,0.08)', accent: '#D1D1D5' },
  { id: 'in_progress',  label: 'Em Progresso',      color: 'rgba(37,208,102,0.10)',  accent: '#25D066' },
  { id: 'waiting_devs', label: 'Aguardando Devs',   color: 'rgba(245,158,11,0.10)',  accent: '#fbbf24' },
  { id: 'resolved',     label: 'Resolvido',         color: 'rgba(27,173,83,0.10)',   accent: '#1BAD53' },
]

function DroppableColumn({ id, children, isOver }: { id: string; children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef} className={clsx('flex-1 min-h-[4px] rounded-lg transition-all duration-200', isOver && 'ring-1 ring-green-500/30 bg-green-500/[0.04]')}>{children}</div>
}

export default function KanbanBoard({ user, onLogout }: KanbanBoardProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'medium' as Ticket['priority'], status: 'backlog' as TicketStatus })
  const [isConnected, setIsConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [slackSending, setSlackSending] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [wallpaper, setWallpaper] = useState<string>(() => localStorage.getItem('chatpro-wallpaper') || '')
  const [wallpaperInput, setWallpaperInput] = useState('')
  const [addingTo, setAddingTo] = useState<TicketStatus | null>(null)
  const [inlineTitle, setInlineTitle] = useState('')
  const { theme, presetKey, setPreset, setCustomColor, presets } = useTheme()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // --- Load tickets from Supabase ---
  const loadTickets = useCallback(async () => {
    try {
      const data = await fetchTickets()
      setTickets(data)
    } catch (err) {
      console.error('Failed to load tickets:', err)
      showToast('Erro ao carregar tickets', 'err')
    }
  }, [])

  // --- Realtime subscription ---
  useEffect(() => {
    setLoading(true)
    loadTickets().finally(() => setLoading(false))

    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, payload => {
        setTickets(prev => {
          if (prev.some(t => t.id === (payload.new as Ticket).id)) return prev
          return [payload.new as Ticket, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, payload => {
        setTickets(prev => prev.map(t => t.id === (payload.new as Ticket).id ? (payload.new as Ticket) : t))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets' }, payload => {
        setTickets(prev => prev.filter(t => t.id !== (payload.old as any).id))
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => { supabase.removeChannel(channel) }
  }, [loadTickets])

  // --- Presence tracking ---
  useEffect(() => {
    const presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: user } }
    })

    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState()
      setOnlineUsers(Object.keys(state))
    })

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ user, online_at: new Date().toISOString() })
      }
    })

    return () => { supabase.removeChannel(presenceChannel) }
  }, [user])

  // --- Toast helper ---
  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // --- Send to Slack ---
  async function handleSendToSlack(ticket: Ticket) {
    setSlackSending(ticket.id)
    const ok = await sendToSlack(ticket)
    setSlackSending(null)
    showToast(ok ? 'Enviado para o Slack!' : 'Falha ao enviar para o Slack', ok ? 'ok' : 'err')
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const getColumnTickets = useCallback((status: TicketStatus) => tickets.filter(t => t.status === status), [tickets])

  function handleDragStart(event: DragStartEvent) {
    const ticket = tickets.find(t => t.id === event.active.id)
    if (ticket) setActiveTicket(ticket)
  }
  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id as string | undefined
    if (!overId) { setOverColumn(null); return }
    setOverColumn(COLUMNS.some(c => c.id === overId) ? overId : null)
  }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTicket(null); setOverColumn(null)
    if (!over) return
    const targetColumn = COLUMNS.find(c => c.id === over.id)
    const targetStatus = targetColumn?.id ?? tickets.find(t => t.id === over.id)?.status
    if (!targetStatus) return
    const ticket = tickets.find(t => t.id === active.id)
    if (!ticket || ticket.status === targetStatus) return
    const fromLabel = COLUMNS.find(c => c.id === ticket.status)?.label || ticket.status
    const toLabel = COLUMNS.find(c => c.id === targetStatus)?.label || targetStatus
    // Optimistic update
    setTickets(prev => prev.map(t => t.id === active.id ? { ...t, status: targetStatus as TicketStatus } : t))
    // Persist to Supabase
    updateTicket(active.id as string, { status: targetStatus as TicketStatus })
      .then(() => {
        insertActivityLog(active.id as string, user, `moveu este cartão de ${fromLabel} para ${toLabel}`)
      })
      .catch(() => {
        showToast('Erro ao mover ticket', 'err')
        loadTickets() // rollback
      })
  }

  const handleAddTicket = async () => {
    if (!newTicket.title.trim()) return
    try {
      const created = await insertTicket({
        title: newTicket.title.trim(),
        description: newTicket.description || '',
        status: newTicket.status,
        priority: newTicket.priority,
      })
      setTickets(prev => prev.some(t => t.id === created.id) ? prev : [created, ...prev])
      setNewTicket({ title: '', description: '', priority: 'medium', status: 'backlog' })
      setShowAddModal(false)
      showToast('Ticket criado!', 'ok')
    } catch (err: any) {
      console.error('Failed to add ticket:', err)
      showToast(err?.message || 'Erro ao criar ticket. Verifique se está logado.', 'err')
    }
  }

  const handleInlineAdd = async (col: TicketStatus) => {
    if (!inlineTitle.trim()) return
    try {
      const created = await insertTicket({ title: inlineTitle.trim(), description: '', status: col, priority: 'medium' })
      setTickets(prev => prev.some(t => t.id === created.id) ? prev : [created, ...prev])
      setInlineTitle('')
      setAddingTo(null)
    } catch (err: any) {
      showToast(err?.message || 'Erro ao criar ticket', 'err')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadTickets()
    setRefreshing(false)
  }

  const staleCount = tickets.filter(t => Date.now() - new Date(t.updated_at).getTime() > 2 * 60 * 60 * 1000 && t.status !== 'resolved').length

  const handleCardClick = (ticket: Ticket) => {
    setSelectedTicket(ticket)
  }

  const handleTicketUpdate = (updated: Ticket) => {
    setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelectedTicket(updated)
  }

  const handleTicketDelete = (id: string) => {
    setTickets(prev => prev.filter(t => t.id !== id))
    setSelectedTicket(null)
  }

  const applyWallpaper = (url: string) => {
    setWallpaper(url)
    localStorage.setItem('chatpro-wallpaper', url)
  }

  const WALLPAPER_PRESETS = [
    { label: 'Ondas', value: 'linear-gradient(135deg, #0c0c1d 0%, #111a2e 30%, #0a1628 60%, #0d0d1a 100%)' },
    { label: 'Aurora', value: 'linear-gradient(135deg, #0d1117 0%, #161b22 25%, #0d4429 50%, #161b22 75%, #0d1117 100%)' },
    { label: 'Noite', value: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 40%, #16213e 70%, #0a0a0f 100%)' },
    { label: 'Sunset', value: 'linear-gradient(135deg, #1a0a1e 0%, #2d1b3d 30%, #1a2a3d 60%, #0a1a2d 100%)' },
    { label: 'Floresta', value: 'linear-gradient(135deg, #0a1a0a 0%, #1a2e1a 30%, #0d2818 60%, #0a150a 100%)' },
    { label: 'Oceano', value: 'linear-gradient(180deg, #0a0a1a 0%, #0d1a2e 30%, #0a2a3d 50%, #0d1a2e 70%, #0a0a1a 100%)' },
  ]

  const boardBgStyle: React.CSSProperties = wallpaper
    ? (wallpaper.startsWith('http') || wallpaper.startsWith('data:')
        ? { backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }
        : { background: wallpaper })
    : {}

  return (
    <div className={clsx(!wallpaper && 'mesh-bg')} style={{ ...boardBgStyle, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xl"
            style={{ background: toast.type === 'ok' ? '#25D066' : '#ef4444', color: '#fff' }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <header className="sticky top-0 z-40 px-6 py-3 flex items-center justify-between" style={{ background: theme.bgPrimary + 'e6', backdropFilter: 'blur(16px)', borderBottom: '1px solid ' + theme.borderSubtle }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#25D066' }}>
            <LayoutGrid size={16} className="text-white" />
          </div>
          <h1 className="text-xl" style={{ fontFamily: "'Paytone One', sans-serif", color: theme.textPrimary }}>Suporte chatPro</h1>
          {staleCount > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />{staleCount} sem resposta +2h
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Online Users */}
          {onlineUsers.length > 0 && (
            <div className="flex items-center gap-1 mr-2">
              <div className="flex -space-x-2">
                {onlineUsers.slice(0, 5).map((u, i) => (
                  <div key={u} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-black/30"
                    style={{ background: ['#25D066', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4'][i % 5], zIndex: 10 - i }}
                    title={u}>
                    {u.charAt(0).toUpperCase()}
                  </div>
                ))}
                {onlineUsers.length > 5 && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-black/30"
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                    +{onlineUsers.length - 5}
                  </div>
                )}
              </div>
              <span className="text-[10px] ml-1 font-medium" style={{ color: 'var(--text-muted)' }}>{onlineUsers.length} online</span>
            </div>
          )}
          <div className={clsx('flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full', isConnected ? 'text-green-400' : 'text-red-400')} style={{ background: isConnected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>{isConnected ? 'Online' : 'Offline'}</span>
          </div>
          <button onClick={handleRefresh} className="p-2 rounded-lg text-slate-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <RefreshCw size={15} className={clsx(refreshing && 'animate-spin')} />
          </button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white" style={{ background: '#25D066' }}>
            <Plus size={15} />Novo Ticket
          </motion.button>
          <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg transition-colors" style={{ background: 'rgba(255,255,255,0.05)', color: theme.textMuted }}>
            <Settings size={15} />
          </button>
          <div className="flex items-center gap-2 ml-2 pl-2" style={{ borderLeft: '1px solid ' + theme.borderSubtle }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#25D066' }}>
              {user.charAt(0).toUpperCase()}
            </div>
            <button onClick={onLogout} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors"><LogOut size={14} /></button>
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="flex-1 p-6 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm">Carregando tickets...</span>
          </div>
        ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 min-w-max pb-4">
            {COLUMNS.map(col => {
              const colTickets = getColumnTickets(col.id)
              return (
                <motion.div key={col.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: COLUMNS.indexOf(col) * 0.06 }}
                  className="trello-col">
                  {/* Column header */}
                  <div className="trello-col__head">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.accent, boxShadow: `0 0 6px ${col.accent}44` }} />
                    <span className="flex-1 truncate">{col.label}</span>
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${col.accent}15`, color: col.accent }}>{colTickets.length}</span>
                  </div>

                  {/* Cards area */}
                  <DroppableColumn id={col.id} isOver={overColumn === col.id}>
                    <div className="trello-col__cards">
                      <SortableContext items={colTickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        <AnimatePresence>
                          {colTickets.map(ticket => <Card key={ticket.id} ticket={ticket} onSendToSlack={handleSendToSlack} slackSending={slackSending === ticket.id} onCardClick={handleCardClick} />)}
                        </AnimatePresence>
                      </SortableContext>
                    </div>
                  </DroppableColumn>

                  {/* Inline add card (Trello-style) */}
                  {addingTo === col.id ? (
                    <div className="px-1.5 pt-1.5 pb-1">
                      <textarea
                        autoFocus
                        value={inlineTitle}
                        onChange={e => setInlineTitle(e.target.value)}
                        placeholder="Insira um título para este cartão..."
                        rows={3}
                        className="w-full rounded-lg p-2.5 text-sm resize-none outline-none"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInlineAdd(col.id) }
                          if (e.key === 'Escape') { setAddingTo(null); setInlineTitle('') }
                        }}
                      />
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <button onClick={() => handleInlineAdd(col.id)} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: '#25D066' }}>Adicionar</button>
                        <button onClick={() => { setAddingTo(null); setInlineTitle('') }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingTo(col.id); setInlineTitle('') }} className="trello-col__add">
                      <Plus size={16} /> Adicionar um cartão
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>
          <DragOverlay>{activeTicket && <Card ticket={activeTicket} isDragging />}</DragOverlay>
        </DndContext>
        )}
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }} className="glass-card rounded-2xl p-6 w-full max-w-md">
              <h2 className="font-bold text-lg text-white mb-4">Novo Ticket</h2>
              <div className="space-y-3">
                <input autoFocus placeholder="Título do ticket..." value={newTicket.title} onChange={e => setNewTicket(p => ({ ...p, title: e.target.value }))} className="dark-input w-full rounded-lg px-4 py-3 text-sm" />
                <textarea placeholder="Descrição (opcional)..." value={newTicket.description} onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))} rows={3} className="dark-input w-full rounded-lg px-4 py-3 text-sm resize-none" />
                <div className="flex gap-3">
                  <select value={newTicket.priority} onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value as Ticket['priority'] }))} className="dark-input flex-1 rounded-lg px-3 py-2.5 text-sm">
                    <option value="low">Prioridade: Baixa</option>
                    <option value="medium">Prioridade: Média</option>
                    <option value="high">Prioridade: Alta</option>
                  </select>
                  <select value={newTicket.status} onChange={e => setNewTicket(p => ({ ...p, status: e.target.value as TicketStatus }))} className="dark-input flex-1 rounded-lg px-3 py-2.5 text-sm">
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancelar</button>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={handleAddTicket} disabled={!newTicket.title.trim()} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-40" style={{ background: '#25D066' }}>Criar Ticket</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={e => e.target === e.currentTarget && setShowSettings(false)}>
            <motion.div initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-80 h-full overflow-y-auto p-6" style={{ background: theme.bgSecondary, borderLeft: '1px solid ' + theme.borderSubtle }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-lg" style={{ color: theme.textPrimary, fontFamily: "'Space Grotesk', sans-serif" }}>Aparência</h2>
                <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: theme.textMuted }}>
                  <X size={16} />
                </button>
              </div>

              {/* Presets */}
              <div className="mb-6">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: theme.textMuted }}>Tema</label>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map(p => (
                    <button key={p.key} onClick={() => setPreset(p.key)}
                      className="px-3 py-2.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: presetKey === p.key ? 'rgba(37,208,102,0.12)' : 'rgba(255,255,255,0.04)',
                        border: presetKey === p.key ? '1px solid rgba(37,208,102,0.3)' : '1px solid ' + theme.borderSubtle,
                        color: presetKey === p.key ? '#25D066' : theme.textSecondary,
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Colors */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: theme.textMuted }}>Cores personalizadas</label>
                <div className="space-y-3">
                  {([
                    { key: 'bgPrimary' as keyof ThemeConfig, label: 'Fundo principal' },
                    { key: 'bgSecondary' as keyof ThemeConfig, label: 'Fundo secundário' },
                    { key: 'bgCard' as keyof ThemeConfig, label: 'Fundo dos cards' },
                    { key: 'accent' as keyof ThemeConfig, label: 'Cor de destaque' },
                    { key: 'textPrimary' as keyof ThemeConfig, label: 'Texto principal' },
                    { key: 'textMuted' as keyof ThemeConfig, label: 'Texto secundário' },
                  ]).map(item => (
                    <div key={item.key} className="flex items-center justify-between gap-3">
                      <span className="text-xs" style={{ color: theme.textSecondary }}>{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono" style={{ color: theme.textMuted }}>{theme[item.key]}</span>
                        <input type="color" value={theme[item.key].startsWith('rgba') ? '#888888' : theme[item.key]}
                          onChange={e => setCustomColor(item.key, e.target.value)}
                          className="w-7 h-7 rounded cursor-pointer border-0" style={{ background: 'none' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reset */}
              <button onClick={() => setPreset('dark')} className="mt-6 w-full py-2.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid ' + theme.borderSubtle, color: theme.textMuted }}>
                Restaurar padrão
              </button>

              {/* Wallpaper */}
              <div className="mt-6">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: theme.textMuted }}>Papel de Parede</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {WALLPAPER_PRESETS.map(wp => (
                    <button key={wp.label} onClick={() => applyWallpaper(wp.value)}
                      className="h-14 rounded-lg text-[10px] font-semibold transition-all flex items-end justify-center pb-1.5"
                      style={{
                        background: wp.value,
                        border: wallpaper === wp.value ? '2px solid #25D066' : '1px solid ' + theme.borderSubtle,
                        color: '#fff',
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      }}>
                      {wp.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    placeholder="URL da imagem..."
                    value={wallpaperInput}
                    onChange={e => setWallpaperInput(e.target.value)}
                    className="dark-input flex-1 rounded-lg px-3 py-2 text-xs"
                  />
                  <button onClick={() => { if (wallpaperInput.trim()) { applyWallpaper(wallpaperInput.trim()); setWallpaperInput('') } }}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#25D066' }}>
                    <Image size={14} />
                  </button>
                </div>
                {wallpaper && (
                  <button onClick={() => applyWallpaper('')} className="mt-2 w-full py-2 rounded-lg text-xs font-semibold transition-colors text-red-400 hover:bg-red-500/10"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Remover fundo
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Detail Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <CardDetailModal
            ticket={selectedTicket}
            user={user}
            onClose={() => setSelectedTicket(null)}
            onUpdate={handleTicketUpdate}
            onDelete={handleTicketDelete}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
