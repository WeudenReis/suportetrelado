import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Filter, ArrowUp, ArrowDown, ArrowUpDown, X, RefreshCw, Loader2, Inbox } from 'lucide-react'
import { fetchTickets, fetchUserProfiles, type Ticket, type UserProfile } from '../../lib/supabase'
import { fetchBoardColumns, type BoardColumn } from '../../lib/boardColumns'
import { useOrg } from '../../lib/orgContext'
import { logger } from '../../lib/logger'

const CardDetailModal = lazy(() => import('../CardDetailModal'))

interface TableViewProps {
  user: string
  openTicketId: string | null
  onCloseTicket: () => void
  onOpenTicket: (id: string) => void
}

type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'cliente' | 'due_date' | 'created_at'
type SortDir = 'asc' | 'desc'

interface SortState {
  key: SortKey
  dir: SortDir
}

const PRIORITY_LABEL: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' }
const PRIORITY_COLOR: Record<string, string> = { high: '#ef5c48', medium: '#F5A623', low: '#25D066' }

const ROW_HEIGHT = 48
const HEADER_HEIGHT = 38
const FONT = "'Space Grotesk', sans-serif"

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function isOverdue(due?: string | null): boolean {
  if (!due) return false
  const d = new Date(due)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' })
}

function priorityRank(p?: string | null): number {
  if (p === 'high') return 0
  if (p === 'medium') return 1
  if (p === 'low') return 2
  return 3
}

