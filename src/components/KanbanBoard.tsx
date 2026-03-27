import { useState, useCallback, useEffect, useRef } from 'react'
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LogOut, RefreshCw, Wifi, WifiOff, LayoutGrid, Settings, X, Loader2 } from 'lucide-react'
import { useTheme, type ThemeConfig } from '../lib/theme'
import { clsx } from 'clsx'
import Card from './Card'
import { supabase, fetchTickets, insertTicket, updateTicket, sendToSlack } from '../lib/supabase'
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
  return <div ref={setNodeRef} className={clsx('flex-1 min-h-[120px] rounded-xl transition-colors duration-200', isOver && 'drag-over-column')}>{children}</div>
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
    // Optimistic update
    setTickets(prev => prev.map(t => t.id === active.id ? { ...t, status: targetStatus as TicketStatus } : t))
    // Persist to Supabase
    updateTicket(active.id as string, { status: targetStatus as TicketStatus }).catch(() => {
      showToast('Erro ao mover ticket', 'err')
      loadTickets() // rollback
    })
  }

  const handleAddTicket = async () => {
    if (!newTicket.title.trim()) return
    try {
      await insertTicket({
        title: newTicket.title,
        description: newTicket.description,
        status: newTicket.status,
        priority: newTicket.priority,
      })
      setNewTicket({ title: '', description: '', priority: 'medium', status: 'backlog' })
      setShowAddModal(false)
    } catch (err) {
      console.error('Failed to add ticket:', err)
      showToast('Erro ao criar ticket', 'err')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadTickets()
    setRefreshing(false)
  }

  const staleCount = tickets.filter(t => Date.now() - new Date(t.updated_at).getTime() > 2 * 60 * 60 * 1000 && t.status !== 'resolved').length

  return (
    <div className="mesh-bg min-h-screen flex flex-col">
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
          <div className="flex gap-4 min-w-max pb-4">
            {COLUMNS.map(col => {
              const colTickets = getColumnTickets(col.id)
              return (
                <motion.div key={col.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: COLUMNS.indexOf(col) * 0.07 }} className="w-72 flex flex-col gap-2">
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl column-glass">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.accent, boxShadow: `0 0 6px ${col.accent}` }} />
                      <h2 className="font-bold text-sm text-slate-200">{col.label}</h2>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: col.color, color: col.accent, border: `1px solid ${col.accent}33` }}>{colTickets.length}</span>
                  </div>
                  <DroppableColumn id={col.id} isOver={overColumn === col.id}>
                    <SortableContext items={colTickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      <div className="flex flex-col gap-2.5 min-h-[80px]">
                        <AnimatePresence>
                          {colTickets.map(ticket => <Card key={ticket.id} ticket={ticket} onSendToSlack={handleSendToSlack} slackSending={slackSending === ticket.id} />)}
                        </AnimatePresence>
                        {colTickets.length === 0 && (
                          <div className="h-20 rounded-xl flex items-center justify-center text-xs text-slate-600" style={{ border: '2px dashed rgba(255,255,255,0.06)' }}>Solte aqui</div>
                        )}
                      </div>
                    </SortableContext>
                  </DroppableColumn>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
