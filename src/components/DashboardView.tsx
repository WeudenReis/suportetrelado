import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Clock, CheckCircle2, AlertTriangle, TrendingUp, Users, X, Check, Columns3, Download, CalendarDays, Target, Maximize2 } from 'lucide-react'
import { supabase, fetchTickets, fetchUserProfiles, type Ticket, type UserProfile } from '../lib/supabase'
import { fetchBoardColumns, type BoardColumn } from '../lib/boardColumns'
import DashboardExpanded from './DashboardExpanded'
import { logger } from '../lib/logger'
import { useOrg } from '../lib/org'
import {
  AnimatedNumber,
  HBar,
  StackedPriorityBar,
  PriorityLegend,
  MemberLoadCard,
} from './dashboard/DashboardCharts'

interface DashboardViewProps {
  user: string
  onClose: () => void
}

/** Card de métrica — number anima count-up, micro-interação whileHover */
function MetricCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string | number; color: string; sub?: string }) {
  const parsed = typeof value === 'number'
    ? { num: value, suffix: '' }
    : (() => { const m = String(value).match(/^(-?\d+(?:\.\d+)?)(.*)$/); return m ? { num: parseFloat(m[1]), suffix: m[2] } : null })()
  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -1 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      style={{
        borderRadius: 12, padding: '12px 14px',
        background: 'rgba(44,51,58,0.5)',
        border: `1px solid ${color}33`,
        display: 'flex', flexDirection: 'column', gap: 4,
        boxShadow: `0 0 0 1px ${color}0A, 0 8px 24px -12px ${color}33`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
        <span>{icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          {label}
        </span>
      </div>
      {parsed
        ? <AnimatedNumber value={parsed.num} suffix={parsed.suffix} style={{ fontSize: 26, fontWeight: 900, color, margin: 0, fontFamily: "'Paytone One', sans-serif", lineHeight: 1, letterSpacing: -0.5 }} />
        : <p style={{ fontSize: 26, fontWeight: 900, color, margin: 0, fontFamily: "'Paytone One', sans-serif", lineHeight: 1, letterSpacing: -0.5 }}>{value}</p>}
      {sub && (
        <p style={{
          fontSize: 10, color: '#8C96A3', margin: 0,
          fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500,
        }}>
          {sub}
        </p>
      )}
    </motion.div>
  )
}

export default function DashboardView({ user, onClose }: DashboardViewProps) {
  const { departmentId } = useOrg()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [t, p, c] = await Promise.all([
        fetchTickets({ departmentId: departmentId ?? undefined }),
        fetchUserProfiles(),
        fetchBoardColumns(),
      ])
      setTickets(t)
      setProfiles(p)
      setColumns(c)
    } catch (err) {
      logger.error('Dashboard', 'Falha ao carregar dados', { error: String(err) })
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Realtime: atualizar tickets automaticamente (escopado por dept) ──
  useEffect(() => {
    const filter = departmentId ? { filter: `department_id=eq.${departmentId}` } : {}
    const channel = supabase
      .channel(`dashboard-tickets-${departmentId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', ...filter }, () => {
        fetchTickets({ departmentId: departmentId ?? undefined })
          .then(setTickets)
          .catch(err => logger.error('Dashboard', 'Falha ao atualizar tickets', { error: String(err) }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [departmentId])

  // Painel compacto = "Raio-X de Hoje": apenas tickets ativos, em coluna existente
  // e com movimentação no dia (criados ou atualizados hoje). Histórico completo
  // segue disponível no DashboardExpanded, que recebe `tickets` integralmente.
  const active = useMemo(() => {
    const validColIds = new Set(columns.map(c => c.id))
    const todayStr = new Date().toISOString().slice(0, 10)
    return tickets.filter(t =>
      !t.is_archived &&
      validColIds.has(t.status) &&
      (t.created_at.startsWith(todayStr) || t.updated_at.startsWith(todayStr))
    )
  }, [tickets, columns])

  // ── Métricas ──
  const totalActive = active.length
  const completed = active.filter(t => !!t.is_completed).length
  const highPriority = active.filter(t => t.priority === 'high').length
  const firstColId = columns[0]?.id ?? 'backlog'
  const backlogCount = active.filter(t => t.status === firstColId).length

  const avgResolutionHours = useMemo(() => {
    const completedTickets = active.filter(t => !!t.is_completed)
    if (completedTickets.length === 0) return 0
    const total = completedTickets.reduce((sum, t) => {
      const created = new Date(t.created_at).getTime()
      const updated = new Date(t.updated_at).getTime()
      return sum + (updated - created)
    }, 0)
    return Math.round(total / completedTickets.length / 3_600_000)
  }, [active])

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const createdToday = useMemo(() => active.filter(t => t.created_at.slice(0, 10) === todayStr).length, [active, todayStr])
  const completedToday = useMemo(() => active.filter(t => !!t.is_completed && t.updated_at.slice(0, 10) === todayStr).length, [active, todayStr])
  const productivityRate = useMemo(() => totalActive > 0 ? Math.round((completed / totalActive) * 100) : 0, [completed, totalActive])

  const colLabelMap = useMemo(() => {
    const m: Record<string, string> = {}
    columns.forEach(c => { m[c.id] = c.title })
    return m
  }, [columns])

  const handleExportCSV = useCallback(() => {
    const headers = ['ID', 'Título', 'Status', 'Concluído', 'Prioridade', 'Responsável', 'Cliente', 'Instância', 'Criado em', 'Atualizado em']
    const rows = active.map(t => [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      colLabelMap[t.status] || t.status,
      t.is_completed ? 'Sim' : 'Não',
      t.priority,
      t.assignee || '',
      t.cliente || '',
      t.instancia || '',
      t.created_at,
      t.updated_at,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chatpro-relatorio-${todayStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [active, todayStr, colLabelMap])

  // ── Contagens por status ──
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of active) {
      counts[t.status] = (counts[t.status] || 0) + 1
    }
    return counts
  }, [active])

  const maxStatus = Math.max(...Object.values(statusCounts), 1)

  // ── Contagens por prioridade ──
  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of active) {
      counts[t.priority] = (counts[t.priority] || 0) + 1
    }
    return counts
  }, [active])

  const maxPriority = Math.max(...Object.values(priorityCounts), 1)

  // ── Tickets por membro ──
  const memberCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of active) {
      if (t.assignee) {
        const members = t.assignee.split(',').map(s => s.trim()).filter(Boolean)
        for (const raw of members) {
          // Resolve nome ou email para o nome canônico (deduplicação)
          const profile = profiles.find(p => p.email === raw || p.name === raw || p.email.split('@')[0].toLowerCase() === raw.toLowerCase())
          const key = profile?.name || (raw.includes('@') ? raw.split('@')[0] : raw)
          counts[key] = (counts[key] || 0) + 1
        }
      } else {
        counts['Sem responsável'] = (counts['Sem responsável'] || 0) + 1
      }
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a)
  }, [active, profiles])

  const maxMember = Math.max(...memberCounts.map(([, c]) => c), 1)

  // ── Tickets criados por dia (últimos 7 dias) ──
  const dailyCounts = useMemo(() => {
    const days: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dayStr = d.toISOString().slice(0, 10)
      const label = `${d.getDate()}/${d.getMonth() + 1}`
      const count = active.filter(t => t.created_at.slice(0, 10) === dayStr).length
      days.push({ label, count })
    }
    return days
  }, [active])

  const maxDaily = Math.max(...dailyCounts.map(d => d.count), 1)

  // ── Contagens por coluna do board ──
  const columnCounts = useMemo(() => {
    return columns.map(col => ({
      id: col.id,
      title: col.title,
      color: col.dot_color || '#579dff',
      count: active.filter(t => t.status === col.id).length,
    }))
  }, [columns, active])

  // ── Tickets não concluídos (para a seção de concluir) ──
  const uncompleted = useMemo(() => {
    return active
      .filter(t => !t.is_completed)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10)
  }, [active])

  const handleConclude = useCallback(async (ticketId: string) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, is_completed: true } : t
    ))
    await supabase
      .from('tickets')
      .update({ is_completed: true, updated_at: new Date().toISOString() })
      .eq('id', ticketId)
  }, [])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div data-stagger-child style={{ padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(37,208,102,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BarChart3 size={16} style={{ color: '#25D066' }} />
              </div>
              <div>
                <h2 style={{
                  fontSize: 15, fontWeight: 900, color: '#E5E7EB', margin: 0,
                  fontFamily: "'Paytone One', sans-serif",
                }}>
                  Dashboard
                </h2>
                <p style={{ fontSize: 11, color: '#596773', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                  Carregando...
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              title="Fechar"
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: 'transparent', color: '#596773', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{
            width: 24, height: 24, border: '2px solid #25D06630',
            borderTop: '2px solid #25D066', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      </div>
    )
  }

  return (
    <>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* ══════ HEADER ══════ */}
      <div data-stagger-child style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(37,208,102,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BarChart3 size={16} style={{ color: '#25D066' }} />
            </div>
            <div>
              <h2 style={{
                fontSize: 15, fontWeight: 900, color: '#E5E7EB', margin: 0,
                fontFamily: "'Paytone One', sans-serif",
              }}>
                Dashboard
              </h2>
              <p style={{ fontSize: 11, color: '#596773', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                {totalActive} ticket{totalActive !== 1 ? 's' : ''} ativo{totalActive !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setExpanded(true)}
              title="Expandir dashboard"
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: 'rgba(87,157,255,0.1)', color: '#579dff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(87,157,255,0.22)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(87,157,255,0.1)' }}
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={onClose}
              title="Fechar"
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: 'transparent', color: '#596773', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#B6C2CF' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ══════ CONTEÚDO ══════ */}
      <div
        className="inbox-scroll"
        style={{
          flex: 1, overflowY: 'auto', padding: '4px 20px 80px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* ── Cartões de métricas ── */}
        <div data-stagger-child style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          <MetricCard
            icon={<BarChart3 size={14} />}
            label="Total Ativos"
            value={totalActive}
            color="#25D066"
            sub={`${backlogCount} em ${columns[0]?.title ?? 'backlog'}`}
          />
          <MetricCard
            icon={<AlertTriangle size={14} />}
            label="Alta Prioridade"
            value={highPriority}
            color="#ef5c48"
            sub="tickets urgentes"
          />
          <MetricCard
            icon={<CheckCircle2 size={14} />}
            label="Concluídos"
            value={completed}
            color="#1BAD53"
            sub={`de ${totalActive} ativos`}
          />
          <MetricCard
            icon={<Clock size={14} />}
            label="Tempo Médio"
            value={`${avgResolutionHours}h`}
            color="#e2b203"
            sub="para resolver"
          />
          <MetricCard
            icon={<CalendarDays size={14} />}
            label="Criados Hoje"
            value={createdToday}
            color="#579dff"
            sub={`${completedToday} concluídos hoje`}
          />
          <MetricCard
            icon={<Target size={14} />}
            label="Produtividade"
            value={`${productivityRate}%`}
            color="#a259ff"
            sub="taxa de resolução"
          />
        </div>

        {/* ── Exportar relatório ── */}
        <div data-stagger-child>
          <button
            onClick={handleExportCSV}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.08)' }}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              background: 'rgba(37,208,102,0.08)', border: '1px solid rgba(37,208,102,0.2)',
              color: '#25D066', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background 0.15s',
            }}
          >
            <Download size={13} />
            Exportar Relatório CSV
          </button>
        </div>

        {/* ── Gráfico: Por Status ── */}
        <div data-stagger-child>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: '#6B7A8D', margin: '0 0 10px',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Tickets por Status
          </p>
          <div className="inbox-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 240, paddingRight: 2 }}>
            {columns.map((col, i) => (
              <HBar
                key={col.id}
                label={col.title}
                value={statusCounts[col.id] || 0}
                max={maxStatus}
                color={col.dot_color || '#579dff'}
                delay={0.05 * i}
              />
            ))}
          </div>
        </div>

        {/* ── Gráfico: Por Prioridade (Stacked Bar única 100%) ── */}
        <div data-stagger-child>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: '#6B7A8D', margin: '0 0 10px',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Distribuição de Prioridades
          </p>
          <StackedPriorityBar
            high={priorityCounts.high || 0}
            medium={priorityCounts.medium || 0}
            low={priorityCounts.low || 0}
          />
          <PriorityLegend
            high={priorityCounts.high || 0}
            medium={priorityCounts.medium || 0}
            low={priorityCounts.low || 0}
          />
        </div>

        {/* ── Gráfico: Tickets criados por dia (últimos 7 dias) ── */}
        <div data-stagger-child>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: '#6B7A8D', margin: '0 0 10px',
            fontFamily: "'Space Grotesk', sans-serif",
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <TrendingUp size={11} />
            Criados nos Últimos 7 Dias
          </p>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 6, height: 110, padding: '0 4px',
            background: 'rgba(44,51,58,0.35)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            {dailyCounts.map((d, i) => {
              const h = maxDaily > 0 ? (d.count / maxDaily) * 100 : 0
              const hasValue = d.count > 0
              return (
                <div key={i} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  height: '100%', padding: '6px 0',
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    color: hasValue ? '#25D066' : '#596773',
                    fontFamily: "'Paytone One', sans-serif", letterSpacing: -0.2,
                  }}>
                    {hasValue ? d.count : ''}
                  </span>
                  <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(h, hasValue ? 6 : 3)}%` }}
                      transition={{ delay: 0.05 * i, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        width: '100%', borderRadius: '6px 6px 0 0',
                        background: hasValue ? 'linear-gradient(to top, #1BAD53, #25D066)' : 'rgba(255,255,255,0.05)',
                        boxShadow: hasValue ? '0 0 10px rgba(37,208,102,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' : 'none',
                        minHeight: 3,
                      }}
                    />
                  </div>
                  <span style={{
                    fontSize: 9, color: '#8C96A3', fontWeight: 600,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {d.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Cartões por Coluna ── */}
        {columnCounts.length > 0 && (
          <div data-stagger-child>
            <p style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.05em', color: '#6B7A8D', margin: '0 0 10px',
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Columns3 size={11} />
              Cartões por Coluna
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {columnCounts.map(col => (
                <div key={col.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 10,
                  background: 'rgba(44,51,58,0.5)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: col.color,
                    boxShadow: `0 0 8px ${col.color}99`,
                  }} />
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: '#F1F0F2', flex: 1,
                    fontFamily: "'Space Grotesk', sans-serif",
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {col.title}
                  </span>
                  <span style={{
                    fontSize: 14, fontWeight: 900, color: col.count > 0 ? '#25D066' : '#596773',
                    fontFamily: "'Paytone One', sans-serif",
                    letterSpacing: -0.3,
                  }}>
                    {col.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Concluir Chamados ── */}
        <div data-stagger-child>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: '#6B7A8D', margin: '0 0 10px',
            fontFamily: "'Space Grotesk', sans-serif",
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <CheckCircle2 size={11} />
            Concluir Chamados
          </p>
          {uncompleted.length === 0 ? (
            <p style={{
              fontSize: 11, color: '#596773', textAlign: 'center', padding: '16px 0',
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              Todos os chamados estão concluídos
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {uncompleted.map(t => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 10,
                    background: 'rgba(44,51,58,0.5)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.15s',
                  }}
                >
                  <button
                    onClick={() => handleConclude(t.id)}
                    title="Concluir chamado"
                    style={{
                      width: 22, height: 22, borderRadius: 6, border: '2px solid #454F59',
                      background: 'transparent', cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#25D066'
                      e.currentTarget.style.background = 'rgba(37,208,102,0.12)'
                      const icon = e.currentTarget.querySelector('svg') as HTMLElement | null
                      if (icon) icon.style.opacity = '1'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#454F59'
                      e.currentTarget.style.background = 'transparent'
                      const icon = e.currentTarget.querySelector('svg') as HTMLElement | null
                      if (icon) icon.style.opacity = '0'
                    }}
                  >
                    <Check size={12} style={{ color: '#25D066', opacity: 0 }} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12, fontWeight: 600, color: '#E5E7EB', margin: 0,
                      fontFamily: "'Space Grotesk', sans-serif",
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {t.title}
                    </p>
                    <p style={{
                      fontSize: 10, color: '#596773', margin: '2px 0 0',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}>
                      {(() => {
                        if (!t.assignee) return 'Sem responsável'
                        const first = t.assignee.split(',')[0].trim()
                        const p = profiles.find(pr => pr.email === first || pr.name === first)
                        return p?.name || (first.includes('@') ? first.split('@')[0] : first)
                      })()}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: t.priority === 'high' ? 'rgba(239,92,72,0.12)' : t.priority === 'medium' ? 'rgba(226,178,3,0.12)' : 'rgba(75,206,151,0.12)',
                    color: t.priority === 'high' ? '#ef5c48' : t.priority === 'medium' ? '#e2b203' : '#4bce97',
                  }}>
                    {t.priority === 'high' ? 'ALTA' : t.priority === 'medium' ? 'MÉDIA' : 'BAIXA'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Gráfico: Por Membro ── */}
        <div data-stagger-child>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: '#6B7A8D', margin: '0 0 10px',
            fontFamily: "'Space Grotesk', sans-serif",
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Users size={11} />
            Tickets por Responsável
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {memberCounts.slice(0, 8).map(([name, count], i) => (
              <MemberLoadCard
                key={name}
                name={name}
                count={count}
                maxCount={maxMember}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* ── Membros da equipe ── */}
        <div data-stagger-child>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: '#6B7A8D', margin: '0 0 10px',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Equipe ({profiles.length} membros)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {profiles.map(p => {
              const isOnline = p.last_seen_at && (Date.now() - new Date(p.last_seen_at).getTime()) < 5 * 60_000
              return (
                <div
                  key={p.email}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 8,
                    fontSize: 11, color: '#D1D1D5',
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: 'rgba(44,51,58,0.5)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: isOnline ? '#25D066' : '#596773',
                  }} />
                  {p.name || p.email.split('@')[0]}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>

    {expanded && (
      <DashboardExpanded
        tickets={tickets}
        profiles={profiles}
        columns={columns}
        user={user}
        onClose={() => setExpanded(false)}
      />
    )}
    </>
  )
}
