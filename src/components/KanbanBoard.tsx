import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { DndContext, DragOverlay, closestCenter, closestCorners, pointerWithin, PointerSensor, useSensor, useSensors, type CollisionDetection, type DragStartEvent, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../lib/icons'
import { clsx } from 'clsx'
import Card from './Card'
import ErrorBoundary from './ErrorBoundary'
import { parseTag } from '../lib/tagUtils'
const CardDetailModal = lazy(() => import('./CardDetailModal'))
const InstanceModal = lazy(() => import('./InstanceModal'))
const ArchivedPanel = lazy(() => import('./ArchivedPanel').then(m => ({ default: m.ArchivedPanel })))
import { supabase, fetchTickets, fetchAttachmentCounts, insertTicket, updateTicket, insertActivityLog, isDevEnvironment, fetchBoardLabels, uploadAttachment } from '../lib/supabase'
import { compressAttachment } from '../lib/imageUtils'
import { insertBoardColumn, archiveBoardColumn, updateBoardColumn, BoardColumn } from '../lib/boardColumns'
import { useKeyboardShortcuts, useShortcutsHelp } from '../hooks/useKeyboardShortcuts'
import type { Ticket, TicketStatus, BoardLabel } from '../lib/supabase'
import ShortcutsHelpModal from './kanban/ShortcutsHelpModal'
import BulkActionsBar from './kanban/BulkActionsBar'
import GroupBySwitcher from './kanban/GroupBySwitcher'
import { groupTickets, type GroupByMode } from '../lib/kanbanGrouping'
const AutoRulesModal = lazy(() => import('./kanban/AutoRulesModal'))
const LabelsManagerModal = lazy(() => import('./kanban/LabelsManagerModal'))
const SettingsPanel = lazy(() => import('./kanban/SettingsPanel'))
const DepartmentSettingsModal = lazy(() => import('./kanban/DepartmentSettingsModal'))
const MembersManagerPanel = lazy(() => import('./kanban/MembersManagerPanel'))
const MyProfilePanel = lazy(() => import('./kanban/MyProfilePanel'))
import AddTicketModal from './kanban/AddTicketModal'
import FilterPopoverContent from './kanban/FilterPopoverContent'
import ActiveFiltersChips from './kanban/ActiveFiltersChips'
import MoreActionsMenu from './kanban/MoreActionsMenu'
import DepartmentSwitcher from './kanban/DepartmentSwitcher'
import ViewSwitcher, { type WorkView } from './workspace/ViewSwitcher'
import Popover from './ui/Popover'
import { DroppableColumn, SortableCard, SortableBoardColumn } from './kanban/DndComponents'
import { useOrg } from '../lib/orgContext'
import { useSearch } from './SearchContext'
import { logger } from '../lib/logger'
import { fetchAutoRules } from '../lib/api/templates'
import { useKanbanFilters } from '../hooks/useKanbanFilters'
import { useKanbanWallpaper } from '../hooks/useKanbanWallpaper'
import { useKanbanPresence } from '../hooks/useKanbanPresence'
import { useKanbanMembers } from '../hooks/useKanbanMembers'
import { useBoardScrollDrag } from '../hooks/useBoardScrollDrag'
import { useKanbanColumnsCRUD } from '../hooks/useKanbanColumnsCRUD'
import { useKanbanBulkActions } from '../hooks/useKanbanBulkActions'
import { useKanbanRealtime } from '../hooks/useKanbanRealtime'

interface KanbanBoardProps {
  user: string
  openTicketId?: string | null
  clearOpenTicketId?: () => void
  view: WorkView
  onChangeView: (view: WorkView) => void
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

// DroppableColumn, SortableCard e SortableBoardColumn extraídos para ./kanban/DndComponents.tsx

export default function KanbanBoard({ user, openTicketId, clearOpenTicketId, view, onChangeView }: KanbanBoardProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)
  const [overCardId, setOverCardId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMyProfile, setShowMyProfile] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const showToast = useCallback((msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set())
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [showMembersPanel, setShowMembersPanel] = useState(false)
  const [addingTo, setAddingTo] = useState<TicketStatus | null>(null)
  const [inlineTitle, setInlineTitle] = useState('')
  const [showInstanceModal, setShowInstanceModal] = useState(false)
  const [showArchivedPanel, setShowArchivedPanel] = useState(false)
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [boardLabels, setBoardLabels] = useState<BoardLabel[]>([])
  const [showLabelsManager, setShowLabelsManager] = useState(false)
  // Label editing state moved to LabelsManagerModal
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => (localStorage.getItem('chatpro-view-mode') as 'kanban' | 'list') || 'kanban')
  const [groupBy, setGroupBy] = useState<GroupByMode>(() => (localStorage.getItem('chatpro-group-by') as GroupByMode) || 'none')
  useEffect(() => { localStorage.setItem('chatpro-group-by', groupBy) }, [groupBy])
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set())
  const [compactMode, setCompactMode] = useState<boolean>(() => localStorage.getItem('chatpro-compact-mode') === 'true')
  const [showShortcutsHelp, openShortcutsHelp, closeShortcutsHelp] = useShortcutsHelp()
  const [showAutoRules, setShowAutoRules] = useState(false)
  const [showMembersManager, setShowMembersManager] = useState(false)
  const [showDeptSettings, setShowDeptSettings] = useState(false)
  const { departmentId, organizationId, role: userRole, hasPermission } = useOrg()
  const isAdmin = userRole === 'admin'
  const canManageColumns = hasPermission('columns:manage')

  const applyAutoRules = useCallback(async () => {
    try {
      const rules = (await fetchAutoRules(user, departmentId)).filter(r => r.enabled)
      if (!rules.length) { showToast('Nenhuma regra ativa configurada.', 'ok'); return }
      const now = Date.now()
      const toMove: { id: string; newStatus: TicketStatus }[] = []
      for (const ticket of tickets.filter(t => !t.is_archived)) {
        for (const rule of rules) {
          if (ticket.status === rule.targetColumn) continue
          const idleH = (now - new Date(ticket.updated_at).getTime()) / 3_600_000
          let matches = false
          switch (rule.condition) {
            case 'priority_high':   matches = ticket.priority === 'high'; break
            case 'priority_medium': matches = ticket.priority === 'medium'; break
            case 'priority_low':    matches = ticket.priority === 'low'; break
            case 'no_assignee':     matches = !ticket.assignee?.trim(); break
            case 'overdue_12h':     matches = !ticket.is_completed && idleH >= 12; break
            case 'overdue_24h':     matches = !ticket.is_completed && idleH >= 24; break
          }
          if (matches) { toMove.push({ id: ticket.id, newStatus: rule.targetColumn as TicketStatus }); break }
        }
      }
      if (!toMove.length) { showToast('Nenhum ticket para mover.', 'ok'); return }
      setTickets(prev => prev.map(t => {
        const move = toMove.find(m => m.id === t.id)
        return move ? { ...t, status: move.newStatus } : t
      }))
      await Promise.all(toMove.map(m => updateTicket(m.id, { status: m.newStatus })))
      showToast(`${toMove.length} ticket(s) movido(s) pelas regras.`, 'ok')
    } catch (err) {
      logger.error('KanbanBoard', 'Falha ao aplicar regras', { error: String(err) })
      showToast('Erro ao aplicar regras automáticas.', 'err')
    }
  }, [tickets, user, departmentId, setTickets, showToast])
  const dragOriginalStatusRef = useRef<string | null>(null)

  // Hooks extraídos
  const { onlineUsers } = useKanbanPresence(user)
  const { allMembers, memberRoles } = useKanbanMembers(organizationId)
  const { scrollerRef, handleBoardMouseDown, handleBoardMouseMove, stopBoardDrag } = useBoardScrollDrag()
  const {
    columns, setColumns,
    columnOrder, setColumnOrder,
    allColumns, allColumnsById, columnIds,
    editingColumnId, setEditingColumnId,
    editingColumnTitle, setEditingColumnTitle,
    colorPickerColumnId, setColorPickerColumnId,
    colorPickerPos, setColorPickerPos,
    colMenuView, setColMenuView,
    handleSaveColumnTitle, handleSaveColumnColor, handleSortColumn,
    COL_COLORS,
  } = useKanbanColumnsCRUD({ departmentId, showToast, setTickets })
  const {
    bulkMode, setBulkMode,
    selectedCardIds, setSelectedCardIds,
    toggleBulkSelect, handleBulkMove, handleBulkArchive,
    handleBulkAssign, handleBulkPriority,
  } = useKanbanBulkActions({ showToast, setTickets })

  // Filtros + busca (full-text server-side com fallback local) extraídos para hook
  const {
    searchQuery, setSearchQuery,
    showFilters: showFiltersPopover, setShowFilters: setShowFiltersPopover,
    filterPriority, setFilterPriority,
    filterAssignee, setFilterAssignee,
    filterLabel, setFilterLabel,
    serverSearchResults,
    searchLoading,
    getColumnTickets: getFilteredTicketsByStatus,
    activeFilterCount,
    uniqueAssignees,
    uniqueLabels,
    clearAllFilters,
  } = useKanbanFilters({ tickets, allMembers })

  // Busca centralizada no AppHeader: sincroniza valor + estado para o input global.
  const {
    query: globalSearchQuery,
    setQuery: setGlobalSearchQuery,
    setLoading: setGlobalSearchLoading,
    setResultsCount: setGlobalSearchResultsCount,
    focusInput: focusGlobalSearch,
  } = useSearch()
  useEffect(() => {
    if (globalSearchQuery !== searchQuery) setSearchQuery(globalSearchQuery)
  }, [globalSearchQuery, searchQuery, setSearchQuery])
  useEffect(() => {
    setGlobalSearchLoading(searchLoading)
  }, [searchLoading, setGlobalSearchLoading])
  useEffect(() => {
    if (!searchQuery.trim()) setGlobalSearchResultsCount(null)
    else setGlobalSearchResultsCount(serverSearchResults?.length ?? null)
  }, [searchQuery, serverSearchResults, setGlobalSearchResultsCount])
  useEffect(() => {
    return () => {
      setGlobalSearchQuery('')
      setGlobalSearchLoading(false)
      setGlobalSearchResultsCount(null)
    }
  }, [setGlobalSearchQuery, setGlobalSearchLoading, setGlobalSearchResultsCount])

  // Custom events disparados pelo AppHeader (UserMenu / botão Criar).
  useEffect(() => {
    const onAdd = () => setShowAddModal(true)
    const onSettings = () => setShowSettings(true)
    const onMyProfile = () => setShowMyProfile(true)
    const onArchived = () => setShowArchivedPanel(true)
    window.addEventListener('chatpro:open-add-ticket', onAdd)
    window.addEventListener('chatpro:open-settings', onSettings)
    window.addEventListener('chatpro:open-my-profile', onMyProfile)
    window.addEventListener('chatpro:open-archived', onArchived)
    return () => {
      window.removeEventListener('chatpro:open-add-ticket', onAdd)
      window.removeEventListener('chatpro:open-settings', onSettings)
      window.removeEventListener('chatpro:open-my-profile', onMyProfile)
      window.removeEventListener('chatpro:open-archived', onArchived)
    }
  }, [])

  // Wallpaper + uploads/gallery extraídos para hook
  const {
    wallpaper,
    wallpaperInput, setWallpaperInput,
    recentWallpapers,
    applyWallpaper,
    handleWallpaperFileSelect,
    removeRecentWallpaper,
    clearRecentWallpapers,
    deleteCurrentWallpaper,
  } = useKanbanWallpaper({ user, onToast: showToast })

  // --- Load tickets from Supabase ---
  const loadTickets = useCallback(async () => {
    try {
      const [data, attCounts] = await Promise.all([
        fetchTickets({ departmentId: departmentId ?? undefined }),
        fetchAttachmentCounts(departmentId ?? undefined),
      ])
      const loaded = data.map(t => ({ ...t, attachment_count: attCounts[t.id] || 0 }))
      setTickets(loaded)
    } catch (err) {
      logger.error('KanbanBoard', 'Falha ao carregar tickets', { error: String(err) })
      showToast('Erro ao carregar tickets', 'err')
    }
  }, [departmentId, showToast])

  const { isConnected } = useKanbanRealtime({
    departmentId,
    setTickets,
    loadTickets,
    setLoading,
  })

  // Open a specific ticket when openTicketId is set (e.g. from Inbox notification)
  useEffect(() => {
    if (!openTicketId || tickets.length === 0) return
    const found = tickets.find(t => t.id === openTicketId)
    if (found) {
      setSelectedTicket(found)
      clearOpenTicketId?.()
    }
  }, [openTicketId, tickets, clearOpenTicketId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Alias mantendo o nome original usado no JSX
  const getColumnTickets = getFilteredTicketsByStatus

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

      const previousOrder = columnOrder
      const newOrder = arrayMove(previousOrder, oldIndex, newIndex)
      setColumnOrder(newOrder)

      // Persiste a nova posicao no banco para sobreviver ao F5.
      // Faz em duas etapas (offset + valor final) para evitar colisoes
      // caso exista uma constraint UNIQUE em (department_id, position).
      ;(async () => {
        try {
          const offset = newOrder.length + 100
          await Promise.all(newOrder.map((id, idx) => updateBoardColumn(id, { position: offset + idx })))
          await Promise.all(newOrder.map((id, idx) => updateBoardColumn(id, { position: idx })))
        } catch (error) {
          console.error('[KanbanBoard] Falha ao persistir reordenacao de colunas', error)
          setColumnOrder(previousOrder)
          showToast('Erro ao salvar nova ordem das colunas.', 'err')
        }
      })()
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
          insertActivityLog(activeId, user, `moveu este cartão de ${fromLabel} para ${toLabel}`, departmentId ?? undefined)
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

  const [inlineCreating, setInlineCreating] = useState(false)
  const handleInlineAdd = async (col: TicketStatus) => {
    if (!inlineTitle.trim()) return
    if (!departmentId) { showToast('Selecione um departamento antes de criar um cartão', 'err'); return }
    setInlineCreating(true)
    try {
      const created = await insertTicket({ department_id: departmentId, title: inlineTitle.trim(), description: '', status: col, priority: 'medium', assignee: user })
      setTickets(prev => prev.some(t => t.id === created.id) ? prev : [...prev, created])
      setInlineTitle('')
      setAddingTo(null)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar ticket', 'err')
    } finally {
      setInlineCreating(false)
    }
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadTickets()
    setRefreshing(false)
  }, [loadTickets])

  const staleCount = useMemo(() => {
    const validColIds = new Set(allColumns.map(c => c.id))
    const lastColId = allColumns[allColumns.length - 1]?.id
    return tickets.filter(t =>
      !t.is_archived &&
      !t.is_completed &&
      validColIds.has(t.status) &&   // ignora status órfãos (colunas removidas)
      t.status !== lastColId &&       // ignora última coluna (resolvida por posição)
      Date.now() - new Date(t.updated_at).getTime() > 12 * 60 * 60 * 1000
    ).length
  }, [tickets, allColumns])
  const visibleUsers = useMemo(() => onlineUsers.length > 0 ? onlineUsers : [user], [onlineUsers, user])

  const handleCardClick = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket)
  }, [])

  // ── Keyboard shortcuts ──
  const noModalOpen = !showAddModal && !selectedTicket && !showSettings && !showInstanceModal && !showArchivedPanel && !showLabelsManager && !showShortcutsHelp
  const shortcutActions = useMemo(() => [
    { key: 'n', description: 'Novo ticket', action: () => { if (noModalOpen) { setShowAddModal(true) } } },
    { key: 'f', description: 'Filtros avançados', action: () => { if (noModalOpen) setShowFiltersPopover(p => !p) } },
    { key: 'k', ctrl: true, description: 'Pesquisar', action: () => { focusGlobalSearch() } },
    { key: '/', description: 'Pesquisar', action: () => { if (noModalOpen) focusGlobalSearch() } },
    { key: 'r', description: 'Atualizar tickets', action: () => { if (noModalOpen) handleRefresh() } },
    { key: 'c', description: 'Modo compacto', action: () => { if (noModalOpen) { setCompactMode(p => { localStorage.setItem('chatpro-compact-mode', String(!p)); return !p }) } } },
    { key: '?', shift: true, description: 'Atalhos de teclado', action: () => openShortcutsHelp() },
    { key: 'Escape', description: 'Fechar modal/painel', action: () => {
      if (showShortcutsHelp) { closeShortcutsHelp(); return }
      if (showFiltersPopover) { setShowFiltersPopover(false); return }
      if (showAddModal) { setShowAddModal(false); return }
      if (selectedTicket) { setSelectedTicket(null); return }
      if (showSettings) { setShowSettings(false); return }
      if (showArchivedPanel) { setShowArchivedPanel(false); return }
    }},
  ], [noModalOpen, showAddModal, selectedTicket, showSettings, showFiltersPopover, showArchivedPanel, showShortcutsHelp, openShortcutsHelp, closeShortcutsHelp, handleRefresh, setShowFiltersPopover, focusGlobalSearch])

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

      {/* Toolbar consolidada — ViewSwitcher + alertas + ferramentas */}
      <header className="board-toolbar" role="banner" aria-label="Barra de ferramentas do quadro">
        <div className="board-toolbar__left">
          <ViewSwitcher active={view} onChange={onChangeView} />
          {staleCount > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.16 }}
              onClick={() => { setShowFiltersPopover(true) }}
              className="board-stale-chip"
              title="Tickets sem resposta há mais de 12 horas"
            >
              <Icon name="AlertTriangle" size={12} />
              <span><strong>{staleCount}</strong> sem resposta +12h</span>
            </motion.button>
          )}
        </div>

        <div className="board-toolbar__right">
          {isDevEnvironment && (
            <span className="board-dev-badge" title="Ambiente de desenvolvimento">
              <span className="board-dev-badge__dot" />
              DEV
            </span>
          )}

          <DepartmentSwitcher />

          <span className="board-toolbar__divider" aria-hidden="true" />

          <span
            className={clsx('board-toolbar__status', isConnected ? 'board-toolbar__status--ok' : 'board-toolbar__status--off')}
            title={isConnected ? 'Conectado ao tempo real' : 'Sem conexão com o tempo real'}
            aria-label={isConnected ? 'Conectado' : 'Desconectado'}
          />

          <GroupBySwitcher value={groupBy} onChange={setGroupBy} />

          <Popover
            open={showFiltersPopover}
            onClose={() => setShowFiltersPopover(false)}
            width={300}
            anchor={
              <button
                onClick={() => setShowFiltersPopover(p => !p)}
                className="trello-icon-btn"
                type="button"
                title="Filtros (F)"
                style={(showFiltersPopover || activeFilterCount > 0) ? { color: '#25D066', background: 'rgba(37,208,102,0.12)' } : undefined}
              >
                <Icon name="Filter" size={16} />
                {activeFilterCount > 0 && (
                  <span className="board-filter-badge">{activeFilterCount}</span>
                )}
              </button>
            }
          >
            <FilterPopoverContent
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
            />
          </Popover>

          <MoreActionsMenu
            onRefresh={handleRefresh}
            refreshing={refreshing}
            onShare={() => { navigator.clipboard.writeText(window.location.href); showToast('Link copiado!', 'ok') }}
            viewMode={viewMode}
            onChangeViewMode={(mode) => { setViewMode(mode); localStorage.setItem('chatpro-view-mode', mode) }}
            compactMode={compactMode}
            onToggleCompact={() => setCompactMode(p => { localStorage.setItem('chatpro-compact-mode', String(!p)); return !p })}
            bulkMode={bulkMode}
            onToggleBulk={() => { setBulkMode(p => !p); setSelectedCardIds(new Set()) }}
            onShowShortcuts={openShortcutsHelp}
            onOpenInstance={() => setShowInstanceModal(true)}
            collapseAllAvailable={viewMode === 'list'}
            allCollapsed={collapsedColumns.size === allColumns.length && allColumns.length > 0}
            onCollapseAll={() => setCollapsedColumns(new Set(allColumns.map(c => c.id)))}
            onExpandAll={() => setCollapsedColumns(new Set())}
          />

          <span className="board-toolbar__divider" aria-hidden="true" />

          <div className="flex -space-x-1.5 cursor-default" aria-label="Membros online">
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

          <div className="relative">
            <button
              onClick={() => setShowMembersPanel(p => !p)}
              className="trello-icon-btn"
              type="button"
              title="Ver membros"
            >
              <Icon name="Users" size={16} />
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
                                  {memberRoles.get(m.email) === 'admin' && <span className="members-panel__badge">Admin</span>}
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
                                  {memberRoles.get(m.email) === 'admin' && <span className="members-panel__badge">Admin</span>}
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
        </div>
      </header>

      <AnimatePresence>
        <ActiveFiltersChips
          key="active-filters"
          filterPriority={filterPriority}
          filterAssignee={filterAssignee}
          filterLabel={filterLabel}
          uniqueAssignees={uniqueAssignees}
          onClearPriority={() => setFilterPriority('all')}
          onClearAssignee={() => setFilterAssignee('all')}
          onClearLabel={() => setFilterLabel('all')}
          onClearAll={clearAllFilters}
        />
      </AnimatePresence>

      {showArchivedPanel && (
        <Suspense fallback={null}>
          <ArchivedPanel
            onClose={() => setShowArchivedPanel(false)}
            onRestore={() => { loadTickets(); setShowArchivedPanel(false) }}
          />
        </Suspense>
      )}

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
            <Icon name="Loader2" size={24} className="animate-spin" />
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
                                maxLength={30}
                                onChange={e => setEditingColumnTitle(e.target.value.slice(0, 30))}
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
                                onDoubleClick={e => {
                                  if (!canManageColumns) return
                                  e.stopPropagation()
                                  setEditingColumnId(col.id)
                                  setEditingColumnTitle(col.title)
                                }}
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
                                          <Icon name="Palette" size={14} />
                                          <span>Cor da lista</span>
                                        </button>
                                        <button className="col-menu__item" onClick={() => setColMenuView('sort')}>
                                          <Icon name="ArrowUpDown" size={14} />
                                          <span>Ordenar lista</span>
                                        </button>
                                        <div className="col-menu__sep" />
                                        <button className="col-menu__item" onClick={e => { e.stopPropagation(); setEditingColumnId(col.id); setEditingColumnTitle(col.title); setColorPickerColumnId(null) }}>
                                          <Icon name="Pencil" size={14} />
                                          <span>Renomear</span>
                                        </button>
                                        <button
                                          className="col-menu__item col-menu__item--danger"
                                          onClick={() => {
                                            if (!canManageColumns) {
                                              alert('Você não tem permissão para excluir listas')
                                              return
                                            }
                                            setColorPickerColumnId(null)
                                            if (colTickets.length > 0 && !confirm(`A lista "${col.title}" tem ${colTickets.length} cartão(s). Excluir mesmo assim?`)) return
                                            if (colTickets.length === 0 && !confirm(`Excluir a lista "${col.title}"?`)) return
                                            setColumns(prev => prev.filter(cc => cc.id !== col.id))
                                            setColumnOrder(prev => prev.filter(id => id !== col.id))
                                            setTickets(prev => prev.filter(t => t.status !== col.id))
                                            archiveBoardColumn(col.id).catch(() => {})
                                            showToast('Lista excluída', 'ok')
                                          }}
                                          disabled={!canManageColumns}
                                        >
                                          <Icon name="Trash2" size={14} />
                                          <span>Excluir lista</span>
                                        </button>
                                      </>
                                    )}

                                    {/* ── Color view ── */}
                                    {colMenuView === 'color' && (
                                      <>
                                        <div className="col-menu__header">
                                          <button className="col-menu__back" onClick={() => setColMenuView('main')}><Icon name="ChevronLeft" size={16} /></button>
                                          <span>Cor da lista</span>
                                          <button className="col-menu__close" onClick={() => setColorPickerColumnId(null)}><Icon name="X" size={14} /></button>
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
                                          <button className="col-menu__back" onClick={() => setColMenuView('main')}><Icon name="ChevronLeft" size={16} /></button>
                                          <span>Ordenar lista</span>
                                          <button className="col-menu__close" onClick={() => setColorPickerColumnId(null)}><Icon name="X" size={14} /></button>
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
                                  {(() => {
                                    const groups = groupTickets(colTickets, groupBy, allMembers)
                                    const renderCard = (ticket: Ticket) => (
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
                                    )
                                    if (groupBy === 'none') return groups[0].tickets.map(renderCard)
                                    return groups.map(g => (
                                      <div key={g.key} style={{ marginBottom: 6 }}>
                                        <div style={{
                                          display: 'flex', alignItems: 'center', gap: 6,
                                          padding: '4px 6px 6px', fontSize: 10.5, fontWeight: 700,
                                          color: '#9FADBC', textTransform: 'uppercase',
                                          letterSpacing: '0.04em',
                                          fontFamily: "'Space Grotesk', sans-serif",
                                          borderTop: '1px dashed rgba(255,255,255,0.06)',
                                          marginTop: 4,
                                        }}>
                                          {g.color && (
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                                          )}
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{g.label}</span>
                                          <span style={{ color: '#596773', fontWeight: 600 }}>{g.tickets.length}</span>
                                        </div>
                                        {g.tickets.map(renderCard)}
                                      </div>
                                    ))
                                  })()}
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
                                <button onClick={() => handleInlineAdd(col.id as TicketStatus)} disabled={inlineCreating} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white flex items-center gap-1" style={{ background: inlineCreating ? 'rgba(37,208,102,0.5)' : '#25D066', cursor: inlineCreating ? 'wait' : 'pointer' }}>
                                  {inlineCreating && <Icon name="Loader2" size={13} className="animate-spin" />}
                                  {inlineCreating ? 'Criando...' : 'Adicionar'}
                                </button>
                                <button onClick={() => { setAddingTo(null); setInlineTitle('') }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><Icon name="X" size={16} style={{ color: 'var(--text-muted)' }} /></button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setAddingTo(col.id as TicketStatus); setInlineTitle('') }} className="trello-col__add" {...(colIdx === 0 ? { 'data-tour': 'board-add-ticket' } : {})}>
                              <Icon name="Plus" size={16} /> Adicionar um cartão
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
            {!canManageColumns ? null : addingList ? (
              <div className="add-list-form">
                <input
                  autoFocus
                  value={newListName}
                  onChange={e => setNewListName(e.target.value.slice(0, 30))}
                  placeholder="Nome da lista..."
                  maxLength={30}
                  className="instance-modal__input text-sm"
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && newListName.trim()) {
                      let col: BoardColumn
                      try {
                        col = await insertBoardColumn(newListName.trim(), columns.length, '#579dff', departmentId ?? undefined)
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
                        col = await insertBoardColumn(newListName.trim(), columns.length, '#579dff', departmentId ?? undefined)
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
                  <button onClick={() => { setAddingList(false); setNewListName('') }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><Icon name="X" size={16} style={{ color: 'var(--text-muted)' }} /></button>
                </div>
              </div>
            ) : (
              <div className="add-list-ghost" onClick={() => setAddingList(true)}>
                <Icon name="Plus" size={16} />
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
              <Icon name="Loader2" size={24} className="animate-spin" />
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
                        <Icon name="ChevronRight" size={16} style={{ color: '#25D066' }} />
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
                                // Tickets resolvidos: trava o relógio na data de conclusão (updated_at)
                                // e nunca fica vermelho (isOverdue = false), mostrando apenas o tempo total.
                                const endTs = ticket.is_completed && ticket.updated_at
                                  ? new Date(ticket.updated_at).getTime()
                                  : Date.now()
                                const diffMs = endTs - new Date(ticket.created_at).getTime()
                                const diffMin = Math.floor(diffMs / 60_000)
                                const diffH = Math.floor(diffMs / 3_600_000)
                                const diffD = Math.floor(diffMs / 86_400_000)
                                if (diffMin < 60) return { label: `${Math.max(diffMin, 1)}m`, isOverdue: false }
                                if (diffH < 24) return { label: `${diffH}h`, isOverdue: !ticket.is_completed && diffH >= 2 }
                                return { label: `${diffD}d`, isOverdue: !ticket.is_completed }
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
                                    {ticket.is_completed && <Icon name="Check" size={10} strokeWidth={3} color="#fff" />}
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
                                          <Icon name="Clock" size={11} />
                                          {elapsed.label}
                                        </span>
                                      )}
                                      {createdDate && (
                                        <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3, color: '#596773' }}>
                                          <Icon name="Calendar" size={11} />
                                          {createdDate}
                                        </span>
                                      )}
                                      {hasDesc && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', color: '#596773' }} title="Tem descrição">
                                          <Icon name="AlignLeft" size={11} />
                                        </span>
                                      )}
                                      {attCount > 0 && (
                                        <span style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3, color: '#596773' }} title={`${attCount} anexo(s)`}>
                                          <Icon name="Paperclip" size={11} />
                                          {attCount}
                                        </span>
                                      )}
                                      {hasChecklist && (
                                        <span style={{
                                          fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3,
                                          color: checkDone === checkTotal ? '#25D066' : '#596773',
                                          fontWeight: checkDone === checkTotal ? 700 : 500,
                                        }} title={`Checklist: ${checkDone}/${checkTotal}`}>
                                          <Icon name="CheckSquare" size={11} />
                                          {checkDone}/{checkTotal}
                                        </span>
                                      )}
                                      {ticket.instancia && (
                                        <span style={{ fontSize: 11, color: '#596773', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                          <Icon name="Plug" size={10} />
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
                                    {isAdmin && (
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
                                        <Icon name="Archive" size={13} />
                                      </button>
                                    )}
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
                                      <Icon name="Pencil" size={13} />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}

                            {/* Inline add card */}
                            {addingTo === col.id ? (
                              <div style={{ padding: '8px 12px 10px' }}>
                                <textarea
                                  autoFocus
                                  value={inlineTitle}
                                  onChange={e => setInlineTitle(e.target.value)}
                                  placeholder="Insira um título para este cartão..."
                                  rows={3}
                                  className="w-full rounded-lg p-2.5 text-sm resize-none outline-none"
                                  style={{ background: '#22272b', color: 'var(--text-primary)', border: '1px solid rgba(166,197,226,0.15)' }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInlineAdd(col.id as TicketStatus) }
                                    if (e.key === 'Escape') { setAddingTo(null); setInlineTitle('') }
                                  }}
                                />
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <button onClick={() => handleInlineAdd(col.id as TicketStatus)} disabled={inlineCreating} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white flex items-center gap-1" style={{ background: inlineCreating ? 'rgba(37,208,102,0.5)' : '#25D066', cursor: inlineCreating ? 'wait' : 'pointer' }}>
                                    {inlineCreating && <Icon name="Loader2" size={13} className="animate-spin" />}
                                    {inlineCreating ? 'Criando...' : 'Adicionar'}
                                  </button>
                                  <button onClick={() => { setAddingTo(null); setInlineTitle('') }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><Icon name="X" size={16} style={{ color: 'var(--text-muted)' }} /></button>
                                </div>
                              </div>
                            ) : (
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
                                <Icon name="Plus" size={14} />
                                Adicionar card
                              </button>
                            )}
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
              if (!departmentId) { showToast('Selecione um departamento antes de criar um cartão', 'err'); return }
              setCreatingTicket(true)
              try {
                const created = await insertTicket({ department_id: departmentId, title: ticket.title.trim(), description: ticket.description || '', status: ticket.status, priority: ticket.priority, cliente: ticket.cliente || '', instancia: ticket.instancia || '', assignee: user })
                if (ticket.pendingFiles?.length) {
                  for (const file of ticket.pendingFiles) {
                    const compressed = await compressAttachment(file)
                    await uploadAttachment(created.id, compressed, user, departmentId ?? undefined)
                  }
                }
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
          <Suspense fallback={null}>
            <SettingsPanel
              wallpaper={wallpaper}
              wallpaperInput={wallpaperInput}
              recentWallpapers={recentWallpapers}
              onWallpaperInputChange={setWallpaperInput}
              onApplyWallpaper={applyWallpaper}
              onWallpaperFileSelect={handleWallpaperFileSelect}
              onRemoveRecentWallpaper={removeRecentWallpaper}
              onClearRecentWallpapers={clearRecentWallpapers}
              onDeleteCurrentWallpaper={deleteCurrentWallpaper}
              onOpenLabelsManager={() => { setShowLabelsManager(true); fetchBoardLabels(departmentId ?? undefined).then(setBoardLabels).catch(err => logger.error('KanbanBoard', 'Operação falhou', { error: String(err) })) }}
              userRole={userRole}
              onOpenAutoRules={() => setShowAutoRules(true)}
              onOpenMembersPanel={() => { setShowSettings(false); setShowMembersManager(true) }}
              onOpenDeptSettings={() => { setShowSettings(false); setShowDeptSettings(true) }}
              onClose={() => setShowSettings(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Department Settings Modal */}
      <AnimatePresence>
        {showDeptSettings && (
          <Suspense fallback={null}>
            <DepartmentSettingsModal
              onClose={() => setShowDeptSettings(false)}
              onShowToast={showToast}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Auto Rules Manager Modal */}
      <AnimatePresence>
        {showAutoRules && (
          <Suspense fallback={null}>
            <AutoRulesModal
              columns={allColumns}
              onClose={() => setShowAutoRules(false)}
              onRunRules={() => { setShowAutoRules(false); applyAutoRules() }}
              onShowToast={showToast}
              user={user}
              departmentId={departmentId}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Members Manager Panel */}
      <AnimatePresence>
        {showMembersManager && (
          <Suspense fallback={null}>
            <MembersManagerPanel onClose={() => setShowMembersManager(false)} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* My Profile Panel */}
      <AnimatePresence>
        {showMyProfile && (
          <Suspense fallback={null}>
            <MyProfilePanel onClose={() => setShowMyProfile(false)} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Labels Manager Modal */}
      {showLabelsManager && (
        <Suspense fallback={null}>
          <LabelsManagerModal
            boardLabels={boardLabels}
            departmentId={departmentId}
            onLabelsChange={setBoardLabels}
            onClose={() => setShowLabelsManager(false)}
          />
        </Suspense>
      )}

            {/* Card Detail Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <ErrorBoundary>
            <Suspense fallback={null}>
              <CardDetailModal
                ticket={selectedTicket}
                user={user}
                boardColumns={allColumns}
                onClose={() => {
                  setSelectedTicket(null)
                  // Recarregar contagem de anexos ao fechar o modal
                  fetchAttachmentCounts(departmentId ?? undefined).then(counts => {
                    setTickets(prev => prev.map(t => ({ ...t, attachment_count: counts[t.id] || 0 })))
                  })
                }}
                onUpdate={handleTicketUpdate}
                onDelete={handleTicketDelete}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Help Modal */}
      <AnimatePresence>
        {showShortcutsHelp && <ShortcutsHelpModal onClose={closeShortcutsHelp} />}
      </AnimatePresence>

      {/* Instance Configuration Modal */}
      {showInstanceModal && (
        <Suspense fallback={null}>
          <InstanceModal open={showInstanceModal} onClose={() => setShowInstanceModal(false)} user={user} />
        </Suspense>
      )}

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {bulkMode && selectedCardIds.size > 0 && (
          <BulkActionsBar
            selectedCount={selectedCardIds.size}
            columns={allColumns}
            members={allMembers}
            onMove={handleBulkMove}
            onArchive={handleBulkArchive}
            onAssign={handleBulkAssign}
            onPriority={handleBulkPriority}
            onCancel={() => { setSelectedCardIds(new Set()); setBulkMode(false) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
