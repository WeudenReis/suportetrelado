import { useState, useMemo, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  Users, Columns3, Target, CalendarDays, Download, Filter,
  SortAsc, ArrowUpRight, ShieldAlert, Activity, Inbox,
} from 'lucide-react'
import type { Ticket, UserProfile } from '../lib/supabase'
import type { BoardColumn } from '../lib/boardColumns'

const font = "'Space Grotesk', sans-serif"
const fontH = "'Paytone One', sans-serif"

const PRIORITY_C: Record<string, string> = { high: '#ef5c48', medium: '#e2b203', low: '#4bce97' }
const PRIORITY_L: Record<string, string> = { high: 'ALTA', medium: 'MÉDIA', low: 'BAIXA' }
const STATUS_C: Record<string, string> = {
  backlog: '#579dff', in_progress: '#e2b203', waiting_devs: '#f5a623', resolved: '#4bce97',
}
const STATUS_L: Record<string, string> = {
  backlog: 'Backlog', in_progress: 'Em Progresso', waiting_devs: 'Aguardando Devs', resolved: 'Resolvido',
}

// ── helpers ──────────────────────────────────────────────
function avatarColor(n: string) {
  const colors = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899']
  return colors[n.charCodeAt(0) % colors.length]
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

// ── sub-components ────────────────────────────────────────
function BigKPI({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 14, padding: '16px 18px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${color}22`,
      display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: font }}>{label}</span>
      </div>
      <p style={{ fontSize: 32, fontWeight: 900, color, margin: 0, fontFamily: fontH, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#6B7A8D', margin: 0, fontFamily: font }}>{sub}</p>}
    </div>
  )
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 110, fontSize: 12, color: '#8C96A3', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{label}</span>
      <div style={{ flex: 1, height: 22, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
        <div style={{
          height: '100%', borderRadius: 6, transition: 'width 0.6s ease',
          width: `${Math.max(pct, 2)}%`, background: color,
          display: 'flex', alignItems: 'center', paddingLeft: 8,
        }}>
          {pct > 12 && <span style={{ fontSize: 10, fontWeight: 700, color: '#000', fontFamily: font }}>{value}</span>}
        </div>
      </div>
      {pct <= 12 && <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: font, minWidth: 18 }}>{value}</span>}
    </div>
  )
}

// ── Main expanded panel ───────────────────────────────────
interface DashboardExpandedProps {
  tickets: Ticket[]
  profiles: UserProfile[]
  columns: BoardColumn[]
  onClose: () => void
}

type DateRange = '7d' | '30d' | '90d' | 'all'
type SortKey = 'created_at' | 'priority' | 'status' | 'assignee'

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'all', label: 'Tudo' },
]

