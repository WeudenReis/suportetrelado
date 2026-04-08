import { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react'
import { DndContext, DragOverlay, closestCenter, closestCorners, pointerWithin, PointerSensor, useSensor, useSensors, type CollisionDetection, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LogOut, RefreshCw, Settings, X, Loader2, Search, Share2, Plug, Trash2, Users, Archive, Pencil, ArrowUpDown, Palette, ChevronLeft, Clock, LayoutGrid, List, ChevronRight, AlignLeft, Paperclip, CheckSquare, Calendar, Check, Filter, Keyboard, Minimize2, Maximize2 } from 'lucide-react'
import { clsx } from 'clsx'
import Card from './Card'
import CardDetailModal, { parseTag } from './CardDetailModal'
import ErrorBoundary from './ErrorBoundary'
import InstanceModal from './InstanceModal'
import { ArchivedPanel } from './ArchivedPanel'
import { supabase, fetchTickets, fetchAttachmentCounts, insertTicket, updateTicket, insertActivityLog, fetchUserProfiles, isDevEnvironment, fetchBoardLabels } from '../lib/supabase'
import { fetchBoardColumns, insertBoardColumn, updateBoardColumn, archiveBoardColumn, BoardColumn } from '../lib/boardColumns'
import { COLUMNS } from '../hooks/useKanban'
import { useKeyboardShortcuts, useShortcutsHelp } from '../hooks/useKeyboardShortcuts'
import type { Ticket, TicketStatus, UserProfile, BoardLabel } from '../lib/supabase'
import ShortcutsHelpModal from './kanban/ShortcutsHelpModal'
import BulkActionsBar from './kanban/BulkActionsBar'
import AutoRulesModal, { loadAutoRules } from './kanban/AutoRulesModal'
import LabelsManagerModal from './kanban/LabelsManagerModal'
import SettingsPanel from './kanban/SettingsPanel'
import MembersManagerPanel from './kanban/MembersManagerPanel'
import AddTicketModal from './kanban/AddTicketModal'
import FilterPanel from './kanban/FilterPanel'
import { searchTicketsRPC, searchTicketsLocal, debounce } from '../lib/search'
import { useOrg } from '../lib/org'

interface KanbanBoardProps { user: string; onLogout: () => void; openTicketId?: string | null; clearOpenTicketId?: () => void }

function buildFallbackColumns(): BoardColumn[] {
  return COLUMNS.map((c, i) => ({
    id: c.id,
    department_id: '',
    title: c.label,
    position: i,
    dot_color: c.accent,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))
}

function buildLocalColumn(title: string, position: number): BoardColumn {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    department_id: '',
    title: title.trim(),
    position,
    dot_color: '#101204',
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function DroppableColumn({ id, children, isOver }: { id: string; children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef} className={clsx('flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-lg transition-all duration-200', isOver && 'ring-1 ring-blue-500/30 bg-blue-500/[0.04]')}>{children}</div>
}

function SortableCardInner({ ticket, onClick, onUpdate, onArchive, onShowToast, isOverCard, activeTicket, compact, bulkMode, isSelected, onBulkToggle, isMutating }: {
  ticket: Ticket
  onClick: (ticket: Ticket) => void
  onUpdate: (u: Ticket) => void
  onArchive: (id: string) => void
  onShowToast?: (msg: string, type: 'ok' | 'err') => void
  isOverCard: boolean
  activeTicket: Ticket | null
  compact?: boolean
  bulkMode?: boolean
  isSelected?: boolean
  onBulkToggle?: (id: string) => void
  isMutating?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    data: { type: 'card', ticket },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const handleClick = useCallback(() => {
    if (bulkMode && onBulkToggle) {
      onBulkToggle(ticket.id)
    } else {
      onClick(ticket)
    }
  }, [onClick, ticket, bulkMode, onBulkToggle])

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{
      ...style,
      ...(bulkMode && isSelected ? { outline: '2px solid #25D066', outlineOffset: -2, borderRadius: 10 } : {}),
    }}>
      {activeTicket && isOverCard && activeTicket.id !== ticket.id && (
        <div className="dnd-drop-indicator" />
      )}
      <Card
        card={ticket}
        onClick={handleClick}
        onUpdate={onUpdate}
        onArchive={onArchive}
        onShowToast={onShowToast}
        isDragging={isDragging}
        compact={compact}
        isMutating={isMutating}
      />
    </div>
  )
}

const SortableCard = memo(SortableCardInner)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SortableBoardColumn({ id, accentColor, children }: { id: string; accentColor?: string; children: (drag: { attributes: any; listeners: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: 'column', columnId: id } })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(accentColor ? { '--col-accent': accentColor } as React.CSSProperties : {}),
  }

  return (
    <div ref={setNodeRef} style={style} className={clsx('trello-col group', isDragging && 'trello-col--drag')}>
      {children({ attributes, listeners, isDragging })}
    </div>
  )
}

// Templates, AutoRules e Labels foram extraídos para ./kanban/

export default function KanbanBoard({ user, onLogout, openTicketId, clearOpenTicketId }: KanbanBoardProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)
  const [overCardId, setOverCardId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set())
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [showMembersPanel, setShowMembersPanel] = useState(false)
  const [allMembers, setAllMembers] = useState<UserProfile[]>([])
  const [wallpaper, setWallpaper] = useState<string>('')
  const [wallpaperInput, setWallpaperInput] = useState('')
  const [recentWallpapers, setRecentWallpapers] = useState<string[]>([])
  const [addingTo, setAddingTo] = useState<TicketStatus | null>(null)
  const [inlineTitle, setInlineTitle] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showInstanceModal, setShowInstanceModal] = useState(false)
  const [showArchivedPanel, setShowArchivedPanel] = useState(false)
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingColumnTitle, setEditingColumnTitle] = useState('')
  const [colorPickerColumnId, setColorPickerColumnId] = useState<string | null>(null)
  const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [colMenuView, setColMenuView] = useState<'main' | 'color' | 'sort'>('main')
  const [boardLabels, setBoardLabels] = useState<BoardLabel[]>([])
  const [showLabelsManager, setShowLabelsManager] = useState(false)
  // Label editing state moved to LabelsManagerModal
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => (localStorage.getItem('chatpro-view-mode') as 'kanban' | 'list') || 'kanban')
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set())
  const [compactMode, setCompactMode] = useState<boolean>(() => localStorage.getItem('chatpro-compact-mode') === 'true')
  const [showFilters, setShowFilters] = useState(false)
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterLabel, setFilterLabel] = useState<string>('all')
  const [showShortcutsHelp, openShortcutsHelp, closeShortcutsHelp] = useShortcutsHelp()
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())
  const [showAutoRules, setShowAutoRules] = useState(false)
  const [showMembersManager, setShowMembersManager] = useState(false)
  const { departmentId } = useOrg()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const dragOriginalStatusRef = useRef<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const boardDragRef = useRef({ isDragging: false, startX: 0, scrollLeft: 0 })
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [serverSearchResults, setServerSearchResults] = useState<Ticket[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // Debounced server-side search
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setServerSearchResults(null)
        setSearchLoading(false)
        return
      }
      setSearchLoading(true)
      const results = await searchTicketsRPC(query)
      if (results.length > 0) {
        setServerSearchResults(results)
      } else {
        // RPC retornou vazio ou falhou — fallback client-side
        setServerSearchResults(null)
      }
      setSearchLoading(false)
    }, 350),
    []
  )

  useEffect(() => {
    debouncedSearch(searchQuery)
  }, [searchQuery, debouncedSearch])

  const wallpaperStorageKey = `chatpro-wallpaper:${user.toLowerCase()}`

  // --- Load tickets from Supabase ---
  const loadTickets = useCallback(async () => {
    try {
      const [data, attCounts] = await Promise.all([fetchTickets(), fetchAttachmentCounts()])
      const loaded = data.map(t => ({ ...t, attachment_count: attCounts[t.id] || 0 }))

      // Processar regras automáticas antes de setar os tickets
      const rules = loadAutoRules().filter(r => r.enabled)
      const updates: { id: string; newStatus: string; ruleName: string }[] = []
      if (rules.length > 0) {
        for (const ticket of loaded) {
          if (ticket.is_archived) continue
          for (const rule of rules) {
            if (ticket.status === rule.targetColumn) continue
            let match = false
            switch (rule.condition) {
              case 'priority_high': match = ticket.priority === 'high'; break
              case 'priority_medium': match = ticket.priority === 'medium'; break
              case 'priority_low': match = ticket.priority === 'low'; break
              case 'no_assignee': match = !ticket.assignee; break
              case 'overdue_12h': {
                const hoursIdle = (Date.now() - new Date(ticket.updated_at).getTime()) / 3_600_000
                match = hoursIdle >= 12 && ticket.status !== 'resolved'
                break
              }
              case 'overdue_24h': {
                const hoursIdle = (Date.now() - new Date(ticket.updated_at).getTime()) / 3_600_000
                match = hoursIdle >= 24 && ticket.status !== 'resolved'
                break
              }
            }
            if (match) {
              updates.push({ id: ticket.id, newStatus: rule.targetColumn, ruleName: rule.name })
              break
            }
          }
        }
      }

      // Aplicar as mudanças diretamente no array antes de setar
      const finalTickets = updates.length > 0
        ? loaded.map(t => {
            const upd = updates.find(u => u.id === t.id)
            return upd ? { ...t, status: upd.newStatus as TicketStatus } : t
          })
        : loaded

      setTickets(finalTickets)

      // Persistir no banco
      if (updates.length > 0) {
        for (const upd of updates) {
          updateTicket(upd.id, { status: upd.newStatus as TicketStatus }).catch(console.error)
        }
        showToast(`Regra automática: ${updates.length} ticket(s) movido(s)`, 'ok')
      }
    } catch (err) {
      console.error('Failed to load tickets:', err)
      showToast('Erro ao carregar tickets', 'err')
    }
  }, [])

  // --- Realtime subscription ---
  // Helper: aplica regras automáticas a um ticket individual
  const applyAutoRulesToTicket = useCallback((ticket: Ticket): Ticket => {
    if (ticket.is_archived) return ticket
    const rules = loadAutoRules().filter(r => r.enabled)
    for (const rule of rules) {
      if (ticket.status === rule.targetColumn) continue
      let match = false
      switch (rule.condition) {
        case 'priority_high': match = ticket.priority === 'high'; break
        case 'priority_medium': match = ticket.priority === 'medium'; break
        case 'priority_low': match = ticket.priority === 'low'; break
        case 'no_assignee': match = !ticket.assignee; break
        case 'overdue_12h': {
          const hoursIdle = (Date.now() - new Date(ticket.updated_at).getTime()) / 3_600_000
          match = hoursIdle >= 12 && ticket.status !== 'resolved'
          break
        }
        case 'overdue_24h': {
          const hoursIdle = (Date.now() - new Date(ticket.updated_at).getTime()) / 3_600_000
          match = hoursIdle >= 24 && ticket.status !== 'resolved'
          break
        }
      }
      if (match) {
        updateTicket(ticket.id, { status: rule.targetColumn as TicketStatus }).catch(console.error)
        return { ...ticket, status: rule.targetColumn as TicketStatus }
      }
    }
    return ticket
  }, [])

  useEffect(() => {
    setLoading(true)
    loadTickets().finally(() => setLoading(false))

    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, payload => {
        setTickets(prev => {
          if (prev.some(t => t.id === (payload.new as Ticket).id)) return prev
          const newTicket = applyAutoRulesToTicket({ ...(payload.new as Ticket), attachment_count: 0 } as Ticket)
          return [...prev, newTicket]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, payload => {
        setTickets(prev => prev.map(t => {
          if (t.id !== (payload.new as Ticket).id) return t
          return { ...(payload.new as Ticket), attachment_count: t.attachment_count || 0 }
        }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets' }, payload => {
        setTickets(prev => prev.filter(t => t.id !== (payload.old as Record<string, string>).id))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, () => {
        fetchAttachmentCounts().then(counts => {
          setTickets(prev => prev.map(t => ({ ...t, attachment_count: counts[t.id] || 0 })))
        })
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => { supabase.removeChannel(channel) }
  }, [loadTickets])

  // Open a specific ticket when openTicketId is set (e.g. from Inbox notification)
  useEffect(() => {
    if (!openTicketId || tickets.length === 0) return
    const found = tickets.find(t => t.id === openTicketId)
    if (found) {
      setSelectedTicket(found)
      clearOpenTicketId?.()
    }
  }, [openTicketId, tickets, clearOpenTicketId])

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

  // --- Fetch all members ---
  useEffect(() => {
    fetchUserProfiles().then(setAllMembers)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const ch = supabase
      .channel('user_profiles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          fetchUserProfiles().then(setAllMembers)
        }, 30000)
      })
      .subscribe()
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(ch)
    }
  }, [])

  // --- Toast helper ---
  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const getColumnTickets = useCallback((status: string) => {
    // Se temos resultados server-side, filtrar por coluna
    if (serverSearchResults && searchQuery.trim()) {
      let filtered = serverSearchResults.filter(t => t.status === status)
      if (filterPriority !== 'all') {
        filtered = filtered.filter(t => t.priority === filterPriority)
      }
      if (filterAssignee !== 'all') {
        if (filterAssignee === '__none__') {
          filtered = filtered.filter(t => !t.assignee)
        } else {
          const member = allMembers.find(m => m.email === filterAssignee)
          filtered = filtered.filter(t => {
            if (!t.assignee) return false
            const parts = t.assignee.split(',').map(s => s.trim().toLowerCase())
            const fa = filterAssignee.toLowerCase()
            return parts.some(p => p === fa || (member && (p === member.name.toLowerCase() || p === member.email.toLowerCase())))
          })
        }
      }
      if (filterLabel !== 'all') {
        filtered = filtered.filter(t => t.tags && t.tags.some(tag => tag.includes(filterLabel)))
      }
      return filtered
    }

    // Fallback client-side
    let filtered = tickets.filter(t => t.status === status)
    if (searchQuery.trim()) {
      filtered = searchTicketsLocal(filtered, searchQuery)
    }
    if (filterPriority !== 'all') {
      filtered = filtered.filter(t => t.priority === filterPriority)
    }
    if (filterAssignee !== 'all') {
      if (filterAssignee === '__none__') {
        filtered = filtered.filter(t => !t.assignee)
      } else {
        const member = allMembers.find(m => m.email === filterAssignee)
        filtered = filtered.filter(t => {
          if (!t.assignee) return false
          const parts = t.assignee.split(',').map(s => s.trim().toLowerCase())
          const fa = filterAssignee.toLowerCase()
          return parts.some(p => p === fa || (member && (p === member.name.toLowerCase() || p === member.email.toLowerCase())))
        })
      }
    }
    if (filterLabel !== 'all') {
      filtered = filtered.filter(t => t.tags && t.tags.some(tag => tag.includes(filterLabel)))
    }
    return filtered
  }, [tickets, searchQuery, serverSearchResults, filterPriority, filterAssignee, filterLabel])

  // Carregar colunas do Supabase (com fallback para COLUMNS legadas)
  useEffect(() => {
    const fetchCols = async () => {
      try {
        const cols = await fetchBoardColumns()
        if (cols.length > 0) {
          setColumns(cols)
          setColumnOrder(cols.map(c => c.id))
        } else {
          // Fallback: usar colunas legadas
          const fallback = buildFallbackColumns()
          setColumns(fallback)
          setColumnOrder(fallback.map(c => c.id))
        }
      } catch {
        // Fallback em caso de erro (tabela não existe)
        const fallback = buildFallbackColumns()
        setColumns(fallback)
        setColumnOrder(fallback.map(c => c.id))
      }
    }
    fetchCols()
  }, [])

  const recentWallpapersKey = `chatpro-recent-wallpapers:${user.toLowerCase()}`

  useEffect(() => {
    const saved = localStorage.getItem(wallpaperStorageKey) || ''
    setWallpaper(saved)
    try {
      const recent = JSON.parse(localStorage.getItem(recentWallpapersKey) || '[]') as string[]
      setRecentWallpapers(recent)
    } catch { /* ignore */ }
  }, [wallpaperStorageKey, recentWallpapersKey])

  const allColumnsById = useMemo(() => new Map(columns.map(col => [col.id, col])), [columns])
  const allColumns = useMemo(() => columnOrder.map(id => allColumnsById.get(id)).filter((col): col is NonNullable<typeof col> => Boolean(col)), [columnOrder, allColumnsById])
  const columnIds = useMemo(() => allColumns.map(col => col.id), [allColumns])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterPriority !== 'all') count++
    if (filterAssignee !== 'all') count++
    if (filterLabel !== 'all') count++
    return count
  }, [filterPriority, filterAssignee, filterLabel])

  const uniqueAssignees = useMemo(() => {
    const seen = new Map<string, string>() // canonical email/name → display name
    for (const t of tickets) {
      if (t.assignee) {
        t.assignee.split(',').map(s => s.trim()).filter(Boolean).forEach(raw => {
          // Resolve against allMembers to deduplicate
          const member = allMembers.find(m => m.email === raw || m.name === raw || m.email.split('@')[0].toLowerCase() === raw.toLowerCase())
          const key = member?.email || raw.toLowerCase()
          if (!seen.has(key)) {
            seen.set(key, member?.name || (raw.includes('@') ? raw.split('@')[0] : raw))
          }
        })
      }
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [tickets, allMembers])

  const uniqueLabels = useMemo(() => {
    const set = new Set<string>()
    for (const t of tickets) {
      if (t.tags) t.tags.forEach(tag => set.add(tag))
    }
    return Array.from(set).sort()
  }, [tickets])

  const clearAllFilters = useCallback(() => {
    setFilterPriority('all')
    setFilterAssignee('all')
    setFilterLabel('all')
  }, [])

  const toggleBulkSelect = useCallback((id: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkMove = useCallback(async (targetColumn: string) => {
    if (selectedCardIds.size === 0) return
    const ids = Array.from(selectedCardIds)
    setTickets(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: targetColumn as TicketStatus } : t))
    setSelectedCardIds(new Set())
    setBulkMode(false)
    showToast(`${ids.length} card(s) movido(s)`, 'ok')
    for (const id of ids) {
      await updateTicket(id, { status: targetColumn as TicketStatus }).catch(console.error)
    }
  }, [selectedCardIds])

  const handleBulkArchive = useCallback(async () => {
    if (selectedCardIds.size === 0) return
    const ids = Array.from(selectedCardIds)
    setTickets(prev => prev.filter(t => !ids.includes(t.id)))
    setSelectedCardIds(new Set())
    setBulkMode(false)
    showToast(`${ids.length} card(s) arquivado(s)`, 'ok')
    for (const id of ids) {
      await Promise.resolve(supabase.from('tickets').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id)).catch(console.error)
    }
  }, [selectedCardIds])

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
    if (dragOriginalStatusRef.current) {
      dragOriginalStatusRef.current = null
      loadTickets() // rollback
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const dragType = event.active.data.current?.type
    if (dragType === 'column') {
      setActiveColumnId(String(event.active.id))
      return
    }

    const ticket = tickets.find(t => t.id === event.active.id)
    if (ticket) {
      setActiveTicket(ticket)
      dragOriginalStatusRef.current = ticket.status
    }
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.active.data.current?.type === 'column') return

    const { over } = event
    if (!over) { setOverColumn(null); setOverCardId(null); return }

    const overId = String(over.id)

    // Determine which column the over target belongs to
    let targetColumn: string | undefined
    if (allColumnsById.has(overId)) {
      targetColumn = overId
    } else {
      targetColumn = tickets.find(t => t.id === overId)?.status
    }

    setOverColumn(targetColumn ?? null)
    setOverCardId(allColumnsById.has(overId) ? null : overId)
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

    const originalStatus = dragOriginalStatusRef.current
    dragOriginalStatusRef.current = null

    if (!over) {
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)

    // Determine the target column
    let targetColumn: string | undefined
    if (allColumnsById.has(overId)) {
      targetColumn = overId
    } else {
      targetColumn = tickets.find(t => t.id === overId)?.status
    }
    if (!targetColumn) return

    const ticket = tickets.find(t => t.id === activeId)
    if (!ticket) return

    // Apply the move in state (only once, on drop)
    setTickets(prev => {
      const idx = prev.findIndex(t => t.id === activeId)
      if (idx < 0) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], status: targetColumn as TicketStatus }
      const overIdx = next.findIndex(t => t.id === overId)
      if (overIdx >= 0 && overIdx !== idx) {
        return arrayMove(next, idx, overIdx)
      }
      return next
    })

    const newStatus = targetColumn
    const fromLabel = allColumnsById.get(originalStatus || '')?.title || originalStatus || ''
    const toLabel = allColumnsById.get(newStatus)?.title || newStatus

    // Persist to Supabase
    setMutatingIds(prev => new Set(prev).add(activeId))
    updateTicket(activeId, { status: newStatus as TicketStatus })
      .then(() => {
        if (originalStatus && originalStatus !== newStatus) {
          insertActivityLog(activeId, user, `moveu este cartão de ${fromLabel} para ${toLabel}`)
        }
      })
      .catch(() => {
        showToast('Erro ao mover ticket', 'err')
        loadTickets() // rollback
      })
      .finally(() => {
        setMutatingIds(prev => { const next = new Set(prev); next.delete(activeId); return next })
      })
  }

  const handleInlineAdd = async (col: TicketStatus) => {
    if (!inlineTitle.trim()) return
    try {
      const created = await insertTicket({ department_id: departmentId ?? '', title: inlineTitle.trim(), description: '', status: col, priority: 'medium', assignee: user })
      setTickets(prev => prev.some(t => t.id === created.id) ? prev : [...prev, created])
      setInlineTitle('')
      setAddingTo(null)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar ticket', 'err')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadTickets()
    setRefreshing(false)
  }

  const staleCount = useMemo(() => tickets.filter(t => Date.now() - new Date(t.updated_at).getTime() > 12 * 60 * 60 * 1000 && t.status !== 'resolved').length, [tickets])
  const visibleUsers = useMemo(() => onlineUsers.length > 0 ? onlineUsers : [user], [onlineUsers, user])

  const handleCardClick = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket)
  }, [])

  // ── Keyboard shortcuts ──
  const noModalOpen = !showAddModal && !selectedTicket && !showSettings && !showInstanceModal && !showArchivedPanel && !showLabelsManager && !showShortcutsHelp
  const shortcutActions = useMemo(() => [
    { key: 'n', description: 'Novo ticket', action: () => { if (noModalOpen) { setShowAddModal(true) } } },
    { key: 'f', description: 'Filtros avançados', action: () => { if (noModalOpen) setShowFilters(p => !p) } },
    { key: 'k', ctrl: true, description: 'Pesquisar', action: () => { searchInputRef.current?.focus() } },
    { key: '/', description: 'Pesquisar', action: () => { if (noModalOpen) searchInputRef.current?.focus() } },
    { key: 'r', description: 'Atualizar tickets', action: () => { if (noModalOpen) handleRefresh() } },
    { key: 'c', description: 'Modo compacto', action: () => { if (noModalOpen) { setCompactMode(p => { localStorage.setItem('chatpro-compact-mode', String(!p)); return !p }) } } },
    { key: '?', shift: true, description: 'Atalhos de teclado', action: () => openShortcutsHelp() },
    { key: 'Escape', description: 'Fechar modal/painel', action: () => {
      if (showShortcutsHelp) { closeShortcutsHelp(); return }
      if (showFilters) { setShowFilters(false); return }
      if (showAddModal) { setShowAddModal(false); return }
      if (selectedTicket) { setSelectedTicket(null); return }
      if (showSettings) { setShowSettings(false); return }
      if (showArchivedPanel) { setShowArchivedPanel(false); return }
    }},
  ], [noModalOpen, allColumns, showAddModal, selectedTicket, showSettings, showFilters, showArchivedPanel, showShortcutsHelp, openShortcutsHelp, closeShortcutsHelp])

  useKeyboardShortcuts(shortcutActions)

  const handleTicketUpdate = useCallback((updated: Ticket) => {
    setTickets(prev => prev.map(t => t.id === updated.id ? { ...updated, attachment_count: t.attachment_count || 0 } : t))
    // Só atualizar o selectedTicket se o modal já estiver aberto (não abrir ao clicar no check)
    setSelectedTicket(prev => prev && prev.id === updated.id ? updated : prev)
  }, [])

  const handleTicketDelete = useCallback((id: string) => {
    setTickets(prev => prev.filter(t => t.id !== id))
    setSelectedTicket(null)
  }, [])

  const handleTicketArchive = useCallback((id: string) => {
    setTickets(prev => prev.filter(t => t.id !== id))
  }, [])

  const applyWallpaper = (url: string) => {
    setWallpaper(url)
    try {
      localStorage.setItem(wallpaperStorageKey, url)
    } catch {
      showToast('Sem espaço local para salvar este fundo', 'err')
    }
    // Salvar nos recentes se for imagem importada (data: ou http)
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

  // ── Scroll lateral segurando o fundo do board ──
  const handleBoardMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Só ativa se clicar no fundo do scroller/board (não em cards, colunas ou botões)
    if (target.closest('.trello-col')) return
    const isBoard = target === scrollerRef.current
      || target.classList.contains('board-columns')
      || target.classList.contains('board-main__scroller')
      || target.classList.contains('board-main')
      || (target.closest('.board-main__scroller') === scrollerRef.current)
    if (!isBoard) return
    boardDragRef.current.isDragging = true
    boardDragRef.current.startX = e.clientX
    boardDragRef.current.scrollLeft = scrollerRef.current?.scrollLeft ?? 0
    if (scrollerRef.current) scrollerRef.current.style.cursor = 'grabbing'
  }, [])

  const handleBoardMouseMove = useCallback((e: React.MouseEvent) => {
    if (!boardDragRef.current.isDragging || !scrollerRef.current) return
    e.preventDefault()
    const walk = (e.clientX - boardDragRef.current.startX) * 1.5
    scrollerRef.current.scrollLeft = boardDragRef.current.scrollLeft - walk
  }, [])

  const stopBoardDrag = useCallback(() => {
    boardDragRef.current.isDragging = false
    if (scrollerRef.current) scrollerRef.current.style.cursor = ''
  }, [])

  // ── Cores disponíveis para dot das colunas ──
  const COL_COLORS = ['#101204', '#579dff', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#22c55e', '#ec4899', '#a855f7', '#f97316', '#64748b']

  const handleSaveColumnTitle = useCallback(async (colId: string, newTitle: string) => {
    const trimmed = newTitle.trim()
    if (!trimmed) { setEditingColumnId(null); return }
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, title: trimmed } : c))
    setEditingColumnId(null)
    try {
      await updateBoardColumn(colId, { title: trimmed })
    } catch {
      showToast('Erro ao renomear lista', 'err')
    }
  }, [])

  const handleSaveColumnColor = useCallback(async (colId: string, color: string) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, dot_color: color } : c))
    setColorPickerColumnId(null)
    try {
      await updateBoardColumn(colId, { dot_color: color })
    } catch {
      showToast('Erro ao mudar cor da lista', 'err')
    }
  }, [])

  const handleSortColumn = useCallback((colId: string, sortType: 'newest' | 'oldest' | 'alpha' | 'due') => {
    setTickets(prev => {
      const colTickets = prev.filter(t => t.status === colId)
      const rest = prev.filter(t => t.status !== colId)
      const sorted = [...colTickets].sort((a, b) => {
        switch (sortType) {
          case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          case 'alpha': return a.title.localeCompare(b.title, 'pt-BR')
          case 'due': {
            const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity
            const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity
            return aDate - bDate
          }
          default: return 0
        }
      })
      sorted.forEach((t, i) => { (t as Ticket & { position?: number }).position = i })
      return [...rest, ...sorted]
    })
    setColorPickerColumnId(null)
    showToast('Lista ordenada', 'ok')
  }, [])

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
    <div className="board-wrapper" style={boardWrapperStyle} role="region" aria-label="Quadro Kanban">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xl"
            style={{ background: toast.type === 'ok' ? '#579dff' : '#ef5c48', color: '#fff' }}
            role="status" aria-live="polite">
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <header className="board-header">
        <div className="trello-board-header__left">
          <button className="trello-board-chip trello-board-chip--title" type="button" style={{ paddingLeft: '4px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '2px' }}>
              <path d="M21 11.5C21 15.6421 16.9706 19 12 19C10.7441 19 9.54922 18.7753 8.46162 18.3743L4.5 20L5.39793 16.205C3.20456 14.8682 2 13.0456 2 11.5C2 7.35786 6.47715 4 12 4C17.5228 4 21 7.35786 21 11.5Z" fill="#25D066"/>
              <circle cx="8" cy="11.5" r="1.5" fill="#111111"/>
              <circle cx="12" cy="11.5" r="1.5" fill="#111111"/>
              <circle cx="16" cy="11.5" r="1.5" fill="#111111"/>
            </svg>
            <span className="trello-board-chip__title">Suporte chatPro</span>
          </button>

          {isDevEnvironment && (
            <span style={{
              background: '#f97316',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              letterSpacing: '0.05em',
              lineHeight: '18px',
              flexShrink: 0,
            }}>DEV</span>
          )}

          <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

          <button
            onClick={() => setShowInstanceModal(true)}
            className="trello-board-chip"
            type="button"
          >
            <Plug size={14} />
            Instância
          </button>

          {staleCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="trello-alert-chip"
            >
              <span className="trello-alert-chip__dot" />
              {staleCount} sem resposta +12h
            </motion.div>
          )}
        </div>

        <div className="trello-board-header__center">
          <div className="header-search" data-tour="board-search">
            {searchLoading ? (
              <Loader2 size={14} className="animate-spin" style={{ color: '#25D066', flexShrink: 0 }} />
            ) : (
              <Search size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
            )}
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Pesquisar (/ ou Ctrl+K)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm flex-1"
              style={{ color: '#B6C2CF' }}
              role="searchbox"
              aria-label="Pesquisar tickets"
            />
            {searchQuery.trim() && !searchLoading && (
              <span style={{ fontSize: 11, color: serverSearchResults ? '#25D066' : '#6B7280', fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
                {serverSearchResults ? `${serverSearchResults.length} resultados` : 'local'}
              </span>
            )}
            {searchQuery.trim() && (
              <button
                onClick={() => { setSearchQuery(''); setServerSearchResults(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', padding: 2, flexShrink: 0 }}
                type="button"
                aria-label="Limpar busca"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="trello-board-header__right">
          <div className={clsx('trello-board-status', isConnected ? 'trello-board-status--ok' : 'trello-board-status--off')} title={isConnected ? 'Conectado ao realtime' : 'Sem conexão'}>
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

          {/* Toggle Kanban / Lista */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 2, gap: 2 }}>
            <button
              onClick={() => { setViewMode('kanban'); localStorage.setItem('chatpro-view-mode', 'kanban') }}
              style={{
                padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: viewMode === 'kanban' ? 'rgba(37,208,102,0.15)' : 'transparent',
                color: viewMode === 'kanban' ? '#25D066' : '#8C96A3',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                transition: 'all 0.15s',
              }}
              title="Kanban"
              type="button"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => { setViewMode('list'); localStorage.setItem('chatpro-view-mode', 'list') }}
              style={{
                padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: viewMode === 'list' ? 'rgba(37,208,102,0.15)' : 'transparent',
                color: viewMode === 'list' ? '#25D066' : '#8C96A3',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                transition: 'all 0.15s',
              }}
              title="Lista"
              type="button"
            >
              <List size={14} />
            </button>
          </div>

          {/* Modo compacto */}
          <button
            onClick={() => setCompactMode(p => { localStorage.setItem('chatpro-compact-mode', String(!p)); return !p })}
            className="trello-icon-btn"
            type="button"
            title={compactMode ? 'Modo normal (C)' : 'Modo compacto (C)'}
            style={compactMode ? { color: '#25D066', background: 'rgba(37,208,102,0.12)' } : undefined}
          >
            {compactMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Filtros avançados */}
          <button
            onClick={() => setShowFilters(p => !p)}
            className="trello-icon-btn"
            type="button"
            title="Filtros avançados (F)"
            style={showFilters || activeFilterCount > 0 ? { color: '#25D066', background: 'rgba(37,208,102,0.12)' } : undefined}
          >
            <Filter size={16} />
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                width: 16, height: 16, borderRadius: '50%',
                background: '#25D066', color: '#000',
                fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{activeFilterCount}</span>
            )}
          </button>

          {/* Atalhos de teclado */}
          <button
            onClick={openShortcutsHelp}
            className="trello-icon-btn"
            type="button"
            title="Atalhos de teclado (?)"
          >
            <Keyboard size={16} />
          </button>

          {/* Seleção múltipla */}
          <button
            onClick={() => { setBulkMode(p => !p); setSelectedCardIds(new Set()) }}
            className="trello-icon-btn"
            type="button"
            title="Seleção múltipla"
            style={bulkMode ? { color: '#25D066', background: 'rgba(37,208,102,0.12)' } : undefined}
          >
            <CheckSquare size={16} />
          </button>

          <button onClick={() => setShowSettings(true)} className="trello-icon-btn" type="button" title="Configurações">
            <Settings size={16} />
          </button>

          <button onClick={() => setShowAddModal(true)} className="trello-create-btn" type="button">
            Criar
          </button>

          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

          {/* Online avatars (presence-based) */}
          <div className="flex -space-x-1.5 cursor-default">
            {visibleUsers.slice(0, 5).map((u, i) => {
              const member = allMembers.find(m => m.email === u)
              const color = member?.avatar_color || ['#579DFF', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4'][i % 5]
              return (
                <div key={u} className="relative" style={{ zIndex: 10 - i }}>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: color, border: '2px solid #1D2125' }}
                    title={u}
                  >
                    {(member?.name || u).slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ background: '#4BCE97', borderColor: '#1D2125' }} />
                </div>
              )
            })}
            {visibleUsers.length > 5 && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: '#22272B', color: '#9FADBC', border: '2px solid #1D2125' }}
              >
                +{visibleUsers.length - 5}
              </div>
            )}
          </div>

          {/* Members button */}
          <div className="relative">
            <button
              onClick={() => setShowMembersPanel(p => !p)}
              className="trello-icon-btn"
              type="button"
              title="Ver membros"
            >
              <Users size={16} />
            </button>

            <AnimatePresence>
              {showMembersPanel && (
                <>
                  <div className="fixed inset-0 z-[98]" onClick={() => setShowMembersPanel(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.14 }}
                    className="members-panel"
                  >
                    <div className="members-panel__header">
                      <span className="members-panel__title">Membros</span>
                      <span className="members-panel__count">{allMembers.length}</span>
                    </div>

                    {/* Online section */}
                    {(() => {
                      const onlineMembers = allMembers.filter(m => onlineUsers.includes(m.email))
                      const offlineMembers = allMembers.filter(m => !onlineUsers.includes(m.email))
                      const formatLastSeen = (iso: string) => {
                        const diff = Date.now() - new Date(iso).getTime()
                        const mins = Math.floor(diff / 60000)
                        const hrs = Math.floor(diff / 3600000)
                        const days = Math.floor(diff / 86400000)
                        if (mins < 1) return 'agora'
                        if (mins < 60) return `há ${mins}min`
                        if (hrs < 24) return `há ${hrs}h`
                        if (days === 1) return 'ontem'
                        return `há ${days} dias`
                      }
                      return (
                        <div className="members-panel__body">
                          {onlineMembers.length > 0 && (
                            <div className="members-panel__section">
                              <p className="members-panel__section-label">
                                <span className="members-panel__dot members-panel__dot--online" />
                                Online ({onlineMembers.length})
                              </p>
                              {onlineMembers.map(m => (
                                <div key={m.id} className="members-panel__row">
                                  <div className="members-panel__avatar-wrap">
                                    <div className="members-panel__avatar" style={{ background: m.avatar_color }}>
                                      {m.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <span className="members-panel__status members-panel__status--online" />
                                  </div>
                                  <div className="members-panel__info">
                                    <span className="members-panel__name">{m.name}</span>
                                    <span className="members-panel__seen">online</span>
                                  </div>
                                  {m.role === 'admin' && <span className="members-panel__badge">Admin</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {offlineMembers.length > 0 && (
                            <div className="members-panel__section">
                              <p className="members-panel__section-label">
                                <span className="members-panel__dot members-panel__dot--offline" />
                                Offline ({offlineMembers.length})
                              </p>
                              {offlineMembers.map(m => (
                                <div key={m.id} className="members-panel__row">
                                  <div className="members-panel__avatar-wrap">
                                    <div className="members-panel__avatar" style={{ background: m.avatar_color, opacity: 0.6 }}>
                                      {m.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <span className="members-panel__status members-panel__status--offline" />
                                  </div>
                                  <div className="members-panel__info">
                                    <span className="members-panel__name" style={{ opacity: 0.7 }}>{m.name}</span>
                                    <span className="members-panel__seen">{formatLastSeen(m.last_seen_at)}</span>
                                  </div>
                                  {m.role === 'admin' && <span className="members-panel__badge">Admin</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {allMembers.length === 0 && (
                            <div className="text-center py-6 text-[12px]" style={{ color: '#596773' }}>Nenhum membro registrado.</div>
                          )}
                        </div>
                      )
                    })()}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => setShowArchivedPanel(true)} className="trello-icon-btn" type="button" title="Itens arquivados">
            <Archive size={16} />
          </button>

          <button onClick={onLogout} className="trello-icon-btn trello-icon-btn--danger" type="button" title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Painel de arquivados */}
      {showArchivedPanel && (
        <ArchivedPanel
          onClose={() => setShowArchivedPanel(false)}
          onRestore={() => { loadTickets(); setShowArchivedPanel(false) }}
        />
      )}

      {/* Filtros avançados panel */}
      <AnimatePresence>
        {showFilters && (
          <FilterPanel
            filterPriority={filterPriority}
            filterAssignee={filterAssignee}
            filterLabel={filterLabel}
            uniqueAssignees={uniqueAssignees}
            uniqueLabels={uniqueLabels}
            activeFilterCount={activeFilterCount}
            onFilterPriorityChange={setFilterPriority}
            onFilterAssigneeChange={setFilterAssignee}
            onFilterLabelChange={setFilterLabel}
            onClearAllFilters={clearAllFilters}
            onClose={() => setShowFilters(false)}
          />
        )}
      </AnimatePresence>

      {/* Board */}
      <main className="board-main" style={boardSurfaceStyle}>
        <AnimatePresence mode="wait">
        {viewMode === 'kanban' ? (
        <motion.div
          key="kanban"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          style={{ height: '100%' }}
        >
        <div
          ref={scrollerRef}
          className="board-main__scroller"
          onMouseDown={handleBoardMouseDown}
          onMouseMove={handleBoardMouseMove}
          onMouseUp={stopBoardDrag}
          onMouseLeave={stopBoardDrag}
        >
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
                  <div key={col.id} {...(colIdx === 0 ? { 'data-tour': 'board-column' } : {})}>
                    <SortableBoardColumn id={col.id} accentColor={col.dot_color}>
                      {({ attributes, listeners }) => (
                        <>
                          {/* Column header (drag handle) */}
                          <div className="trello-col__head cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
                            {/* Title - duplo clique para editar */}
                            {editingColumnId === col.id ? (
                              <input
                                autoFocus
                                className="col-title-input flex-1"
                                value={editingColumnTitle}
                                onChange={e => setEditingColumnTitle(e.target.value)}
                                onBlur={() => handleSaveColumnTitle(col.id, editingColumnTitle)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveColumnTitle(col.id, editingColumnTitle)
                                  if (e.key === 'Escape') setEditingColumnId(null)
                                }}
                                onClick={e => e.stopPropagation()}
                                onMouseDown={e => e.stopPropagation()}
                                onPointerDown={e => e.stopPropagation()}
                              />
                            ) : (
                              <span
                                className="flex-1 truncate"
                                onDoubleClick={e => { e.stopPropagation(); setEditingColumnId(col.id); setEditingColumnTitle(col.title) }}
                              >{col.title}</span>
                            )}
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.12)', color: '#ffffff' }}>{colTickets.length}</span>

                            {/* 3-dots menu */}
                            <div className="relative flex-shrink-0" onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                              <button
                                type="button"
                                className="col-dots-btn"
                                onClick={e => {
                                  e.stopPropagation()
                                  if (colorPickerColumnId === col.id) {
                                    setColorPickerColumnId(null)
                                  } else {
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                    setColorPickerPos({ top: rect.bottom + 6, left: rect.right - 200 })
                                    setColMenuView('main')
                                    setColorPickerColumnId(col.id)
                                  }
                                }}
                                title="Opções da lista"
                              >
                                <span className="col-dots-btn__dot" />
                                <span className="col-dots-btn__dot" />
                                <span className="col-dots-btn__dot" />
                              </button>

                              {colorPickerColumnId === col.id && (
                                <>
                                  <div className="fixed inset-0 z-[199]" onClick={() => setColorPickerColumnId(null)} />
                                  <div
                                    className="col-menu"
                                    style={{ top: colorPickerPos.top, left: colorPickerPos.left }}
                                    onClick={e => e.stopPropagation()}
                                    onPointerDown={e => e.stopPropagation()}
                                  >
                                    {/* ── Main view ── */}
                                    {colMenuView === 'main' && (
                                      <>
                                        <button className="col-menu__item" onClick={() => setColMenuView('color')}>
                                          <Palette size={14} />
                                          <span>Cor da lista</span>
                                        </button>
                                        <button className="col-menu__item" onClick={() => setColMenuView('sort')}>
                                          <ArrowUpDown size={14} />
                                          <span>Ordenar lista</span>
                                        </button>
                                        <div className="col-menu__sep" />
                                        <button className="col-menu__item" onClick={e => { e.stopPropagation(); setEditingColumnId(col.id); setEditingColumnTitle(col.title); setColorPickerColumnId(null) }}>
                                          <Pencil size={14} />
                                          <span>Renomear</span>
                                        </button>
                                        <button
                                          className="col-menu__item col-menu__item--danger"
                                          onClick={() => {
                                            setColorPickerColumnId(null)
                                            if (colTickets.length > 0 && !confirm(`A lista "${col.title}" tem ${colTickets.length} cartão(s). Excluir mesmo assim?`)) return
                                            if (colTickets.length === 0 && !confirm(`Excluir a lista "${col.title}"?`)) return
                                            setColumns(prev => prev.filter(cc => cc.id !== col.id))
                                            setColumnOrder(prev => prev.filter(id => id !== col.id))
                                            setTickets(prev => prev.filter(t => t.status !== col.id))
                                            archiveBoardColumn(col.id).catch(() => {})
                                            showToast('Lista excluída', 'ok')
                                          }}
                                        >
                                          <Trash2 size={14} />
                                          <span>Excluir lista</span>
                                        </button>
                                      </>
                                    )}

                                    {/* ── Color view ── */}
                                    {colMenuView === 'color' && (
                                      <>
                                        <div className="col-menu__header">
                                          <button className="col-menu__back" onClick={() => setColMenuView('main')}><ChevronLeft size={16} /></button>
                                          <span>Cor da lista</span>
                                          <button className="col-menu__close" onClick={() => setColorPickerColumnId(null)}><X size={14} /></button>
                                        </div>
                                        <div className="col-menu__colors">
                                          {COL_COLORS.map(c => (
                                            <button
                                              key={c}
                                              type="button"
                                              className="col-color-picker__swatch"
                                              style={{ background: c, outline: c === col.dot_color ? '2px solid #fff' : 'none' }}
                                              onClick={e => { e.stopPropagation(); handleSaveColumnColor(col.id, c) }}
                                            />
                                          ))}
                                        </div>
                                      </>
                                    )}

                                    {/* ── Sort view ── */}
                                    {colMenuView === 'sort' && (
                                      <>
                                        <div className="col-menu__header">
                                          <button className="col-menu__back" onClick={() => setColMenuView('main')}><ChevronLeft size={16} /></button>
                                          <span>Ordenar lista</span>
                                          <button className="col-menu__close" onClick={() => setColorPickerColumnId(null)}><X size={14} /></button>
                                        </div>
                                        <button className="col-menu__item" onClick={() => handleSortColumn(col.id, 'newest')}>
                                          Data de criação (mais recente primeiro)
                                        </button>
                                        <button className="col-menu__item" onClick={() => handleSortColumn(col.id, 'oldest')}>
                                          Data de criação (mais antigo primeiro)
                                        </button>
                                        <button className="col-menu__item" onClick={() => handleSortColumn(col.id, 'alpha')}>
                                          Nome do cartão (ordem alfabética)
                                        </button>
                                        <button className="col-menu__item" onClick={() => handleSortColumn(col.id, 'due')}>
                                          Data de entrega
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Cards area */}
                          <DroppableColumn id={col.id} isOver={overColumn === col.id}>
                            <div className="trello-col__cards">
                              <SortableContext items={colTickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                  {colTickets.map(ticket => (
                                    <SortableCard
                                      key={ticket.id}
                                      ticket={ticket}
                                      onClick={handleCardClick}
                                      onUpdate={handleTicketUpdate}
                                      onArchive={handleTicketArchive}
                                      onShowToast={showToast}
                                      isOverCard={overCardId === ticket.id}
                                      activeTicket={activeTicket}
                                      compact={compactMode}
                                      bulkMode={bulkMode}
                                      isSelected={selectedCardIds.has(ticket.id)}
                                      onBulkToggle={toggleBulkSelect}
                                      isMutating={mutatingIds.has(ticket.id)}
                                    />
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
                                <button onClick={() => handleInlineAdd(col.id as TicketStatus)} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: '#25D066' }}>Adicionar</button>
                                <button onClick={() => { setAddingTo(null); setInlineTitle('') }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setAddingTo(col.id as TicketStatus); setInlineTitle('') }} className="trello-col__add" {...(colIdx === 0 ? { 'data-tour': 'board-add-ticket' } : {})}>
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
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && newListName.trim()) {
                      let col: BoardColumn
                      try {
                        col = await insertBoardColumn(newListName.trim(), columns.length)
                      } catch {
                        col = buildLocalColumn(newListName, columns.length)
                      }
                      setColumns(prev => [...prev, col])
                      setColumnOrder(prev => [...prev, col.id])
                      setNewListName('')
                      setAddingList(false)
                      showToast('Lista adicionada!', 'ok')
                    }
                    if (e.key === 'Escape') { setAddingList(false); setNewListName('') }
                  }}
                />
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    onClick={async () => {
                      if (!newListName.trim()) return
                      let col: BoardColumn
                      try {
                        col = await insertBoardColumn(newListName.trim(), columns.length)
                      } catch {
                        col = buildLocalColumn(newListName, columns.length)
                      }
                      setColumns(prev => [...prev, col])
                      setColumnOrder(prev => [...prev, col.id])
                      setNewListName('')
                      setAddingList(false)
                      showToast('Lista adicionada!', 'ok')
                    }}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
                    style={{ background: '#25D066' }}
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
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: allColumnsById.get(activeColumnId)?.dot_color }} />
                  <span className="flex-1 truncate">{allColumnsById.get(activeColumnId)?.title}</span>
                </div>
              </div>
            )}
            {activeTicket && (
              <div style={{ transform: 'rotate(3deg)', opacity: 0.92 }}>
                <Card
                  card={activeTicket}
                  onClick={() => {}}
                  onUpdate={() => {}}
                  onArchive={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
        )}
        </div>
        </motion.div>
        ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          style={{ height: '100%', overflow: 'auto', padding: '24px 32px' }}
          className="modal-scroll"
        >
          {loading ? (
            <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-sm">Carregando tickets...</span>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Stats bar */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {allColumns.map(col => {
                  const count = getColumnTickets(col.id).length
                  return (
                    <div key={col.id} style={{
                      flex: '1 1 0', minWidth: 120,
                      background: '#1a1f23', borderRadius: 12, padding: '14px 16px',
                      borderLeft: `3px solid ${col.dot_color}`,
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'background 0.15s, transform 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#22272b'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#1a1f23'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#8C96A3', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.title}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#E5E7EB', fontFamily: "'Paytone One', sans-serif", lineHeight: 1 }}>{count}</div>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot_color, flexShrink: 0, boxShadow: `0 0 8px ${col.dot_color}66` }} />
                    </div>
                  )
                })}
                <div style={{
                  flex: '1 1 0', minWidth: 120,
                  background: 'rgba(37,208,102,0.06)', borderRadius: 12, padding: '14px 16px',
                  borderLeft: '3px solid #25D066',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#25D066', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 2 }}>Total</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#25D066', fontFamily: "'Paytone One', sans-serif", lineHeight: 1 }}>{tickets.filter(t => !t.is_archived).length}</div>
                  </div>
                </div>
              </div>

              {/* Column groups */}
              {allColumns.map(col => {
                const colTickets = getColumnTickets(col.id)
                const isCollapsed = collapsedColumns.has(col.id)
                return (
                  <div key={col.id} style={{
                    background: '#1a1f23', borderRadius: 14,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    {/* Column header */}
                    <button
                      onClick={() => setCollapsedColumns(prev => {
                        const next = new Set(prev)
                        if (next.has(col.id)) next.delete(col.id)
                        else next.add(col.id)
                        return next
                      })}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '16px 20px', background: 'transparent', border: 'none',
                        borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer', color: '#B6C2CF', fontFamily: "'Space Grotesk', sans-serif",
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <motion.div animate={{ rotate: isCollapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
                        <ChevronRight size={16} style={{ color: '#25D066' }} />
                      </motion.div>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: col.dot_color, flexShrink: 0,
                        boxShadow: `0 0 8px ${col.dot_color}55`,
                      }} />
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#E5E7EB' }}>{col.title}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: '#25D066',
                        background: 'rgba(37,208,102,0.1)',
                        padding: '3px 12px', borderRadius: 20, lineHeight: '1.2',
                      }}>{colTickets.length}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{
                        fontSize: 11, color: '#596773', fontWeight: 500,
                        padding: '3px 10px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.03)',
                      }}>{isCollapsed ? 'Expandir' : 'Recolher'}</span>
                    </button>

                    {/* Cards list */}
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {colTickets.length === 0 && (
                              <div style={{
                                padding: '32px', textAlign: 'center', color: '#596773',
                                fontSize: 13, fontFamily: "'Space Grotesk', sans-serif",
                                borderRadius: 10, background: 'rgba(255,255,255,0.01)',
                                border: '1px dashed rgba(255,255,255,0.06)',
                              }}>
                                Nenhum card nesta coluna
                              </div>
                            )}
                            {colTickets.map((ticket) => {
                              const prioColors: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#06b6d4' }
                              const prioLabels: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' }
                              const pColor = prioColors[ticket.priority] || '#596773'
                              const hasDesc = !!(ticket.description && ticket.description.trim())
                              const attCount = ticket.attachment_count || 0
                              const obs = ticket.observacao || ''
                              const checkTotal = (obs.match(/^[☐☑]/gm) || []).length
                              const checkDone = (obs.match(/^☑/gm) || []).length
                              const hasChecklist = checkTotal > 0
                              const elapsed = (() => {
                                if (!ticket.created_at) return null
                                const diffMs = Date.now() - new Date(ticket.created_at).getTime()
                                const diffMin = Math.floor(diffMs / 60_000)
                                const diffH = Math.floor(diffMs / 3_600_000)
                                const diffD = Math.floor(diffMs / 86_400_000)
                                if (diffMin < 60) return { label: `${Math.max(diffMin, 1)}m`, isOverdue: false }
                                if (diffH < 24) return { label: `${diffH}h`, isOverdue: diffH >= 2 }
                                return { label: `${diffD}d`, isOverdue: true }
                              })()
                              const createdDate = (() => {
                                if (!ticket.created_at) return null
                                const d = new Date(ticket.created_at)
                                const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
                                return `${d.getDate()} ${months[d.getMonth()]}`
                              })()

                              return (
                                <div
                                  key={ticket.id}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = '#22272b'
                                    e.currentTarget.style.borderColor = 'rgba(37,208,102,0.15)'
                                    const acts = e.currentTarget.querySelector('[data-list-actions]') as HTMLElement
                                    if (acts) acts.style.opacity = '1'
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent'
                                    e.currentTarget.style.borderColor = 'transparent'
                                    const acts = e.currentTarget.querySelector('[data-list-actions]') as HTMLElement
                                    if (acts) acts.style.opacity = '0'
                                  }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '10px 16px', borderRadius: 10,
                                    border: '1px solid transparent',
                                    background: 'transparent', cursor: 'pointer',
                                    transition: 'background 0.12s, border-color 0.12s',
                                    fontFamily: "'Space Grotesk', sans-serif",
                                    position: 'relative',
                                  }}
                                  onClick={() => handleCardClick(ticket)}
                                >
                                  {/* Check button */}
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      const newVal = !ticket.is_completed
                                      handleTicketUpdate({ ...ticket, is_completed: newVal } as Ticket)
                                      await supabase.from('tickets').update({ is_completed: newVal, updated_at: new Date().toISOString() }).eq('id', ticket.id)
                                    }}
                                    style={{
                                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                                      border: ticket.is_completed ? '2px solid #25D066' : '2px solid rgba(255,255,255,0.18)',
                                      background: ticket.is_completed ? '#25D066' : 'transparent',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: 'pointer', transition: 'all 0.15s', padding: 0,
                                    }}
                                    title={ticket.is_completed ? 'Marcar como incompleto' : 'Marcar como concluído'}
                                  >
                                    {ticket.is_completed && <Check size={10} strokeWidth={3} color="#fff" />}
                                  </button>

                                  {/* Cover thumbnail */}
                                  {(ticket.cover_thumb_url || ticket.cover_image_url) && (
                                    <div style={{
                                      width: 48, height: 36, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
                                      border: '1px solid rgba(255,255,255,0.06)',
                                    }}>
                                      <img
                                        src={ticket.cover_thumb_url || ticket.cover_image_url || ''}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        loading="lazy"
                                      />
                                    </div>
                                  )}

                                  {/* Main content */}
                                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {/* Row 1: Priority + Title + Cliente */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{
                                        fontSize: 9, fontWeight: 800, padding: '3px 8px',
                                        borderRadius: 6, flexShrink: 0,
                                        background: `${pColor}20`, color: pColor,
                                        textTransform: 'uppercase', letterSpacing: '0.06em',
                                        lineHeight: '1',
                                      }}>
                                        {prioLabels[ticket.priority] || ticket.priority}
                                      </span>
                                      <span style={{
                                        fontSize: 14, fontWeight: 500,
                                        color: ticket.is_completed ? '#596773' : '#E5E7EB',
                                        textDecoration: ticket.is_completed ? 'line-through' : 'none',
                                        textDecorationColor: ticket.is_completed ? 'rgba(37,208,102,0.4)' : undefined,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        flex: 1,
                                      }}>
                                        {ticket.title}
                                      </span>
                                      {ticket.cliente && (
                                        <span style={{
                                          fontSize: 11, color: '#596773', fontWeight: 500, flexShrink: 0,
                                          maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                          background: 'rgba(255,255,255,0.03)', padding: '2px 8px', borderRadius: 6,
                                        }}>
                                          {ticket.cliente}
                                        </span>
                                      )}
                                    </div>

                                    {/* Row 2: Tags */}
                                    {ticket.tags && ticket.tags.length > 0 && (
                                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {ticket.tags.map(raw => {
                                          const { name, color } = parseTag(raw)
                                          return (
                                            <span key={raw} style={{
                                              fontSize: 9, fontWeight: 700, padding: '2px 8px',
                                              borderRadius: 6, background: color, color: '#fff',
                                              letterSpacing: '0.02em',
                                            }}>{name}</span>
                                          )
                                        })}
                                      </div>
                                    )}

                                    {/* Row 3: Badges */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                      {elapsed && (
                                        <span style={{
                                          fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3,
                                          color: elapsed.isOverdue ? '#ef4444' : '#596773',
                                          fontWeight: elapsed.isOverdue ? 700 : 500,
                                        }}>
                                          <Clock size={11} />
                                          {elapsed.label}
                                        </span>
                                      )}
                                      {createdDate && (
                                        <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3, color: '#596773' }}>
                                          <Calendar size={11} />
                                          {createdDate}
                                        </span>
                                      )}
                                      {hasDesc && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', color: '#596773' }} title="Tem descrição">
                                          <AlignLeft size={11} />
                                        </span>
                                      )}
                                      {attCount > 0 && (
                                        <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3, color: '#596773' }} title={`${attCount} anexo(s)`}>
                                          <Paperclip size={11} />
                                          {attCount}
                                        </span>
                                      )}
                                      {hasChecklist && (
                                        <span style={{
                                          fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3,
                                          color: checkDone === checkTotal ? '#25D066' : '#596773',
                                          fontWeight: checkDone === checkTotal ? 700 : 500,
                                        }} title={`Checklist: ${checkDone}/${checkTotal}`}>
                                          <CheckSquare size={11} />
                                          {checkDone}/{checkTotal}
                                        </span>
                                      )}
                                      {ticket.instancia && (
                                        <span style={{ fontSize: 11, color: '#596773', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                          <Plug size={10} />
                                          {ticket.instancia}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Assignee avatar */}
                                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                    {ticket.assignee ? (
                                      <div style={{
                                        width: 30, height: 30, borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 11, fontWeight: 700, color: '#fff',
                                        background: `hsl(${(ticket.assignee.charCodeAt(0) * 47) % 360}, 55%, 45%)`,
                                        border: '2px solid #1a1f23',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                      }} title={ticket.assignee}>
                                        {ticket.assignee.slice(0, 2).toUpperCase()}
                                      </div>
                                    ) : null}
                                  </div>

                                  {/* Actions overlay (hover) */}
                                  <div
                                    data-list-actions
                                    style={{
                                      position: 'absolute', top: 8, right: 48,
                                      display: 'flex', gap: 4, opacity: 0,
                                      transition: 'opacity 0.15s',
                                    }}
                                  >
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        handleTicketArchive(ticket.id)
                                        showToast('Cartão arquivado com sucesso', 'ok')
                                        await supabase.from('tickets').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', ticket.id)
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#f87171' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#8C96A3' }}
                                      title="Arquivar"
                                      style={{
                                        width: 28, height: 28, borderRadius: 8,
                                        background: 'rgba(255,255,255,0.06)', border: 'none',
                                        color: '#8C96A3', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'background 0.15s, color 0.15s', padding: 0,
                                      }}
                                    >
                                      <Archive size={13} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleCardClick(ticket)
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.12)'; e.currentTarget.style.color = '#25D066' }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#8C96A3' }}
                                      title="Abrir detalhes"
                                      style={{
                                        width: 28, height: 28, borderRadius: 8,
                                        background: 'rgba(255,255,255,0.06)', border: 'none',
                                        color: '#8C96A3', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'background 0.15s, color 0.15s', padding: 0,
                                      }}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}

                            {/* Inline add card */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setAddingTo(col.id as TicketStatus)
                                setInlineTitle('')
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#25D066' }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#596773' }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '10px 16px', borderRadius: 10, border: 'none',
                                background: 'transparent', cursor: 'pointer',
                                color: '#596773', fontSize: 13, fontWeight: 500,
                                fontFamily: "'Space Grotesk', sans-serif",
                                transition: 'color 0.15s',
                              }}
                            >
                              <Plus size={14} />
                              Adicionar card
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddTicketModal
            columns={allColumns}
            initialStatus={(allColumns[0]?.id || 'backlog') as TicketStatus}
            onAdd={async (ticket) => {
              setCreatingTicket(true)
              try {
                const created = await insertTicket({ department_id: departmentId ?? '', title: ticket.title.trim(), description: ticket.description || '', status: ticket.status, priority: ticket.priority, cliente: ticket.cliente || '', instancia: ticket.instancia || '', assignee: user })
                setTickets(prev => prev.some(t => t.id === created.id) ? prev : [...prev, created])
                setShowAddModal(false)
                showToast('Ticket criado!', 'ok')
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Erro ao criar ticket. Verifique se está logado.'
                showToast(message, 'err')
              } finally {
                setCreatingTicket(false)
              }
            }}
            onClose={() => setShowAddModal(false)}
            onShowToast={showToast}
            isCreating={creatingTicket}
            user={user}
          />
        )}
      </AnimatePresence>


      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <SettingsPanel
            wallpaper={wallpaper}
            wallpaperInput={wallpaperInput}
            recentWallpapers={recentWallpapers}
            onWallpaperInputChange={setWallpaperInput}
            onApplyWallpaper={applyWallpaper}
            onWallpaperFileSelect={handleWallpaperFileSelect}
            onRemoveRecentWallpaper={(i) => {
              const updated = recentWallpapers.filter((_, idx) => idx !== i)
              setRecentWallpapers(updated)
              try { localStorage.setItem(recentWallpapersKey, JSON.stringify(updated)) } catch { /* ignore */ }
            }}
            onClearRecentWallpapers={() => {
              setRecentWallpapers([])
              try { localStorage.removeItem(recentWallpapersKey) } catch { /* ignore */ }
            }}
            onDeleteCurrentWallpaper={() => {
              const wpToRemove = wallpaper
              setWallpaper('')
              try { localStorage.setItem(wallpaperStorageKey, '') } catch { /* ignore */ }
              setRecentWallpapers(prev => {
                const updated = prev.filter(w => w !== wpToRemove)
                try { localStorage.setItem(recentWallpapersKey, JSON.stringify(updated)) } catch { /* ignore */ }
                return updated
              })
            }}
            onOpenLabelsManager={() => { setShowLabelsManager(true); fetchBoardLabels().then(setBoardLabels).catch(console.error) }}
            onOpenAutoRules={() => setShowAutoRules(true)}
            onOpenMembersPanel={() => { setShowSettings(false); setShowMembersManager(true) }}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>

      {/* Auto Rules Manager Modal */}
      <AnimatePresence>
        {showAutoRules && (
          <AutoRulesModal
            columns={allColumns}
            onClose={() => setShowAutoRules(false)}
            onRunRules={() => { setShowAutoRules(true) }}
            onShowToast={showToast}
            user={user}
          />
        )}
      </AnimatePresence>

      {/* Members Manager Panel */}
      <AnimatePresence>
        {showMembersManager && (
          <MembersManagerPanel onClose={() => setShowMembersManager(false)} />
        )}
      </AnimatePresence>

      {/* Labels Manager Modal */}
      {showLabelsManager && (
        <LabelsManagerModal
          boardLabels={boardLabels}
          onLabelsChange={setBoardLabels}
          onClose={() => setShowLabelsManager(false)}
        />
      )}

            {/* Card Detail Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <ErrorBoundary>
            <CardDetailModal
              ticket={selectedTicket}
              user={user}
              onClose={() => {
                setSelectedTicket(null)
                // Recarregar contagem de anexos ao fechar o modal
                fetchAttachmentCounts().then(counts => {
                  setTickets(prev => prev.map(t => ({ ...t, attachment_count: counts[t.id] || 0 })))
                })
              }}
              onUpdate={handleTicketUpdate}
              onDelete={handleTicketDelete}
            />
          </ErrorBoundary>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Help Modal */}
      <AnimatePresence>
        {showShortcutsHelp && <ShortcutsHelpModal onClose={closeShortcutsHelp} />}
      </AnimatePresence>

      {/* Instance Configuration Modal */}
      <InstanceModal open={showInstanceModal} onClose={() => setShowInstanceModal(false)} user={user} />

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {bulkMode && selectedCardIds.size > 0 && (
          <BulkActionsBar
            selectedCount={selectedCardIds.size}
            columns={allColumns}
            onMove={handleBulkMove}
            onArchive={handleBulkArchive}
            onCancel={() => { setSelectedCardIds(new Set()); setBulkMode(false) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
