import { useState, useEffect, useMemo, useCallback } from 'react'
import { BarChart3, Clock, CheckCircle2, AlertTriangle, TrendingUp, Users, X, Check, Columns3, RefreshCw, Download, CalendarDays, Target, Maximize2 } from 'lucide-react'
import { supabase, fetchTickets, fetchUserProfiles, type Ticket, type UserProfile } from '../lib/supabase'
import { fetchBoardColumns, type BoardColumn } from '../lib/boardColumns'
import DashboardExpanded from './DashboardExpanded'

interface DashboardViewProps {
  user: string
  onClose: () => void
}

/** Barra horizontal simples */
function Bar({ value, max, color, label, count }: { value: number; max: number; color: string; label: string; count: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 11, width: 100, textAlign: 'right', color: '#8C96A3',
        fontFamily: "'Space Grotesk', sans-serif",
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 20, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
        <div style={{
          height: '100%', borderRadius: 6, transition: 'width 0.5s ease',
          width: `${Math.max(pct, 2)}%`, background: color,
          display: 'flex', alignItems: 'center', paddingLeft: 8,
        }}>
          {pct > 15 && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#000',
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              {count}
            </span>
          )}
        </div>
      </div>
      {pct <= 15 && (
        <span style={{
          fontSize: 11, fontWeight: 700, color,
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

/** Card de métrica */
function MetricCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{
      borderRadius: 12, padding: 12,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.04em', color: '#6B7A8D',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          {label}
        </span>
      </div>
      <p style={{
        fontSize: 24, fontWeight: 900, color, margin: 0,
        fontFamily: "'Paytone One', sans-serif",
      }}>
        {value}
      </p>
      {sub && (
        <p style={{
          fontSize: 10, color: '#6B7A8D', margin: 0,
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          {sub}
        </p>
      )}
    </div>
  )
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  backlog:      { label: 'Backlog',         color: '#579dff' },
  in_progress:  { label: 'Em Progresso',    color: '#e2b203' },
  waiting_devs: { label: 'Aguardando Devs', color: '#f5a623' },
  resolved:     { label: 'Resolvido',       color: '#4bce97' },
}

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  high:   { label: 'Alta',   color: '#ef5c48' },
  medium: { label: 'Média',  color: '#e2b203' },
  low:    { label: 'Baixa',  color: '#4bce97' },
}

export default function DashboardView({ user, onClose }: DashboardViewProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [t, p, c] = await Promise.all([fetchTickets(), fetchUserProfiles(), fetchBoardColumns()])
      setTickets(t)
      setProfiles(p)
      setColumns(c)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Realtime: atualizar tickets automaticamente ──
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchTickets().then(setTickets).catch(console.error)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const active = useMemo(() => tickets.filter(t => !t.is_archived), [tickets])

  // ── Métricas ──
  const totalActive = active.length
  const resolved = active.filter(t => t.status === 'resolved').length
  const highPriority = active.filter(t => t.priority === 'high').length
  const completed = active.filter(t => t.is_completed).length

  const avgResolutionHours = useMemo(() => {
    const resolvedTickets = active.filter(t => t.status === 'resolved')
    if (resolvedTickets.length === 0) return 0
    const total = resolvedTickets.reduce((sum, t) => {
      const created = new Date(t.created_at).getTime()
      const updated = new Date(t.updated_at).getTime()
      return sum + (updated - created)
    }, 0)
    return Math.round(total / resolvedTickets.length / 3_600_000)
  }, [active])

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const createdToday = useMemo(() => active.filter(t => t.created_at.slice(0, 10) === todayStr).length, [active, todayStr])
  const resolvedToday = useMemo(() => active.filter(t => t.status === 'resolved' && t.updated_at.slice(0, 10) === todayStr).length, [active, todayStr])
  const productivityRate = useMemo(() => totalActive > 0 ? Math.round((resolved / totalActive) * 100) : 0, [resolved, totalActive])

  const handleExportCSV = useCallback(() => {
    const headers = ['ID', 'Título', 'Status', 'Prioridade', 'Responsável', 'Cliente', 'Instância', 'Criado em', 'Atualizado em']
    const rows = active.map(t => [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.status,
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
  }, [active, todayStr])

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
        <div data-gsap-child style={{ padding: '20px 20px 16px' }}>
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
      <div data-gsap-child style={{ padding: '20px 20px 16px' }}>
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
        <div data-gsap-child style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          <MetricCard
            icon={<BarChart3 size={14} />}
            label="Total Ativos"
            value={totalActive}
            color="#25D066"
            sub={`${resolved} resolvidos`}
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
            sub={`${resolvedToday} resolvidos hoje`}
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
        <div data-gsap-child>
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
        <div data-gsap-child>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: '#6B7A8D', margin: '0 0 10px',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Tickets por Status
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
              <Bar key={key} value={statusCounts[key] || 0} max={maxStatus} color={color} label={label} count={statusCounts[key] || 0} />
            ))}
          </div>
        </div>

        {/* ── Gráfico: Por Prioridade ── */}
        <div data-gsap-child>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: '#6B7A8D', margin: '0 0 10px',
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Tickets por Prioridade
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(PRIORITY_LABELS).map(([key, { label, color }]) => (
              <Bar key={key} value={priorityCounts[key] || 0} max={maxPriority} color={color} label={label} count={priorityCounts[key] || 0} />
            ))}
          </div>
        </div>

        {/* ── Gráfico: Tickets criados por dia (últimos 7 dias) ── */}
        <div data-gsap-child>
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
            display: 'flex', alignItems: 'flex-end', gap: 4, height: 96, padding: '0 4px',
          }}>
            {dailyCounts.map((d, i) => {
              const h = maxDaily > 0 ? (d.count / maxDaily) * 100 : 0
              return (
                <div key={i} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    color: d.count > 0 ? '#25D066' : '#454F59',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {d.count > 0 ? d.count : ''}
                  </span>
                  <div style={{
                    width: '100%', borderRadius: '4px 4px 0 0',
                    transition: 'height 0.5s ease',
                    height: `${Math.max(h, 4)}%`,
                    background: d.count > 0 ? 'linear-gradient(to top, #1BAD53, #25D066)' : 'rgba(255,255,255,0.04)',
                    minHeight: 3,
                  }} />
                  <span style={{
                    fontSize: 8, color: '#596773',
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
          <div data-gsap-child>
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
                <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: col.color,
                  }} />
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: '#E5E7EB', flex: 1,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {col.title}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 900, color: col.count > 0 ? '#25D066' : '#454F59',
                    fontFamily: "'Paytone One', sans-serif",
                  }}>
                    {col.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Concluir Chamados ── */}
        <div data-gsap-child>
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
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
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
        <div data-gsap-child>
          <p style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: '#6B7A8D', margin: '0 0 10px',
            fontFamily: "'Space Grotesk', sans-serif",
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Users size={11} />
            Tickets por Responsável
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {memberCounts.slice(0, 8).map(([name, count]) => (
              <Bar
                key={name}
                value={count}
                max={maxMember}
                color={name === 'Sem responsável' ? '#596773' : '#25D066'}
                label={name.split('@')[0]}
                count={count}
              />
            ))}
          </div>
        </div>

        {/* ── Membros da equipe ── */}
        <div data-gsap-child>
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
                    fontSize: 11, color: '#8C96A3',
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.04)',
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