export default function DashboardExpanded({ tickets, profiles, columns, onClose }: DashboardExpandedProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'tickets' | 'team' | 'trends'>('overview')

  const active = useMemo(() => tickets.filter(t => !t.is_archived), [tickets])

  const cutoff = useMemo(() => {
    if (dateRange === 'all') return null
    const d = new Date()
    d.setDate(d.getDate() - parseInt(dateRange))
    return d.toISOString()
  }, [dateRange])

  const filtered = useMemo(() => {
    let t = active
    if (cutoff) t = t.filter(x => x.created_at >= cutoff!)
    if (filterStatus !== 'all') t = t.filter(x => x.status === filterStatus)
    if (filterPriority !== 'all') t = t.filter(x => x.priority === filterPriority)
    if (filterAssignee !== 'all') t = t.filter(x => (x.assignee || '').includes(filterAssignee))
    return t
  }, [active, cutoff, filterStatus, filterPriority, filterAssignee])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string = '', vb: string = ''
      if (sortKey === 'created_at') { va = a.created_at; vb = b.created_at }
      else if (sortKey === 'priority') {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
        va = String(order[a.priority] ?? 9); vb = String(order[b.priority] ?? 9)
      }
      else if (sortKey === 'status') { va = a.status; vb = b.status }
      else if (sortKey === 'assignee') { va = a.assignee || ''; vb = b.assignee || '' }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }, [filtered, sortKey, sortAsc])

  // KPIs
  const total = filtered.length
  const resolvedCount = filtered.filter(t => t.status === 'resolved').length
  const highCount = filtered.filter(t => t.priority === 'high').length
  const completedCount = filtered.filter(t => (t as any).is_completed).length
  const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 0
  const avgHours = useMemo(() => {
    const res = filtered.filter(t => t.status === 'resolved')
    if (!res.length) return 0
    const ms = res.reduce((s, t) => s + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()), 0)
    return Math.round(ms / res.length / 3_600_000)
  }, [filtered])
  const backlogCount = filtered.filter(t => t.status === 'backlog').length

  // Charts
  const statusDist = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of filtered) m[t.status] = (m[t.status] || 0) + 1
    return m
  }, [filtered])
  const maxStatus = Math.max(...Object.values(statusDist), 1)

  const priorityDist = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of filtered) m[t.priority] = (m[t.priority] || 0) + 1
    return m
  }, [filtered])
  const maxPriority = Math.max(...Object.values(priorityDist), 1)

  const memberDist = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of filtered) {
      (t.assignee ? t.assignee.split(',').map(s => s.trim()).filter(Boolean) : ['Sem responsável']).forEach(a => {
        m[a] = (m[a] || 0) + 1
      })
    }
    return Object.entries(m).sort(([, a], [, b]) => b - a)
  }, [filtered])
  const maxMember = Math.max(...memberDist.map(([, c]) => c), 1)

  // Trend: daily new tickets
  const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 14
  const trendData = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (days - 1 - i))
      const ds = d.toISOString().slice(0, 10)
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, count: active.filter(t => t.created_at.slice(0, 10) === ds).length }
    })
  }, [active, days])
  const maxTrend = Math.max(...trendData.map(d => d.count), 1)

  // Export
  const handleExport = useCallback(() => {
    const h = ['ID', 'Título', 'Status', 'Prioridade', 'Responsável', 'Cliente', 'Criado em', 'Atualizado em', 'Dias aberto']
    const rows = sorted.map(t => [
      t.id, `"${(t.title || '').replace(/"/g, '""')}"`,
      STATUS_L[t.status] || t.status, PRIORITY_L[t.priority] || t.priority,
      t.assignee || '', t.cliente || '', t.created_at,
      t.updated_at, daysBetween(t.created_at, t.updated_at),
    ])
    const csv = [h.join(','), ...rows.map(r => r.join(','))].join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })), download: `dashboard-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
  }, [sorted])

  const allAssignees = useMemo(() => {
    const set = new Set<string>()
    active.forEach(t => (t.assignee ? t.assignee.split(',').map(s => s.trim()).filter(Boolean) : []).forEach(a => set.add(a)))
    return Array.from(set).sort()
  }, [active])

  const TABS: { key: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Visão Geral', icon: <BarChart3 size={14} /> },
    { key: 'tickets',  label: `Tickets (${total})`, icon: <Inbox size={14} /> },
    { key: 'team',     label: 'Equipe', icon: <Users size={14} /> },
    { key: 'trends',   label: 'Tendências', icon: <TrendingUp size={14} /> },
  ]

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#13181e',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* ── MODAL HEADER ── */}
          <div style={{
            padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,208,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={18} color="#25D066" />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#E5E7EB', fontFamily: fontH }}>Dashboard Executivo</h2>
              <p style={{ margin: 0, fontSize: 11, color: '#596773', fontFamily: font }}>Visão analítica completa · {total} tickets no período</p>
            </div>

            {/* Date range filter */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3 }}>
              {DATE_RANGES.map(r => (
                <button key={r.key} onClick={() => setDateRange(r.key)} style={{
                  padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: font,
                  fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                  background: dateRange === r.key ? '#25D066' : 'transparent',
                  color: dateRange === r.key ? '#000' : '#8C96A3',
                }}>
                  {r.label}
                </button>
              ))}
            </div>

            {/* Export */}
            <button onClick={handleExport} title="Exportar CSV" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9,
              background: 'rgba(37,208,102,0.08)', border: '1px solid rgba(37,208,102,0.2)',
              color: '#25D066', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: font,
            }}>
              <Download size={13} /> Exportar CSV
            </button>

            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'transparent', color: '#596773', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#B6C2CF' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* ── TABS ── */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', flexShrink: 0 }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px 14px', border: 'none',
                background: 'transparent', cursor: 'pointer', position: 'relative', fontFamily: font,
                fontSize: 12, fontWeight: 600, color: activeTab === tab.key ? '#25D066' : '#8C96A3',
                transition: 'color 0.15s',
              }}>
                {tab.icon}{tab.label}
                {activeTab === tab.key && (
                  <motion.div layoutId="dash-tab-ind" style={{
                    position: 'absolute', bottom: -1, left: 0, right: 0, height: 2,
                    background: '#25D066', borderRadius: 1,
                  }} />
                )}
              </button>
            ))}
          </div>

          {/* ── FILTERS ROW ── */}
          <div style={{
            display: 'flex', gap: 8, padding: '12px 24px', alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0,
          }}>
            <Filter size={13} color="#596773" />
            <span style={{ fontSize: 11, color: '#596773', fontFamily: font, marginRight: 4 }}>Filtrar:</span>

            {/* Status */}
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
              background: '#252c33', border: '1px solid rgba(255,255,255,0.08)', color: '#B6C2CF',
              borderRadius: 7, padding: '5px 10px', fontSize: 11, fontFamily: font, cursor: 'pointer', outline: 'none',
            }}>
              <option value="all">Todos status</option>
              {Object.entries(STATUS_L).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            {/* Priority */}
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{
              background: '#252c33', border: '1px solid rgba(255,255,255,0.08)', color: '#B6C2CF',
              borderRadius: 7, padding: '5px 10px', fontSize: 11, fontFamily: font, cursor: 'pointer', outline: 'none',
            }}>
              <option value="all">Todas prioridades</option>
              {Object.entries(PRIORITY_L).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            {/* Assignee */}
            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{
              background: '#252c33', border: '1px solid rgba(255,255,255,0.08)', color: '#B6C2CF',
              borderRadius: 7, padding: '5px 10px', fontSize: 11, fontFamily: font, cursor: 'pointer', outline: 'none',
            }}>
              <option value="all">Todos responsáveis</option>
              {allAssignees.map(a => <option key={a} value={a}>{a.split('@')[0]}</option>)}
            </select>

            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: '#596773', fontFamily: font }}>{total} resultados</span>

            {(filterStatus !== 'all' || filterPriority !== 'all' || filterAssignee !== 'all') && (
              <button onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setFilterAssignee('all') }} style={{
                fontSize: 11, color: '#ef5c48', background: 'rgba(239,92,72,0.08)', border: 'none',
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: font,
              }}>
                Limpar filtros
              </button>
            )}
          </div>

          {/* ── CONTENT ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }} className="inbox-scroll">

            {/* ═══════ OVERVIEW TAB ═══════ */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* KPI Row */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <BigKPI icon={<Activity size={14} />}   label="Total tickets"   value={total}      color="#25D066"  sub={`${backlogCount} em backlog`} />
                  <BigKPI icon={<ShieldAlert size={14} />} label="Alta prioridade" value={highCount}   color="#ef5c48"  sub="tickets urgentes" />
                  <BigKPI icon={<CheckCircle2 size={14} />} label="Taxa resolução" value={`${resolutionRate}%`} color="#4bce97" sub={`${resolvedCount} resolvidos`} />
                  <BigKPI icon={<Clock size={14} />}       label="Tempo médio"     value={`${avgHours}h`}  color="#e2b203"  sub="para resolver" />
                  <BigKPI icon={<Target size={14} />}      label="Concluídos"      value={completedCount} color="#a259ff" sub={`de ${total} tickets`} />
                </div>

                {/* Charts Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                  {/* Por Status */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
                    <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7A8D', fontFamily: font, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Columns3 size={12} /> Status do pipeline
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {Object.entries(STATUS_L).map(([k, v]) => (
                        <HBar key={k} label={v} value={statusDist[k] || 0} max={maxStatus} color={STATUS_C[k] || '#579dff'} />
                      ))}
                    </div>
                  </div>

                  {/* Por Prioridade */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
                    <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7A8D', fontFamily: font, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={12} /> Distribuição de prioridades
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {Object.entries(PRIORITY_L).map(([k, v]) => (
                        <HBar key={k} label={v} value={priorityDist[k] || 0} max={maxPriority} color={PRIORITY_C[k] || '#579dff'} />
                      ))}
                    </div>
                    {/* Donut-style text summary */}
                    <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-around' }}>
                      {Object.entries(PRIORITY_L).map(([k, v]) => {
                        const count = priorityDist[k] || 0
                        const pct = total > 0 ? Math.round(count / total * 100) : 0
                        return (
                          <div key={k} style={{ textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: PRIORITY_C[k], fontFamily: fontH }}>{pct}%</p>
                            <p style={{ margin: 0, fontSize: 10, color: '#6B7A8D', fontFamily: font }}>{v}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Por Responsável */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
                    <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7A8D', fontFamily: font, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} /> Carga por responsável
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {memberDist.slice(0, 8).map(([name, count]) => (
                        <HBar key={name} label={name.split('@')[0]} value={count} max={maxMember} color={name === 'Sem responsável' ? '#596773' : '#25D066'} />
                      ))}
                      {memberDist.length === 0 && <p style={{ fontSize: 11, color: '#596773', fontFamily: font }}>Sem dados</p>}
                    </div>
                  </div>

                  {/* Coluna */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
                    <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7A8D', fontFamily: font, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Columns3 size={12} /> Tickets por coluna do board
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {columns.map(col => {
                        const count = active.filter(t => t.status === col.id).length
                        const pct = active.length > 0 ? Math.round(count / active.length * 100) : 0
                        return (
                          <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: col.dot_color || '#579dff' }} />
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#E5E7EB', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.title}</span>
                            <span style={{ fontSize: 11, color: '#6B7A8D', fontFamily: font }}>{pct}%</span>
                            <span style={{ fontSize: 14, fontWeight: 900, color: count > 0 ? '#25D066' : '#454F59', fontFamily: fontH, minWidth: 24, textAlign: 'right' }}>{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ TICKETS TAB ═══════ */}
            {activeTab === 'tickets' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Sort */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <SortAsc size={13} color="#596773" />
                  <span style={{ fontSize: 11, color: '#596773', fontFamily: font }}>Ordenar por:</span>
                  {(['created_at', 'priority', 'status', 'assignee'] as SortKey[]).map(k => {
                    const labels: Record<SortKey, string> = { created_at: 'Data', priority: 'Prioridade', status: 'Status', assignee: 'Responsável' }
                    return (
                      <button key={k} onClick={() => { if (sortKey === k) setSortAsc(!sortAsc); else { setSortKey(k); setSortAsc(false) } }} style={{
                        padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: font,
                        fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
                        background: sortKey === k ? 'rgba(37,208,102,0.12)' : 'rgba(255,255,255,0.04)',
                        color: sortKey === k ? '#25D066' : '#8C96A3',
                      }}>
                        {labels[k]} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
                      </button>
                    )
                  })}
                </div>

                {/* Table header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 100px 90px 130px 80px 80px',
                  padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
                  fontSize: 10, fontWeight: 700, color: '#596773', fontFamily: font,
                  textTransform: 'uppercase', letterSpacing: '0.04em', gap: 12,
                }}>
                  <span>Título</span>
                  <span>Status</span>
                  <span>Prioridade</span>
                  <span>Responsável</span>
                  <span>Criado</span>
                  <span>Dias</span>
                </div>

                {/* Rows */}
                {sorted.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#596773', padding: '32px 0', fontFamily: font, fontSize: 13 }}>Nenhum ticket encontrado com esses filtros.</p>
                ) : sorted.map(t => {
                  const dias = daysBetween(t.created_at, new Date().toISOString())
                  const statusColor = STATUS_C[t.status] || '#596773'
                  const prioColor = PRIORITY_C[t.priority] || '#596773'
                  return (
                    <div key={t.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 100px 90px 130px 80px 80px',
                      padding: '10px 12px', borderRadius: 10, gap: 12, alignItems: 'center',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.12s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#E5E7EB', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, background: `${statusColor}18`, padding: '3px 8px', borderRadius: 99, fontFamily: font, whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {STATUS_L[t.status] || t.status}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: prioColor, background: `${prioColor}18`, padding: '3px 8px', borderRadius: 99, fontFamily: font, textAlign: 'center' }}>
                        {PRIORITY_L[t.priority] || t.priority}
                      </span>
                      <span style={{ fontSize: 11, color: '#8C96A3', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.assignee ? t.assignee.split('@')[0] : '—'}
                      </span>
                      <span style={{ fontSize: 11, color: '#596773', fontFamily: font }}>{t.created_at.slice(0, 10)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: dias > 7 ? '#ef5c48' : dias > 3 ? '#e2b203' : '#4bce97', fontFamily: fontH }}>{dias}d</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ═══════ TEAM TAB ═══════ */}
            {activeTab === 'team' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {memberDist.map(([name, count]) => {
                    const inProgress = active.filter(t => (t.assignee || '').includes(name) && t.status === 'in_progress').length
                    const done = active.filter(t => (t.assignee || '').includes(name) && t.status === 'resolved').length
                    const isOnline = profiles.find(p => p.email === name && p.last_seen_at && (Date.now() - new Date(p.last_seen_at).getTime()) < 300000)
                    const initials = name.replace(/@.*/, '').slice(0, 2).toUpperCase()
                    const load = maxMember > 0 ? Math.round(count / maxMember * 100) : 0
                    return (
                      <div key={name} style={{
                        borderRadius: 14, padding: 16, background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: name === 'Sem responsável' ? '#454F59' : avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: font, flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#E5E7EB', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {name.split('@')[0]}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#25D066' : '#454F59' }} />
                              <span style={{ fontSize: 10, color: isOnline ? '#25D066' : '#596773', fontFamily: font }}>{isOnline ? 'Online' : 'Offline'}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 28, fontWeight: 900, color: '#25D066', fontFamily: fontH }}>{count}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          {[{ label: 'Em progresso', v: inProgress, color: '#e2b203' }, { label: 'Resolvidos', v: done, color: '#4bce97' }].map(m => (
                            <div key={m.label} style={{ flex: 1, textAlign: 'center', background: `${m.color}12`, borderRadius: 8, padding: '6px 0' }}>
                              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: m.color, fontFamily: fontH }}>{m.v}</p>
                              <p style={{ margin: 0, fontSize: 9, color: m.color, fontFamily: font, opacity: 0.7 }}>{m.label}</p>
                            </div>
                          ))}
                        </div>
                        {/* Load bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, color: '#596773', fontFamily: font }}>Carga</span>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${load}%`, background: load > 70 ? '#ef5c48' : load > 40 ? '#e2b203' : '#25D066', transition: 'width 0.5s ease' }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#8C96A3', fontFamily: font }}>{load}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ═══════ TRENDS TAB ═══════ */}
            {activeTab === 'trends' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Daily trend chart */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20 }}>
                  <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7A8D', fontFamily: font, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <TrendingUp size={12} /> Tickets criados por dia
                  </p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140 }}>
                    {trendData.map((d, i) => {
                      const h = maxTrend > 0 ? (d.count / maxTrend) * 100 : 0
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: d.count > 0 ? '#25D066' : '#454F59', fontFamily: font }}>{d.count > 0 ? d.count : ''}</span>
                          <div style={{
                            width: '80%', borderRadius: '4px 4px 0 0', minHeight: 3,
                            height: `${Math.max(h, 3)}%`,
                            background: d.count > 0 ? 'linear-gradient(to top, #1BAD53, #25D066)' : 'rgba(255,255,255,0.04)',
                            transition: 'height 0.5s ease',
                          }} />
                          <span style={{ fontSize: 8, color: '#596773', fontFamily: font, transform: 'rotate(-30deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>{d.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Insights */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    {
                      title: 'Tickets mais antigos (sem resolução)', color: '#ef5c48',
                      items: active.filter(t => t.status !== 'resolved').sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 5)
                    },
                    {
                      title: 'Resolvidos recentemente', color: '#4bce97',
                      items: active.filter(t => t.status === 'resolved').sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5)
                    }
                  ].map(section => (
                    <div key={section.title} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
                      <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6B7A8D', fontFamily: font }}>{section.title}</p>
                      {section.items.length === 0 ? (
                        <p style={{ fontSize: 12, color: '#596773', fontFamily: font }}>—</p>
                      ) : section.items.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: section.color }} />
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#B6C2CF', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: section.color, fontFamily: fontH }}>{daysBetween(t.created_at, new Date().toISOString())}d</span>
                          <ArrowUpRight size={11} color={section.color} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  return ReactDOM.createPortal(content, document.body)
}
