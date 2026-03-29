import { useState, useCallback, useEffect, useRef } from 'react'
import { DndContext, DragOverlay, closestCenter, closestCorners, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors, type CollisionDetection, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LogOut, RefreshCw, LayoutGrid, Settings, X, Loader2, Image, Search, Share2, Plug, Trash2 } from 'lucide-react'
import { useTheme, type ThemeConfig } from '../lib/theme'
import { clsx } from 'clsx'
import Card from './Card'
import CardDetailModal from './CardDetailModal'
import InstanceModal from './InstanceModal'
import { supabase, fetchTickets, insertTicket, updateTicket, insertActivityLog } from '../lib/supabase'
import { useKanban, COLUMNS } from '../hooks/useKanban'
import type { Ticket, TicketStatus } from '../lib/supabase'

interface KanbanBoardProps { user: string; onLogout: () => void }

const COLUMNS_LEGACY: { id: TicketStatus; label: string; color: string; accent: string }[] = COLUMNS

function DroppableColumn({ id, children, isOver }: { id: string; children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef} className={clsx('flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-lg transition-all duration-200', isOver && 'ring-1 ring-blue-500/30 bg-blue-500/[0.04]')}>{children}</div>
}

function SortableBoardColumn({ id, children }: { id: string; children: (drag: { attributes: Record<string, any>; listeners: Record<string, any>; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: 'column', columnId: id } })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={clsx('trello-col group', isDragging && 'trello-col--drag')}>
      {children({ attributes, listeners, isDragging })}
    </div>
  )
}

