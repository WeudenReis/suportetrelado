import { useState, useMemo, useCallback, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  Users, Columns3, Target, Download, Filter, SortAsc,
  ArrowUpRight, ShieldAlert, Activity, Inbox, CalendarRange,
  ExternalLink, FileText,
} from 'lucide-react'
import type { Ticket, UserProfile } from '../lib/supabase'
import type { BoardColumn } from '../lib/boardColumns'
import CardDetailModal from './CardDetailModal'

const font = "'Space Grotesk', sans-serif"
const fontH = "'Paytone One', sans-serif"

const PRIORITY_C: Record<string, string> = { high: '#ef5c48', medium: '#e2b203', low: '#4bce97' }
const PRIORITY_L: Record<string, string> = { high: 'ALTA', medium: 'MÉDIA', low: 'BAIXA' }
const STATUS_C: Record<string, string> = {
  backlog: '#579dff', in_progress: '#e2b203', waiting_devs: '#f5a623', resolved: '#4bce97',
}
const STATUS_L: Record<string, string> = {
  backlog: 'Backlog', in_progress: 'Em Progresso', waiting_devs: 'Ag. Devs', resolved: 'Resolvido',
}

function avatarColor(n: string) {
  const colors = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899']
  return colors[n.charCodeAt(0) % colors.length]
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

// ── KPI Card ─────────────────────────────────────────────
function KPI({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}28`, display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color }}>
        {icon}
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: font }}>{label}</span>
      </div>
      <p style={{ fontSize: 28, fontWeight: 900, color, margin: 0, fontFamily: fontH, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: '#6B7A8D', margin: 0, fontFamily: font }}>{sub}</p>}
    </div>
  )
}

// ── Bounded Horizontal Bar ────────────────────────────────
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 120, fontSize: 11, color: '#8C96A3', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flexShrink: 0 }}>{label}</span>
      <div style={{ width: 280, flexShrink: 0, height: 20, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
        <div style={{
          height: '100%', borderRadius: 6, transition: 'width 0.6s ease',
          width: `${Math.max(pct, 2)}%`, background: color,
          display: 'flex', alignItems: 'center', paddingLeft: 8,
        }}>
          {pct > 14 && <span style={{ fontSize: 10, fontWeight: 700, color: '#000', fontFamily: font }}>{value}</span>}
        </div>
      </div>
      {pct <= 14 && <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: font, minWidth: 20 }}>{value}</span>}
    </div>
  )
}

// ── Section header ────────────────────────────────────────
function SectionH({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B7A8D', fontFamily: font, display: 'flex', alignItems: 'center', gap: 5 }}>
      {icon}{title}
    </p>
  )
}

// ── Badge ─────────────────────────────────────────────────
function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, padding: '3px 8px', borderRadius: 99, fontFamily: font, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {text}
    </span>
  )
}

// ── Types ─────────────────────────────────────────────────
interface DashboardExpandedProps {
  tickets: Ticket[]
  profiles: UserProfile[]
  columns: BoardColumn[]
  user: string
  onClose: () => void
}

type DateRange = '7d' | '30d' | '90d' | 'all' | 'custom'
type SortKey = 'created_at' | 'priority' | 'status' | 'assignee'

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'Tudo' },
  { key: 'custom', label: 'Personalizado' },
]

export default function DashboardExpanded({ tickets, profiles, columns, user, onClose }: DashboardExpandedProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'tickets' | 'team' | 'trends'>('overview')
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [localTickets, setLocalTickets] = useState<Ticket[]>(tickets)

  // Mantém localTickets em sync quando o prop tickets muda (realtime do DashboardView)
  useEffect(() => { setLocalTickets(tickets) }, [tickets])

  const active = useMemo(() => {
    const validColIds = new Set(columns.map(c => c.id))
    return localTickets.filter(t => !t.is_archived && validColIds.has(t.status))
  }, [localTickets, columns])

  const cutoff = useMemo(() => {
    if (dateRange === 'all') return null
    if (dateRange === 'custom') return customStart ? customStart + 'T00:00:00' : null
    const d = new Date(); d.setDate(d.getDate() - parseInt(dateRange)); return d.toISOString()
  }, [dateRange, customStart])

  const cutoffEnd = useMemo(() => {
    if (dateRange === 'custom' && customEnd) return customEnd + 'T23:59:59'
    return null
  }, [dateRange, customEnd])

  const filtered = useMemo(() => {
    let t = active
    if (cutoff) t = t.filter(x => x.created_at >= cutoff!)
    if (cutoffEnd) t = t.filter(x => x.created_at <= cutoffEnd!)
    if (filterStatus !== 'all') t = t.filter(x => x.status === filterStatus)
    if (filterPriority !== 'all') t = t.filter(x => x.priority === filterPriority)
    if (filterAssignee !== 'all') t = t.filter(x => (x.assignee || '').includes(filterAssignee))
    return t
  }, [active, cutoff, cutoffEnd, filterStatus, filterPriority, filterAssignee])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = '', vb = ''
      if (sortKey === 'created_at') { va = a.created_at; vb = b.created_at }
      else if (sortKey === 'priority') {
        const o: Record<string, number> = { high: 0, medium: 1, low: 2 }
        va = String(o[a.priority] ?? 9); vb = String(o[b.priority] ?? 9)
      } else if (sortKey === 'status') { va = a.status; vb = b.status }
      else if (sortKey === 'assignee') { va = a.assignee || ''; vb = b.assignee || '' }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }, [filtered, sortKey, sortAsc])

  const total = filtered.length
  const completedCount = filtered.filter(t => !!t.is_completed).length
  const resolvedCount = completedCount  // "resolvido" = is_completed (checkbox)
  const highCount = filtered.filter(t => t.priority === 'high').length
  const resolutionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const firstColId = columns[0]?.id ?? 'backlog'
  const backlogCount = filtered.filter(t => t.status === firstColId).length

  const avgHours = useMemo(() => {
    const res = filtered.filter(t => !!t.is_completed)
    if (!res.length) return 0
    const ms = res.reduce((s, t) => s + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()), 0)
    return Math.round(ms / res.length / 3_600_000)
  }, [filtered])

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

  const resolveAssigneeName = useCallback((raw: string): string => {
    const p = profiles.find(pr => pr.email === raw || pr.name === raw || pr.email.split('@')[0].toLowerCase() === raw.toLowerCase())
    return p?.name || raw.split('@')[0]
  }, [profiles])

  const memberDist = useMemo(() => {
    const m: Record<string, number> = {}
    const emailToName = new Map<string, string>()
    for (const t of filtered) {
      const assignees = t.assignee ? t.assignee.split(',').map(s => s.trim()).filter(Boolean) : ['Sem responsável']
      assignees.forEach(a => {
        const displayName = a === 'Sem responsável' ? a : resolveAssigneeName(a)
        if (a !== 'Sem responsável') emailToName.set(displayName, a)
        m[displayName] = (m[displayName] || 0) + 1
      })
    }
    return Object.entries(m).sort(([, a], [, b]) => b - a)
  }, [filtered, resolveAssigneeName])
  const maxMember = Math.max(...memberDist.map(([, c]) => c), 1)

  // Carga ATIVA: conta apenas tickets não-concluídos (workload real do momento)
  const memberDistActive = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of active.filter(x => !x.is_completed)) {
      const assignees = t.assignee ? t.assignee.split(',').map(s => s.trim()).filter(Boolean) : ['Sem responsável']
      assignees.forEach(a => {
        const displayName = a === 'Sem responsável' ? a : resolveAssigneeName(a)
        m[displayName] = (m[displayName] || 0) + 1
      })
    }
    return m
  }, [active, resolveAssigneeName])
  const maxMemberActive = Math.max(...Object.values(memberDistActive), 1)

  const days = dateRange === '7d' ? 7 : 14
  const trendData = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (days - 1 - i))
      const ds = d.toISOString().slice(0, 10)
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, count: active.filter(t => t.created_at.slice(0, 10) === ds).length }
    })
  }, [active, days])
  const maxTrend = Math.max(...trendData.map(d => d.count), 1)

  const allAssignees = useMemo(() => {
    const set = new Set<string>()
    active.forEach(t => (t.assignee ? t.assignee.split(',').map(s => s.trim()).filter(Boolean) : []).forEach(a => set.add(a)))
    return Array.from(set).sort()
  }, [active])

  const colLabelMap = useMemo(() => {
    const m: Record<string, string> = {}
    columns.forEach(c => { m[c.id] = c.title })
    return m
  }, [columns])

  const handleExport = useCallback(() => {
    const h = ['ID', 'Título', 'Status', 'Concluído', 'Prioridade', 'Responsável', 'Cliente', 'Criado em', 'Atualizado em', 'Dias aberto']
    const rows = sorted.map(t => [t.id, `"${(t.title || '').replace(/"/g, '""')}"`, colLabelMap[t.status] || t.status, t.is_completed ? 'Sim' : 'Não', PRIORITY_L[t.priority] || t.priority, t.assignee || '', t.cliente || '', t.created_at, t.updated_at, daysBetween(t.created_at, t.updated_at)])
    const csv = [h.join(','), ...rows.map(r => r.join(','))].join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })), download: `dashboard-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
  }, [sorted, colLabelMap])

  const handleExportPDF = useCallback(async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const W = 210, margin = 16, contentW = W - margin * 2
    const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    let y = 0

    // ── helpers ──
    const hex2rgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return [r, g, b] as [number, number, number]
    }
    const setColor = (hex: string) => doc.setTextColor(...hex2rgb(hex))
    const setFill = (hex: string) => doc.setFillColor(...hex2rgb(hex))
    const setDraw = (hex: string) => doc.setDrawColor(...hex2rgb(hex))

    const pageH = 297
    const checkPage = (need: number) => {
      if (y + need > pageH - 20) { doc.addPage(); y = 20 }
    }

    // ── COVER HEADER ──
    setFill('#0e1520'); doc.rect(0, 0, W, 42, 'F')
    setFill('#1a2f1a'); doc.rect(0, 42, W, 2, 'F')
    setFill('#25D066'); doc.rect(0, 44, W, 1.5, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    setColor('#E5E7EB')
    doc.text('Dashboard Executivo', margin, 18)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    setColor('#596773')
    doc.text(`Relatório gerado em ${dateStr}`, margin, 26)
    doc.text(`Período: ${dateRange === 'custom' ? `${customStart || '?'} até ${customEnd || '?'}` : dateRange === 'all' ? 'Todo o período' : `Últimos ${dateRange}`}`, margin, 32)
    doc.text(`Total de tickets no filtro: ${total}`, margin, 38)

    // Accent bar decoration
    setFill('#25D066'); doc.roundedRect(W - margin - 28, 10, 28, 28, 3, 3, 'F')
    setColor('#000000'); doc.setFontSize(20); doc.setFont('helvetica', 'bold')
    doc.text(String(total), W - margin - 14, 27, { align: 'center' })
    setColor('#002a0a'); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text('TICKETS', W - margin - 14, 33, { align: 'center' })

    y = 54

    // ── KPI BOXES (2 per row) ──
    const kpis = [
      { label: 'Total de Tickets', value: String(total), sub: `${backlogCount} em backlog`, color: '#25D066' },
      { label: 'Alta Prioridade', value: String(highCount), sub: 'tickets urgentes', color: '#ef5c48' },
      { label: 'Taxa de Resolução', value: `${resolutionRate}%`, sub: `${resolvedCount} resolvidos`, color: '#4bce97' },
      { label: 'Tempo Médio', value: `${avgHours}h`, sub: 'para resolver', color: '#e2b203' },
    ]
    const kpiW = (contentW - 6) / 2
    const kpiH = 22
    kpis.forEach((k, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const kx = margin + col * (kpiW + 6)
      const ky = y + row * (kpiH + 4)
      setFill('#141c26'); doc.roundedRect(kx, ky, kpiW, kpiH, 3, 3, 'F')
      setDraw(k.color); doc.setLineWidth(0.5); doc.roundedRect(kx, ky, kpiW, kpiH, 3, 3, 'S')
      setFill(k.color); doc.rect(kx, ky, 2, kpiH, 'F')
      setColor(k.color); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
      doc.text(k.label.toUpperCase(), kx + 5, ky + 6)
      doc.setFontSize(16); doc.text(k.value, kx + 5, ky + 15)
      setColor('#596773'); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal')
      doc.text(k.sub, kx + 5, ky + 19.5)
    })
    y += Math.ceil(kpis.length / 2) * (kpiH + 4) + 8

    // ── STATUS DISTRIBUTION ──
    checkPage(50)
    setColor('#E5E7EB'); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('STATUS DO PIPELINE', margin, y); y += 5
    setDraw('#1e2a3a'); doc.setLineWidth(0.3); doc.line(margin, y, W - margin, y); y += 4
    const maxSt = Math.max(...columns.map(c => statusDist[c.id] || 0), 1)
    columns.forEach(col => {
      const val = statusDist[col.id] || 0
      const pct = val / maxSt
      const barMaxW = contentW - 42
      checkPage(10)
      setColor('#8C96A3'); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
      doc.text(col.title.slice(0, 18), margin, y + 4)
      setFill('#1e2a3a'); doc.roundedRect(margin + 38, y, barMaxW, 6, 1, 1, 'F')
      const bColor = col.dot_color || '#579dff'
      setFill(bColor); doc.roundedRect(margin + 38, y, Math.max(barMaxW * pct, 2), 6, 1, 1, 'F')
      setColor('#E5E7EB'); doc.setFontSize(6.5)
      doc.text(String(val), margin + 38 + barMaxW + 2, y + 4.5)
      y += 9
    })
    y += 5

    // ── PRIORITY DISTRIBUTION ──
    checkPage(50)
    setColor('#E5E7EB'); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text('DISTRIBUIÇÃO DE PRIORIDADES', margin, y); y += 5
    setDraw('#1e2a3a'); doc.setLineWidth(0.3); doc.line(margin, y, W - margin, y); y += 4
    const prioEntries = Object.entries(PRIORITY_L)
    const maxPr = Math.max(...prioEntries.map(([k]) => priorityDist[k] || 0), 1)
    prioEntries.forEach(([k, label]) => {
      const val = priorityDist[k] || 0
      const pct = val / maxPr
      const barMaxW = contentW - 42
      checkPage(10)
      setColor('#8C96A3'); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
      doc.text(label, margin, y + 4)
      setFill('#1e2a3a'); doc.roundedRect(margin + 38, y, barMaxW, 6, 1, 1, 'F')
      const bColor = PRIORITY_C[k] || '#579dff'
      setFill(bColor); doc.roundedRect(margin + 38, y, Math.max(barMaxW * pct, 2), 6, 1, 1, 'F')
      setColor('#E5E7EB'); doc.setFontSize(6.5)
      doc.text(String(val), margin + 38 + barMaxW + 2, y + 4.5)
      y += 9
    })
    y += 5

    // ── CARGA POR RESPONSÁVEL ──
    const members = memberDist.slice(0, 10)
    if (members.length) {
      checkPage(20)
      setColor('#E5E7EB'); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
      doc.text('CARGA POR RESPONSÁVEL', margin, y); y += 5
      setDraw('#1e2a3a'); doc.setLineWidth(0.3); doc.line(margin, y, W - margin, y); y += 4
      const maxM = Math.max(...members.map(([, c]) => c), 1)
      members.forEach(([name, count]) => {
        const pct = count / maxM
        const barMaxW = contentW - 50
        checkPage(10)
        const displayName = name.split('@')[0].slice(0, 20)
        setColor('#8C96A3'); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
        doc.text(displayName, margin, y + 4)
        setFill('#1e2a3a'); doc.roundedRect(margin + 46, y, barMaxW, 6, 1, 1, 'F')
        setFill('#25D066'); doc.roundedRect(margin + 46, y, Math.max(barMaxW * pct, 2), 6, 1, 1, 'F')
        setColor('#E5E7EB'); doc.setFontSize(6.5)
        doc.text(String(count), margin + 46 + barMaxW + 2, y + 4.5)
        y += 9
      })
      y += 5
    }

    // ── TICKETS TABLE ──
    checkPage(30)
    setColor('#E5E7EB'); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
    doc.text(`TICKETS (${sorted.length})`, margin, y); y += 5
    setDraw('#1e2a3a'); doc.setLineWidth(0.3); doc.line(margin, y, W - margin, y); y += 3

    // Table header row
    const cols = [
      { label: 'Título', w: 68 },
      { label: 'Status', w: 30 },
      { label: 'Prioridade', w: 26 },
      { label: 'Responsável', w: 38 },
      { label: 'Criado', w: 20 },
      { label: 'Dias', w: 12 },
    ]
    setFill('#1e2a3a'); doc.rect(margin, y - 1, contentW, 7, 'F')
    let cx = margin
    setColor('#596773'); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold')
    cols.forEach(c => { doc.text(c.label.toUpperCase(), cx + 1, y + 3.5); cx += c.w })
    y += 8

    sorted.slice(0, 60).forEach((t, idx) => {
      checkPage(8)
      if (idx % 2 === 0) { setFill('#141c26'); doc.rect(margin, y - 1, contentW, 7, 'F') }
      const dias = daysBetween(t.created_at, new Date().toISOString())
      const rowData = [
        (t.title || '').slice(0, 38),
        (colLabelMap[t.status] || t.status).slice(0, 16),
        PRIORITY_L[t.priority] || t.priority,
        (t.assignee || '—').split('@')[0].slice(0, 20),
        t.created_at.slice(0, 10),
        `${dias}d`,
      ]
      const rowColors = ['#B6C2CF', columns.find(c => c.id === t.status)?.dot_color || '#B6C2CF', PRIORITY_C[t.priority] || '#B6C2CF', '#8C96A3', '#596773', dias > 7 ? '#ef5c48' : dias > 3 ? '#e2b203' : '#4bce97']
      let rx = margin
      rowData.forEach((val, vi) => {
        setColor(rowColors[vi]); doc.setFontSize(6.5); doc.setFont('helvetica', vi === 0 ? 'bold' : 'normal')
        doc.text(val, rx + 1, y + 3.5)
        rx += cols[vi].w
      })
      y += 7
    })
    if (sorted.length > 60) {
      setColor('#596773'); doc.setFontSize(6.5)
      doc.text(`... e mais ${sorted.length - 60} tickets (exporte CSV para lista completa)`, margin, y + 4)
      y += 8
    }

    // ── FOOTER ──
    const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      setFill('#0e1520'); doc.rect(0, pageH - 10, W, 10, 'F')
      setColor('#596773'); doc.setFontSize(6); doc.setFont('helvetica', 'normal')
      doc.text(`Dashboard Executivo · Gerado em ${dateStr} · Página ${p} de ${totalPages}`, W / 2, pageH - 4, { align: 'center' })
    }

    doc.save(`dashboard-executivo-${new Date().toISOString().slice(0, 10)}.pdf`)
  }, [sorted, total, highCount, completedCount, resolutionRate, avgHours, backlogCount, statusDist, priorityDist, memberDist, dateRange, customStart, customEnd, columns, colLabelMap])

  const TABS = [
    { key: 'overview' as const, label: 'Visão Geral', icon: <BarChart3 size={13} /> },
    { key: 'tickets' as const, label: `Tickets (${total})`, icon: <Inbox size={13} /> },
    { key: 'team' as const, label: 'Equipe', icon: <Users size={13} /> },
    { key: 'trends' as const, label: 'Tendências', icon: <TrendingUp size={13} /> },
  ]

  const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 18 }

  const content = (
    <AnimatePresence>
      <motion.div
        key="dashboard-expanded"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#111720', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* ── HEADER ── */}
        <div style={{ padding: '14px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, background: '#0e1520' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(37,208,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart3 size={16} color="#25D066" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#E5E7EB', fontFamily: fontH }}>Dashboard Executivo</h2>
            <p style={{ margin: 0, fontSize: 10, color: '#596773', fontFamily: font }}>{total} tickets no período selecionado</p>
          </div>

          <div style={{ flex: 1 }} />

          {/* Period buttons */}
          <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: 3 }}>
            {DATE_RANGES.map(r => (
              <button key={r.key} onClick={() => setDateRange(r.key)} style={{
                padding: '5px 11px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: font,
                fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                background: dateRange === r.key ? '#25D066' : 'transparent',
                color: dateRange === r.key ? '#000' : '#8C96A3',
              }}>{r.label}</button>
            ))}
          </div>

          {/* Custom date inputs */}
          {dateRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarRange size={13} color="#596773" />
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ background: '#1e2a38', border: '1px solid rgba(255,255,255,0.1)', color: '#B6C2CF', borderRadius: 7, padding: '5px 8px', fontSize: 11, fontFamily: font, outline: 'none' }} />
              <span style={{ fontSize: 11, color: '#596773' }}>até</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ background: '#1e2a38', border: '1px solid rgba(255,255,255,0.1)', color: '#B6C2CF', borderRadius: 7, padding: '5px 8px', fontSize: 11, fontFamily: font, outline: 'none' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'rgba(37,208,102,0.08)', border: '1px solid rgba(37,208,102,0.2)', color: '#25D066', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: font }}>
              <Download size={11} /> CSV
            </button>
            <button onClick={handleExportPDF} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,92,72,0.08)', border: '1px solid rgba(239,92,72,0.2)', color: '#ef5c48', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: font }}>
              <FileText size={11} /> PDF
            </button>
          </div>

          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color: '#596773', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#B6C2CF' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#596773' }}>
            <X size={16} />
          </button>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 28px', flexShrink: 0, background: '#0e1520' }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px 13px', border: 'none',
              background: 'transparent', cursor: 'pointer', position: 'relative', fontFamily: font,
              fontSize: 12, fontWeight: 600, color: activeTab === tab.key ? '#25D066' : '#8C96A3',
              transition: 'color 0.15s',
            }}>
              {tab.icon}{tab.label}
              {activeTab === tab.key && (
                <motion.div layoutId="dtab" style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: '#25D066', borderRadius: 1 }} />
              )}
            </button>
          ))}
        </div>

        {/* ── FILTER BAR ── */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 28px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0, background: '#0d1520' }}>
          <Filter size={12} color="#596773" />
          <span style={{ fontSize: 11, color: '#596773', fontFamily: font }}>Filtrar:</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ background: '#1a2230', border: '1px solid rgba(255,255,255,0.08)', color: '#B6C2CF', borderRadius: 7, padding: '4px 9px', fontSize: 11, fontFamily: font, cursor: 'pointer', outline: 'none' }}>
            <option value="all">Todos status</option>
            {columns.map(col => <option key={col.id} value={col.id}>{col.title}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ background: '#1a2230', border: '1px solid rgba(255,255,255,0.08)', color: '#B6C2CF', borderRadius: 7, padding: '4px 9px', fontSize: 11, fontFamily: font, cursor: 'pointer', outline: 'none' }}>
            <option value="all">Todas prioridades</option>
            {Object.entries(PRIORITY_L).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{ background: '#1a2230', border: '1px solid rgba(255,255,255,0.08)', color: '#B6C2CF', borderRadius: 7, padding: '4px 9px', fontSize: 11, fontFamily: font, cursor: 'pointer', outline: 'none' }}>
            <option value="all">Todos responsáveis</option>
            {allAssignees.map(a => <option key={a} value={a}>{a.split('@')[0]}</option>)}
          </select>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#596773', fontFamily: font }}>{total} resultados</span>
          {(filterStatus !== 'all' || filterPriority !== 'all' || filterAssignee !== 'all') && (
            <button onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setFilterAssignee('all') }} style={{ fontSize: 11, color: '#ef5c48', background: 'rgba(239,92,72,0.08)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: font }}>
              Limpar
            </button>
          )}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 36px' }} className="inbox-scroll">

          {/* ═══ OVERVIEW ═══ */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* KPIs */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <KPI icon={<Activity size={13} />}    label="Total ativos"   value={active.length}        color="#25D066" sub={`${backlogCount} em ${columns[0]?.title ?? 'backlog'}`} />
                <KPI icon={<ShieldAlert size={13} />} label="Alta prioridade" value={highCount}            color="#ef5c48" sub="tickets urgentes" />
                <KPI icon={<CheckCircle2 size={13} />} label="Taxa resolução" value={`${resolutionRate}%`} color="#4bce97" sub={`${completedCount} concluídos`} />
                <KPI icon={<Clock size={13} />}        label="Tempo médio"    value={`${avgHours}h`}        color="#e2b203" sub="para concluir" />
                <KPI icon={<Target size={13} />}       label="Concluídos"     value={completedCount}        color="#a259ff" sub={`de ${total} no filtro`} />
              </div>

              {/* Charts 2-column */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Status */}
                <div style={cardStyle}>
                  <SectionH icon={<Columns3 size={12} />} title="Status do pipeline" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 220, paddingRight: 4 }} className="inbox-scroll">
                    {columns.map(col => (
                      <HBar key={col.id} label={col.title} value={statusDist[col.id] || 0} max={maxStatus} color={col.dot_color || '#579dff'} />
                    ))}
                  </div>
                </div>

                {/* Prioridade */}
                <div style={cardStyle}>
                  <SectionH icon={<AlertTriangle size={12} />} title="Distribuição de prioridades" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {Object.entries(PRIORITY_L).map(([k, v]) => (
                      <HBar key={k} label={v} value={priorityDist[k] || 0} max={maxPriority} color={PRIORITY_C[k]} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                    {Object.entries(PRIORITY_L).map(([k, v]) => {
                      const count = priorityDist[k] || 0
                      const pct = total > 0 ? Math.round(count / total * 100) : 0
                      return (
                        <div key={k} style={{ textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: PRIORITY_C[k], fontFamily: fontH }}>{pct}%</p>
                          <p style={{ margin: 0, fontSize: 9, color: '#6B7A8D', fontFamily: font }}>{v}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Por responsável */}
                <div style={cardStyle}>
                  <SectionH icon={<Users size={12} />} title="Carga por responsável" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(memberDistActive).sort(([,a],[,b]) => b-a).slice(0, 10).map(([name, count]) => (
                      <HBar key={name} label={name} value={count} max={maxMemberActive} color={name === 'Sem responsável' ? '#596773' : '#25D066'} />
                    ))}
                    {Object.keys(memberDistActive).length === 0 && <p style={{ fontSize: 11, color: '#596773', fontFamily: font }}>Sem dados</p>}
                  </div>
                </div>

                {/* Por coluna */}
                <div style={cardStyle}>
                  <SectionH icon={<Columns3 size={12} />} title="Tickets por coluna" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {columns.map(col => {
                      const count = active.filter(t => t.status === col.id).length
                      const pct = active.length > 0 ? Math.round(count / active.length * 100) : 0
                      return (
                        <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: col.dot_color || '#579dff' }} />
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#E5E7EB', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.title}</span>
                          <span style={{ fontSize: 11, color: '#6B7A8D', fontFamily: font, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: count > 0 ? '#25D066' : '#454F59', fontFamily: fontH, minWidth: 24, textAlign: 'right' }}>{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TICKETS ═══ */}
          {activeTab === 'tickets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Sort row */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <SortAsc size={12} color="#596773" />
                <span style={{ fontSize: 11, color: '#596773', fontFamily: font }}>Ordenar:</span>
                {(['created_at', 'priority', 'status', 'assignee'] as SortKey[]).map(k => {
                  const ls: Record<SortKey, string> = { created_at: 'Data', priority: 'Prioridade', status: 'Status', assignee: 'Responsável' }
                  return (
                    <button key={k} onClick={() => { if (sortKey === k) setSortAsc(!sortAsc); else { setSortKey(k); setSortAsc(false) } }} style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: font, fontSize: 11, fontWeight: 600,
                      background: sortKey === k ? 'rgba(37,208,102,0.12)' : 'rgba(255,255,255,0.04)',
                      color: sortKey === k ? '#25D066' : '#8C96A3',
                    }}>
                      {ls[k]}{sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
                    </button>
                  )
                })}
              </div>

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px 160px 96px 60px 36px', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 10, fontWeight: 700, color: '#596773', fontFamily: font, textTransform: 'uppercase', letterSpacing: '0.04em', gap: 8 }}>
                <span>Título</span><span>Status</span><span>Prioridade</span><span>Responsável</span><span>Criado</span><span>Dias</span><span></span>
              </div>

              {sorted.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#596773', padding: '32px 0', fontFamily: font }}>Nenhum ticket com esses filtros.</p>
              ) : sorted.map(t => {
                const dias = daysBetween(t.created_at, new Date().toISOString())
                return (
                  <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px 160px 96px 60px 36px', padding: '10px 12px', borderRadius: 10, gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.12s', cursor: 'pointer' }}
                    onClick={() => setSelectedTicket(t)}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#E5E7EB', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    <div style={{ overflow: 'hidden' }}><Badge text={STATUS_L[t.status] || t.status} color={STATUS_C[t.status] || '#596773'} /></div>
                    <div style={{ overflow: 'hidden' }}><Badge text={PRIORITY_L[t.priority] || t.priority} color={PRIORITY_C[t.priority] || '#596773'} /></div>
                    <span style={{ fontSize: 11, color: '#8C96A3', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.assignee ? t.assignee.split('@')[0] : '—'}</span>
                    <span style={{ fontSize: 11, color: '#596773', fontFamily: font }}>{t.created_at.slice(0, 10)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: dias > 7 ? '#ef5c48' : dias > 3 ? '#e2b203' : '#4bce97', fontFamily: fontH }}>{dias}d</span>
                    <button title="Abrir ticket" style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(87,157,255,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#579dff', flexShrink: 0 }}
                      onClick={e => { e.stopPropagation(); setSelectedTicket(t) }}>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* ═══ TEAM ═══ */}
          {activeTab === 'team' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
              {memberDist.map(([name, count]) => {
                const profile = profiles.find(p => p.name === name || p.email.split('@')[0] === name)
                const matchAssignee = (t: Ticket) => {
                  const a = t.assignee || ''
                  return a.includes(name) || (profile && (a.includes(profile.email) || a.includes(profile.name)))
                }
                // Em progresso = todos os não-concluídos; Resolvidos = is_completed
                const inProgress = active.filter(t => matchAssignee(t) && !t.is_completed).length
                const done = active.filter(t => matchAssignee(t) && !!t.is_completed).length
                const isOnline = profile && profile.last_seen_at && (Date.now() - new Date(profile.last_seen_at).getTime()) < 300000 // eslint-disable-line react-hooks/purity -- cálculo de presença online
                const avatarBg = name === 'Sem responsável' ? '#454F59' : (profile?.avatar_color || avatarColor(name))
                // Carga baseada apenas em tickets ativos (não-concluídos) = carga real
                const activeCount = memberDistActive[name] ?? 0
                const load = maxMemberActive > 0 ? Math.round(activeCount / maxMemberActive * 100) : 0
                return (
                  <div key={name} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: font, flexShrink: 0 }}>
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#E5E7EB', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#25D066' : '#454F59' }} />
                          <span style={{ fontSize: 10, color: isOnline ? '#25D066' : '#596773', fontFamily: font }}>{isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 26, fontWeight: 900, color: '#25D066', fontFamily: fontH }} title="Tickets ativos (não concluídos)">{activeCount}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[{ label: 'Em progresso', v: inProgress, c: '#e2b203' }, { label: 'Resolvidos', v: done, c: '#4bce97' }].map(m => (
                        <div key={m.label} style={{ flex: 1, textAlign: 'center', background: `${m.c}12`, borderRadius: 8, padding: '6px 0' }}>
                          <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: m.c, fontFamily: fontH }}>{m.v}</p>
                          <p style={{ margin: 0, fontSize: 9, color: m.c, fontFamily: font, opacity: 0.7 }}>{m.label}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: '#596773', fontFamily: font, minWidth: 32 }}>Carga</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${load}%`, background: load > 70 ? '#ef5c48' : load > 40 ? '#e2b203' : '#25D066', transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#8C96A3', fontFamily: font, minWidth: 28, textAlign: 'right' }}>{load}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ═══ TRENDS ═══ */}
          {activeTab === 'trends' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={cardStyle}>
                <SectionH icon={<TrendingUp size={12} />} title="Tickets criados por dia" />
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 130, padding: '0 4px' }}>
                  {trendData.map((d, i) => {
                    const h = maxTrend > 0 ? (d.count / maxTrend) * 100 : 0
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: d.count > 0 ? '#25D066' : '#454F59', fontFamily: font }}>{d.count > 0 ? d.count : ''}</span>
                        <div style={{ width: '70%', borderRadius: '4px 4px 0 0', minHeight: 3, height: `${Math.max(h, 3)}%`, background: d.count > 0 ? 'linear-gradient(to top, #1BAD53, #25D066)' : 'rgba(255,255,255,0.05)', transition: 'height 0.5s ease' }} />
                        <span style={{ fontSize: 8, color: '#596773', fontFamily: font, transform: 'rotate(-30deg)', whiteSpace: 'nowrap' }}>{d.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { title: 'Mais antigos sem resolução', color: '#ef5c48', items: active.filter(t => !t.is_completed).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 6) },
                  { title: 'Resolvidos recentemente', color: '#4bce97', items: active.filter(t => !!t.is_completed).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6) },
                ].map(s => (
                  <div key={s.title} style={cardStyle}>
                    <SectionH icon={<ArrowUpRight size={12} />} title={s.title} />
                    {s.items.length === 0 ? <p style={{ fontSize: 12, color: '#596773', fontFamily: font }}>—</p> : s.items.map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                        onClick={() => setSelectedTicket(t)}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: s.color }} />
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#B6C2CF', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: s.color, fontFamily: fontH }}>{daysBetween(t.created_at, new Date().toISOString())}d</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Ticket detail modal on top ── */}
        {selectedTicket && (
          <CardDetailModal
            ticket={selectedTicket}
            user={user}
            onClose={() => setSelectedTicket(null)}
            onUpdate={updated => {
              setLocalTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
              setSelectedTicket(updated)
            }}
            onDelete={id => {
              setLocalTickets(prev => prev.filter(t => t.id !== id))
              setSelectedTicket(null)
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )

  return ReactDOM.createPortal(content, document.body)
}