export default function TableView({ user, openTicketId, onCloseTicket, onOpenTicket }: TableViewProps) {
  const { departmentId } = useOrg()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [sort, setSort] = useState<SortState>({ key: 'created_at', dir: 'desc' })

  const scrollerRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [t, p, c] = await Promise.all([
        fetchTickets({ departmentId: departmentId ?? undefined }),
        fetchUserProfiles(),
        fetchBoardColumns(departmentId ?? undefined),
      ])
      setTickets(t.filter(tk => !tk.is_archived))
      setProfiles(p)
      setColumns(c)
    } catch (err) {
      logger.error('TableView', 'Falha ao carregar dados', { error: String(err) })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [departmentId])

  useEffect(() => { loadData() }, [loadData])

  const columnsById = useMemo(() => {
    const map = new Map<string, BoardColumn>()
    columns.forEach(c => map.set(c.id, c))
    return map
  }, [columns])

  const uniqueAssignees = useMemo(() => {
    const seen = new Map<string, string>()
    for (const t of tickets) {
      if (!t.assignee) continue
      t.assignee.split(',').map(s => s.trim()).filter(Boolean).forEach(raw => {
        const member = profiles.find(m => m.email === raw || m.name === raw)
        const key = member?.email || raw.toLowerCase()
        if (!seen.has(key)) seen.set(key, member?.name || raw)
      })
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [tickets, profiles])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets.filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false
      if (filterAssignee !== 'all') {
        if (filterAssignee === '__none__') {
          if (t.assignee) return false
        } else {
          const parts = (t.assignee ?? '').split(',').map(s => s.trim().toLowerCase())
          if (!parts.includes(filterAssignee.toLowerCase())) return false
        }
      }
      if (q) {
        const haystack = [t.title, t.description, t.cliente, t.assignee, t.tags?.join(' ')]
          .filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [tickets, search, filterStatus, filterPriority, filterAssignee])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    const dir = sort.dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      if (sort.key === 'priority') {
        return (priorityRank(a.priority) - priorityRank(b.priority)) * dir
      }
      if (sort.key === 'status') {
        const at = columnsById.get(a.status)?.title ?? a.status
        const bt = columnsById.get(b.status)?.title ?? b.status
        return compareValues(at, bt) * dir
      }
      if (sort.key === 'due_date' || sort.key === 'created_at') {
        const av = a[sort.key] ? new Date(a[sort.key] as string).getTime() : 0
        const bv = b[sort.key] ? new Date(b[sort.key] as string).getTime() : 0
        return (av - bv) * dir
      }
      return compareValues(a[sort.key], b[sort.key]) * dir
    })
    return arr
  }, [filtered, sort, columnsById])

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  const toggleSort = useCallback((key: SortKey) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }, [])

  const activeFilterCount = (filterStatus !== 'all' ? 1 : 0) + (filterPriority !== 'all' ? 1 : 0) + (filterAssignee !== 'all' ? 1 : 0)

  const clearFilters = () => {
    setFilterStatus('all'); setFilterPriority('all'); setFilterAssignee('all')
  }

  const handleTicketUpdate = (updated: Ticket) => {
    setTickets(prev => prev.map(t => t.id === updated.id ? { ...updated, attachment_count: t.attachment_count } : t))
  }

  const handleTicketDelete = (id: string) => {
    setTickets(prev => prev.filter(t => t.id !== id))
    onCloseTicket()
  }

  const openTicket = openTicketId ? tickets.find(t => t.id === openTicketId) : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#1d2125' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#596773' }} />
          <input
            type="text"
            placeholder="Buscar por título, descrição, cliente, tags…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#E5E7EB', fontFamily: FONT, fontSize: 13, outline: 'none',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,208,102,0.45)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
          />
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Filter size={13} style={{ color: '#596773' }} />
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            options={[{ value: 'all', label: 'Todas as colunas' }, ...columns.map(c => ({ value: c.id, label: c.title }))]}
          />
          <Select
            value={filterPriority}
            onChange={setFilterPriority}
            options={[
              { value: 'all', label: 'Todas prioridades' },
              { value: 'high', label: 'Alta' },
              { value: 'medium', label: 'Média' },
              { value: 'low', label: 'Baixa' },
            ]}
          />
          <Select
            value={filterAssignee}
            onChange={setFilterAssignee}
            options={[
              { value: 'all', label: 'Todos responsáveis' },
              { value: '__none__', label: 'Sem responsável' },
              ...uniqueAssignees,
            ]}
          />
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 6,
                background: 'rgba(37,208,102,0.10)', border: '1px solid rgba(37,208,102,0.25)',
                color: '#25D066', fontSize: 11, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
              }}
            >
              <X size={11} /> Limpar ({activeFilterCount})
            </button>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Contador + refresh */}
        <span style={{ fontSize: 11, color: '#8C96A3', fontFamily: FONT, fontWeight: 500 }}>
          {sorted.length} de {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
        </span>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          title="Atualizar"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 6,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#8C96A3', cursor: refreshing ? 'wait' : 'pointer',
          }}
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Header da tabela */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 2.5fr) 160px 100px 160px 140px 110px 110px',
        alignItems: 'center',
        gap: 0,
        height: HEADER_HEIGHT,
        padding: '0 18px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(34,39,43,0.7)',
        position: 'sticky', top: 0, zIndex: 2,
        fontFamily: FONT, fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8C96A3',
      }}>
        <SortHeader label="Título" sortKey="title" sort={sort} onClick={toggleSort} />
        <SortHeader label="Coluna" sortKey="status" sort={sort} onClick={toggleSort} />
        <SortHeader label="Prioridade" sortKey="priority" sort={sort} onClick={toggleSort} />
        <SortHeader label="Responsável" sortKey="assignee" sort={sort} onClick={toggleSort} />
        <SortHeader label="Cliente" sortKey="cliente" sort={sort} onClick={toggleSort} />
        <SortHeader label="Vencimento" sortKey="due_date" sort={sort} onClick={toggleSort} />
        <SortHeader label="Criado" sortKey="created_at" sort={sort} onClick={toggleSort} />
      </div>

      {/* Body */}
      <div ref={scrollerRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: '#596773' }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState hasFilters={activeFilterCount > 0 || search.length > 0} onClear={() => { clearFilters(); setSearch('') }} />
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map(vrow => {
              const t = sorted[vrow.index]
              const col = columnsById.get(t.status)
              const overdue = isOverdue(t.due_date)
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => onOpenTicket(t.id)}
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    transform: `translateY(${vrow.start}px)`,
                    height: ROW_HEIGHT,
                    display: 'grid',
                    gridTemplateColumns: 'minmax(280px, 2.5fr) 160px 100px 160px 140px 110px 110px',
                    alignItems: 'center',
                    gap: 0,
                    padding: '0 18px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    fontFamily: FONT,
                    fontSize: 13,
                    color: '#E5E7EB',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Título */}
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 16, fontWeight: 600 }}>
                    {t.is_completed && <span style={{ color: '#25D066', marginRight: 6 }}>✓</span>}
                    {t.title}
                  </div>

                  {/* Coluna */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 12 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: col?.dot_color || '#596773', flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 12, color: '#b6c2cf', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {col?.title || t.status}
                    </span>
                  </div>

                  {/* Prioridade */}
                  <div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '2px 8px', borderRadius: 4,
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                      color: PRIORITY_COLOR[t.priority] || '#8C96A3',
                      background: `${PRIORITY_COLOR[t.priority] || '#596773'}1A`,
                      border: `1px solid ${PRIORITY_COLOR[t.priority] || '#596773'}40`,
                    }}>
                      {PRIORITY_LABEL[t.priority] || '—'}
                    </span>
                  </div>

                  {/* Responsável */}
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: t.assignee ? '#b6c2cf' : '#596773', paddingRight: 12 }}>
                    {t.assignee || '—'}
                  </div>

                  {/* Cliente */}
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: t.cliente ? '#b6c2cf' : '#596773', paddingRight: 12 }}>
                    {t.cliente || '—'}
                  </div>

                  {/* Vencimento */}
                  <div style={{ fontSize: 12, color: overdue ? '#ef5c48' : (t.due_date ? '#b6c2cf' : '#596773'), fontWeight: overdue ? 700 : 500 }}>
                    {formatDate(t.due_date)}
                  </div>

                  {/* Criado em */}
                  <div style={{ fontSize: 12, color: '#8C96A3' }}>
                    {formatDate(t.created_at)}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {openTicket && (
          <Suspense fallback={null}>
            <CardDetailModal
              ticket={openTicket}
              user={user}
              onClose={onCloseTicket}
              onUpdate={handleTicketUpdate}
              onDelete={handleTicketDelete}
              boardColumns={columns}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Sub-componentes ──────────────────────────────────────────── */

function SortHeader({ label, sortKey, sort, onClick }: {
  label: string; sortKey: SortKey; sort: SortState; onClick: (k: SortKey) => void
}) {
  const isActive = sort.key === sortKey
  return (
    <button
      onClick={() => onClick(sortKey)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'transparent', border: 'none',
        color: isActive ? '#E5E7EB' : '#8C96A3',
        fontFamily: FONT, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        cursor: 'pointer', padding: '4px 0',
        textAlign: 'left',
      }}
    >
      {label}
      {isActive
        ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
        : <ArrowUpDown size={11} style={{ opacity: 0.4 }} />}
    </button>
  )
}

interface SelectOption { value: string; label: string }

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: SelectOption[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '6px 10px', borderRadius: 6,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#b6c2cf', fontFamily: FONT, fontSize: 12, outline: 'none', cursor: 'pointer',
        maxWidth: 180,
      }}
    >
      {options.map(opt => <option key={opt.value} value={opt.value} style={{ background: '#22272B', color: '#E5E7EB' }}>{opt.label}</option>)}
    </select>
  )
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 80, color: '#596773', textAlign: 'center', gap: 12,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'rgba(255,255,255,0.03)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#596773',
      }}>
        <Inbox size={26} strokeWidth={1.5} />
      </div>
      <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: '#8C96A3', margin: 0 }}>
        {hasFilters ? 'Nenhum ticket corresponde aos filtros' : 'Nenhum ticket por aqui ainda'}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          style={{
            padding: '7px 14px', borderRadius: 8,
            background: 'rgba(37,208,102,0.10)', border: '1px solid rgba(37,208,102,0.30)',
            color: '#25D066', fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
          }}
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