export default function KanbanBoard({ user, onLogout }: KanbanBoardProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)
  const [overCardId, setOverCardId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'medium' as Ticket['priority'], status: 'backlog' as TicketStatus, cliente: '', instancia: '' })
  const [isConnected, setIsConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [showOnlineUsers, setShowOnlineUsers] = useState(false)
  const [wallpaper, setWallpaper] = useState<string>('')
  const [wallpaperInput, setWallpaperInput] = useState('')
  const [addingTo, setAddingTo] = useState<TicketStatus | null>(null)
  const [inlineTitle, setInlineTitle] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showInstanceModal, setShowInstanceModal] = useState(false)
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [customColumns, setCustomColumns] = useState<{ id: string; label: string; accent: string }[]>([])
  const [columnOrder, setColumnOrder] = useState<string[]>(() => COLUMNS.map(c => c.id))
  const { theme, presetKey, setPreset, setCustomColor, presets } = useTheme()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const wallpaperFileInputRef = useRef<HTMLInputElement | null>(null)

  const wallpaperStorageKey = `chatpro-wallpaper:${user.toLowerCase()}`

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
          return [...prev, payload.new as Ticket]
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const getColumnTickets = useCallback((status: string) => {
    let filtered = tickets.filter(t => t.status === status)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)))
    }
    return filtered
  }, [tickets, searchQuery])

  useEffect(() => {
    const nextIds = [
      ...COLUMNS.map(c => c.id),
      ...customColumns.map(c => c.id),
    ]
    setColumnOrder(prev => {
      const kept = prev.filter(id => nextIds.includes(id))
      const missing = nextIds.filter(id => !kept.includes(id))
      return [...kept, ...missing]
    })
  }, [customColumns])

  useEffect(() => {
    const saved = localStorage.getItem(wallpaperStorageKey) || ''
    setWallpaper(saved)
  }, [wallpaperStorageKey])

  const allColumnsById = new Map(
    [...COLUMNS, ...customColumns.map(c => ({ ...c, color: 'rgba(255,255,255,0.05)' }))]
      .map(col => [col.id, col])
  )
  const allColumns = columnOrder
    .map(id => allColumnsById.get(id))
    .filter((col): col is NonNullable<typeof col> => Boolean(col))
  const columnIds = allColumns.map(col => col.id)

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const dragType = args.active.data.current?.type

    if (dragType === 'column') {
      const columnContainers = args.droppableContainers.filter(container => columnIds.includes(String(container.id)))
      return closestCenter({ ...args, droppableContainers: columnContainers })
    }

    const pointerIntersections = pointerWithin(args)
    if (pointerIntersections.length > 0) return pointerIntersections
    return closestCorners(args)
  }

  const handleDragCancel = () => {
    setActiveColumnId(null)
    setActiveTicket(null)
    setOverColumn(null)
    setOverCardId(null)
  }

  function handleDragStart(event: DragStartEvent) {
    const dragType = event.active.data.current?.type
    if (dragType === 'column') {
      setActiveColumnId(String(event.active.id))
      return
    }

    const ticket = tickets.find(t => t.id === event.active.id)
    if (ticket) setActiveTicket(ticket)
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.active.data.current?.type === 'column') return

    const overId = event.over?.id as string | undefined
    if (!overId) { setOverColumn(null); setOverCardId(null); return }

    if (allColumnsById.has(overId)) {
      setOverColumn(overId)
      setOverCardId(null)
      return
    }

    const overTicket = tickets.find(t => t.id === overId)
    setOverColumn(overTicket?.status ?? null)
    setOverCardId(overId)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (active.data.current?.type === 'column') {
      setActiveColumnId(null)
      if (!over || active.id === over.id) return

      const activeColumnId = String(active.id)
      const overId = String(over.id)
      const overColumnId = allColumnsById.has(overId)
        ? overId
        : tickets.find(t => t.id === overId)?.status

      if (!overColumnId || activeColumnId === overColumnId) return

      const oldIndex = columnOrder.indexOf(activeColumnId)
      const newIndex = columnOrder.indexOf(overColumnId)
      if (oldIndex < 0 || newIndex < 0) return

      setColumnOrder(prev => arrayMove(prev, oldIndex, newIndex))
      return
    }

    setActiveTicket(null)
    setOverColumn(null)
    setOverCardId(null)
    if (!over) return

    const overId = String(over.id)
    const targetStatus = allColumnsById.has(overId)
      ? overId
      : tickets.find(t => t.id === overId)?.status

    if (!targetStatus) return
    const ticket = tickets.find(t => t.id === active.id)
    if (!ticket || ticket.status === targetStatus) return

    const fromLabel = COLUMNS.find(c => c.id === ticket.status)?.label || ticket.status
    const toLabel = COLUMNS.find(c => c.id === targetStatus)?.label || targetStatus

    // Optimistic update with ordering preservation.
    setTickets(prev => {
      const activeId = String(active.id)
      const activeIndex = prev.findIndex(t => t.id === activeId)
      if (activeIndex < 0) return prev

      const next = [...prev]
      const current = next[activeIndex]
      next[activeIndex] = { ...current, status: targetStatus as TicketStatus }

      const overIndex = next.findIndex(t => t.id === overId)

      if (overIndex >= 0) {
        return arrayMove(next, activeIndex, overIndex)
      }

      const withoutActive = next.filter(t => t.id !== activeId)
      const lastInTarget = withoutActive.reduce((idx, t, i) => (t.status === targetStatus ? i : idx), -1)
      const insertAt = lastInTarget >= 0 ? lastInTarget + 1 : withoutActive.length
      withoutActive.splice(insertAt, 0, next[activeIndex])
      return withoutActive
    })

    const canPersistStatus = COLUMNS.some(c => c.id === targetStatus)
    if (!canPersistStatus) {
      insertActivityLog(active.id as string, user, `moveu este cartão de ${fromLabel} para ${toLabel}`)
      return
    }

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
        cliente: newTicket.cliente || '',
        instancia: newTicket.instancia || '',
        assignee: user,
      })
      setTickets(prev => prev.some(t => t.id === created.id) ? prev : [...prev, created])
      setNewTicket({ title: '', description: '', priority: 'medium', status: 'backlog', cliente: '', instancia: '' })
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
      const created = await insertTicket({ title: inlineTitle.trim(), description: '', status: col, priority: 'medium', assignee: user })
      setTickets(prev => prev.some(t => t.id === created.id) ? prev : [...prev, created])
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
  const visibleUsers = onlineUsers.length > 0 ? onlineUsers : [user]

  const handleCardClick = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket)
  }, [])

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
    try {
      localStorage.setItem(wallpaperStorageKey, url)
    } catch {
      showToast('Sem espaço local para salvar este fundo', 'err')
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
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('load_image_error'))
    }
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
      showToast('Selecione um arquivo de imagem válido', 'err')
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
      showToast(needsCompression ? 'Fundo importado e comprimido com sucesso' : 'Fundo atualizado com imagem local', 'ok')
    } catch {
      showToast('Erro ao importar imagem', 'err')
    }

    event.target.value = ''
  }

  const WALLPAPER_PRESETS = [
    { label: 'Oceano', value: 'linear-gradient(135deg, #1a3a5c 0%, #0d2137 50%, #1e4976 100%)' },
    { label: 'Grafite', value: 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 50%, #333 100%)' },
    { label: 'Floresta', value: '#1d5c3a' },
    { label: 'Vinho', value: '#6b1f2a' },
  ]

  const boardWrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    background: '#1d2125',
  }

  const boardSurfaceStyle: React.CSSProperties = wallpaper
    ? (wallpaper.startsWith('http') || wallpaper.startsWith('data:')
        ? { backgroundImage: `url(${wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : wallpaper.startsWith('#') || wallpaper.startsWith('rgb') || wallpaper.startsWith('hsl')
            ? { backgroundColor: wallpaper }
            : { background: wallpaper })
    : { background: 'linear-gradient(135deg, #0c1317, #1a2a35)' }

  return (
    <div className="board-wrapper" style={boardWrapperStyle}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xl"
            style={{ background: toast.type === 'ok' ? '#579dff' : '#ef5c48', color: '#fff' }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <header className="board-header">
        <div className="trello-board-header__left">
          <div className="trello-board-header__badge" aria-hidden>
            <LayoutGrid size={16} style={{ color: 'rgba(255,255,255,0.8)' }} />
          </div>

          <button className="trello-board-chip trello-board-chip--title" type="button">
            <span className="trello-board-chip__title">Suporte chatPro</span>
          </button>

          <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

          <button
            onClick={() => setShowInstanceModal(true)}
            className="trello-board-chip"
            type="button"
          >
            <Plug size={14} />
            Instancia
          </button>

          {staleCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="trello-alert-chip"
            >
              <span className="trello-alert-chip__dot" />
              {staleCount} sem resposta +2h
            </motion.div>
          )}
        </div>

        <div className="trello-board-header__center">
          <div className="header-search">
            <Search size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Pesquisar"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm flex-1"
              style={{ color: '#B6C2CF' }}
            />
          </div>
        </div>

        <div className="trello-board-header__right">
          <div className={clsx('trello-board-status', isConnected ? 'trello-board-status--ok' : 'trello-board-status--off')} title={isConnected ? 'Conectado ao realtime' : 'Sem conexao'}>
            <span className="trello-board-status__dot" />
          </div>

          <button onClick={handleRefresh} className="trello-icon-btn" type="button" title="Atualizar tickets">
            <RefreshCw size={16} className={clsx(refreshing && 'animate-spin')} />
          </button>

          <button
            className="trello-icon-btn"
            type="button"
            title="Compartilhar"
            onClick={() => { navigator.clipboard.writeText(window.location.href); showToast('Link copiado!', 'ok') }}
          >
            <Share2 size={16} />
          </button>

          <button onClick={() => setShowSettings(true)} className="trello-icon-btn" type="button" title="Configuracoes">
            <Settings size={16} />
          </button>

          <button onClick={() => setShowAddModal(true)} className="trello-create-btn" type="button">
            Criar
          </button>

          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowOnlineUsers(true)}
            onMouseLeave={() => setShowOnlineUsers(false)}
          >
            <div className="flex -space-x-1.5 cursor-default">
              {visibleUsers.slice(0, 5).map((u, i) => (
                <div key={u} className="relative" style={{ zIndex: 10 - i }}>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: ['#579DFF', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4'][i % 5], border: '2px solid #1D2125' }}
                    title={u}
                  >
                    {u.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ background: '#4BCE97', borderColor: '#1D2125' }} />
                </div>
              ))}
              {visibleUsers.length > 5 && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: '#22272B', color: '#9FADBC', border: '2px solid #1D2125' }}
                >
                  +{visibleUsers.length - 5}
                </div>
              )}
            </div>

            <AnimatePresence>
              {showOnlineUsers && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-[120%] z-50 min-w-[220px] rounded-lg p-2"
                  style={{ background: '#282E33', border: '1px solid rgba(166,197,226,0.12)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide px-1 pb-1" style={{ color: '#9FADBC' }}>
                    Usuarios online ({visibleUsers.length})
                  </div>
                  <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                    {visibleUsers.map((u, i) => (
                      <div key={`${u}-${i}`} className="flex items-center gap-2 px-1.5 py-1 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: '#4BCE97' }} />
                        <span className="text-xs truncate" style={{ color: '#B6C2CF' }} title={u}>{u}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={onLogout} className="trello-icon-btn trello-icon-btn--danger" type="button" title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Board */}
      <main className="board-main" style={boardSurfaceStyle}>
        <div className="board-main__scroller">
        {loading ? (
          <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm">Carregando tickets...</span>
          </div>
        ) : (
        <DndContext sensors={sensors} collisionDetection={collisionDetectionStrategy} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <div className="board-columns">
            <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
              {allColumns.map((col, colIdx) => {
                const colTickets = getColumnTickets(col.id)
                return (
                  <div key={col.id}>
                    <SortableBoardColumn id={col.id}>
                      {({ attributes, listeners }) => (
                        <>
                          {/* Column header (drag handle) */}
                          <div className="trello-col__head cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.accent, boxShadow: `0 0 6px ${col.accent}44` }} />
                            <span className="flex-1 truncate">{col.label}</span>
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${col.accent}15`, color: col.accent }}>{colTickets.length}</span>
                            <button
                              onClick={(event) => {
                                event.stopPropagation()
                                if (colTickets.length > 0 && !confirm(`A lista "${col.label}" tem ${colTickets.length} cartão(s). Excluir mesmo assim?`)) return
                                if (colTickets.length === 0 && !confirm(`Excluir a lista "${col.label}"?`)) return
                                if (customColumns.some(cc => cc.id === col.id)) {
                                  setCustomColumns(prev => prev.filter(cc => cc.id !== col.id))
                                }
                                setTickets(prev => prev.filter(t => t.status !== col.id))
                                showToast('Lista excluída', 'ok')
                              }}
                              className="p-1 rounded hover:bg-red-500/20 transition-colors ml-1 opacity-0 group-hover:opacity-100"
                              title="Excluir lista"
                            >
                              <Trash2 size={12} className="text-red-400" />
                            </button>
                          </div>

                          {/* Cards area */}
                          <DroppableColumn id={col.id} isOver={overColumn === col.id}>
                            <div className="trello-col__cards">
                              <SortableContext items={colTickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                  {colTickets.map(ticket => (
                                    <div key={ticket.id}>
                                      {activeTicket && overCardId === ticket.id && activeTicket.id !== ticket.id && (
                                        <div className="dnd-drop-indicator" />
                                      )}
                                      <Card ticket={ticket} onCardClick={handleCardClick} />
                                    </div>
                                  ))}
                              </SortableContext>
                            </div>
                          </DroppableColumn>

                          {/* Inline add card — FIXED footer */}
                          <div className="trello-col__footer">
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
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInlineAdd(col.id as TicketStatus) }
                                  if (e.key === 'Escape') { setAddingTo(null); setInlineTitle('') }
                                }}
                              />
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <button onClick={() => handleInlineAdd(col.id as TicketStatus)} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: '#579dff' }}>Adicionar</button>
                                <button onClick={() => { setAddingTo(null); setInlineTitle('') }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setAddingTo(col.id as TicketStatus); setInlineTitle('') }} className="trello-col__add">
                              <Plus size={16} /> Adicionar um cartão
                            </button>
                          )}
                          </div>
                        </>
                      )}
                    </SortableBoardColumn>
                  </div>
                )
              })}
            </SortableContext>
            {/* Add another list */}
            {addingList ? (
              <div className="add-list-form">
                <input
                  autoFocus
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  placeholder="Nome da lista..."
                  className="instance-modal__input text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newListName.trim()) {
                      const id = newListName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                      const accent = ['#579dff', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'][customColumns.length % 5]
                      setCustomColumns(prev => [...prev, { id: `custom_${id}_${Date.now()}`, label: newListName.trim(), accent }])
                      setNewListName('')
                      setAddingList(false)
                      showToast('Lista adicionada!', 'ok')
                    }
                    if (e.key === 'Escape') { setAddingList(false); setNewListName('') }
                  }}
                />
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    onClick={() => {
                      if (!newListName.trim()) return
                      const id = newListName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                      const accent = ['#579dff', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'][customColumns.length % 5]
                      setCustomColumns(prev => [...prev, { id: `custom_${id}_${Date.now()}`, label: newListName.trim(), accent }])
                      setNewListName('')
                      setAddingList(false)
                      showToast('Lista adicionada!', 'ok')
                    }}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
                    style={{ background: '#579dff' }}
                  >Adicionar lista</button>
                  <button onClick={() => { setAddingList(false); setNewListName('') }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
                </div>
              </div>
            ) : (
              <div className="add-list-ghost" onClick={() => setAddingList(true)}>
                <Plus size={16} />
                <span>Adicionar outra lista</span>
              </div>
            )}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeColumnId && allColumnsById.get(activeColumnId) && (
              <div className="trello-col trello-col--drag" style={{ transform: 'rotate(2deg)', opacity: 0.88 }}>
                <div className="trello-col__head">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: allColumnsById.get(activeColumnId)?.accent }} />
                  <span className="flex-1 truncate">{allColumnsById.get(activeColumnId)?.label}</span>
                </div>
              </div>
            )}
            {activeTicket && (
              <div style={{ transform: 'rotate(5deg)', opacity: 0.92 }}>
                <Card ticket={activeTicket} isDragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
        )}
        </div>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="glass-card rounded-2xl w-full max-w-md overflow-hidden"
            >
              {/* Modal header */}
              <div className="px-6 pt-5 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)', background: '#1d2125' }}>
                <h2 className="font-bold text-lg text-white">Novo Ticket</h2>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"><X size={16} /></button>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto modal-scroll">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9fadbc' }}>Título *</label>
                  <input autoFocus placeholder="Título do ticket..." value={newTicket.title} onChange={e => setNewTicket(p => ({ ...p, title: e.target.value }))} className="instance-modal__input" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9fadbc' }}>Cliente</label>
                    <input placeholder="Nome do cliente..." value={newTicket.cliente} onChange={e => setNewTicket(p => ({ ...p, cliente: e.target.value }))} className="instance-modal__input" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9fadbc' }}>Código da Instância</label>
                    <input placeholder="Ex: inst-001..." value={newTicket.instancia} onChange={e => setNewTicket(p => ({ ...p, instancia: e.target.value }))} className="instance-modal__input" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9fadbc' }}>Prioridade</label>
                    <select value={newTicket.priority} onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value as Ticket['priority'] }))} className="instance-modal__input">
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9fadbc' }}>Coluna</label>
                    <select value={newTicket.status} onChange={e => setNewTicket(p => ({ ...p, status: e.target.value as TicketStatus }))} className="instance-modal__input">
                      {allColumns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9fadbc' }}>Descrição</label>
                  <textarea placeholder="Descreva o problema em detalhes..." value={newTicket.description} onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))} rows={3} className="instance-modal__input resize-none" />
                </div>
              </div>

              {/* Modal footer */}
              <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--border-subtle)', background: '#1d2125' }}>
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancelar</button>
                <button onClick={handleAddTicket} disabled={!newTicket.title.trim()} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-40" style={{ background: '#579dff' }}>
                  <Plus size={15} className="inline mr-1" />Criar Ticket
                </button>
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
                <h2 className="font-bold text-lg" style={{ color: theme.textPrimary }}>Aparência</h2>
                <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: theme.textMuted }}>
                  <X size={16} />
                </button>
              </div>

              {/* Board background */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: theme.textMuted }}>Fundo do Quadro</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {WALLPAPER_PRESETS.map(wp => (
                    <button key={wp.label} onClick={() => applyWallpaper(wp.value)}
                      className="h-[72px] rounded-[10px] text-[12px] font-semibold transition-all flex items-end justify-center pb-2 hover:scale-[1.03]"
                      style={{
                        background: wp.value,
                        border: wallpaper === wp.value ? '2px solid #4CAF50' : '1px solid ' + theme.borderSubtle,
                        color: '#fff',
                        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                      }}>
                      {wp.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="color"
                    value={wallpaper.startsWith('#') ? wallpaper : '#0f3b73'}
                    onChange={(e) => applyWallpaper(e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer border-0"
                    style={{ background: 'none' }}
                    title="Cor sólida do quadro"
                  />
                  <span className="text-[11px]" style={{ color: theme.textMuted }}>Escolher cor sólida</span>
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    placeholder="URL da imagem do quadro..."
                    value={wallpaperInput}
                    onChange={e => setWallpaperInput(e.target.value)}
                    className="dark-input flex-1 rounded-lg px-3 py-2 text-xs"
                  />
                  <button onClick={() => { if (wallpaperInput.trim()) { applyWallpaper(wallpaperInput.trim()); setWallpaperInput('') } }}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#25D066' }}>
                    <Image size={14} />
                  </button>
                </div>
                <input
                  ref={wallpaperFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleWallpaperFileSelect}
                />
                <button
                  onClick={() => wallpaperFileInputRef.current?.click()}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold transition-colors mb-2"
                  style={{ background: 'rgba(87,157,255,0.10)', border: '1px solid rgba(87,157,255,0.2)', color: '#579dff' }}
                >
                  Importar imagem do computador (quadro)
                </button>
                <button onClick={() => applyWallpaper('')} className="w-full py-2.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>
                  Restaurar padrão
                </button>
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

      {/* Instance Configuration Modal */}
      <InstanceModal open={showInstanceModal} onClose={() => setShowInstanceModal(false)} user={user} />
    </div>
  )
}
