import { useState, useEffect, useMemo } from 'react'
import { BarChart3, Clock, CheckCircle2, AlertTriangle, TrendingUp, Users, X } from 'lucide-react'
import { fetchTickets, fetchUserProfiles, type Ticket, type UserProfile } from '../lib/supabase'

interface DashboardViewProps {
  user: string
  onClose: () => void
}

/** Barra horizontal simples */
function Bar({ value, max, color, label, count }: { value: number; max: number; color: string; label: string; count: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2 group">
      <span className="text-[11px] w-[100px] truncate text-right" style={{ color: '#8c9bab' }}>{label}</span>
      <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div
          className="h-full rounded transition-all duration-500 flex items-center px-2"
          style={{ width: `${Math.max(pct, 2)}%`, background: color }}
        >
          {pct > 15 && <span className="text-[10px] font-bold" style={{ color: '#000' }}>{count}</span>}
        </div>
      </div>
      {pct <= 15 && <span className="text-[11px] font-semibold" style={{ color }}>{count}</span>}
    </div>
  )
}

/** Card de métrica */
function MetricCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(166,197,226,0.08)' }}>
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#596773' }}>{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px]" style={{ color: '#596773' }}>{sub}</p>}
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchTickets(), fetchUserProfiles()])
      .then(([t, p]) => { setTickets(t); setProfiles(p) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const active = useMemo(() => tickets.filter(t => !t.is_archived), [tickets])

  // ── Métricas ──
  const totalActive = active.length
  const resolved = active.filter(t => t.status === 'resolved').length
  const highPriority = active.filter(t => t.priority === 'high').length
  const completed = active.filter(t => (t as any).is_completed).length

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
        for (const m of members) {
          counts[m] = (counts[m] || 0) + 1
        }
      } else {
        counts['Sem responsável'] = (counts['Sem responsável'] || 0) + 1
      }
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a)
  }, [active])

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

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(166,197,226,0.08)' }}>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} style={{ color: '#25D066' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#b6c2cf' }}>Dashboard</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: '#596773' }}><X size={16} /></button>
        </div>
        <p className="text-center text-xs py-16" style={{ color: '#596773' }}>Carregando métricas...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" data-gsap-child>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(166,197,226,0.08)' }}>
        <div className="flex items-center gap-2">
          <BarChart3 size={18} style={{ color: '#25D066' }} />
          <h2 className="text-sm font-semibold" style={{ color: '#b6c2cf' }}>Dashboard</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: '#596773' }}><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 inbox-scroll">
        {/* ── Cartões de métricas ── */}
        <div className="grid grid-cols-2 gap-2" data-gsap-child>
          <MetricCard
            icon={<BarChart3 size={14} />}
            label="Total Ativos"
            value={totalActive}
            color="#579dff"
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
            color="#4bce97"
            sub={`de ${totalActive} ativos`}
          />
          <MetricCard
            icon={<Clock size={14} />}
            label="Tempo Médio"
            value={`${avgResolutionHours}h`}
            color="#e2b203"
            sub="para resolver"
          />
        </div>

        {/* ── Gráfico: Por Status ── */}
        <div data-gsap-child>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#596773' }}>
            Tickets por Status
          </p>
          <div className="space-y-1.5">
            {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
              <Bar key={key} value={statusCounts[key] || 0} max={maxStatus} color={color} label={label} count={statusCounts[key] || 0} />
            ))}
          </div>
        </div>

        {/* ── Gráfico: Por Prioridade ── */}
        <div data-gsap-child>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#596773' }}>
            Tickets por Prioridade
          </p>
          <div className="space-y-1.5">
            {Object.entries(PRIORITY_LABELS).map(([key, { label, color }]) => (
              <Bar key={key} value={priorityCounts[key] || 0} max={maxPriority} color={color} label={label} count={priorityCounts[key] || 0} />
            ))}
          </div>
        </div>

        {/* ── Gráfico: Tickets criados por dia (últimos 7 dias) ── */}
        <div data-gsap-child>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#596773' }}>
            <TrendingUp size={11} className="inline mr-1" />
            Criados nos Últimos 7 Dias
          </p>
          <div className="flex items-end gap-1 h-24 px-1">
            {dailyCounts.map((d, i) => {
              const h = maxDaily > 0 ? (d.count / maxDaily) * 100 : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] font-bold" style={{ color: d.count > 0 ? '#25D066' : '#454f59' }}>
                    {d.count > 0 ? d.count : ''}
                  </span>
                  <div
                    className="w-full rounded-t transition-all duration-500"
                    style={{
                      height: `${Math.max(h, 4)}%`,
                      background: d.count > 0 ? 'linear-gradient(to top, #1BAD53, #25D066)' : 'rgba(255,255,255,0.04)',
                      minHeight: '3px',
                    }}
                  />
                  <span className="text-[8px]" style={{ color: '#596773' }}>{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Gráfico: Por Membro ── */}
        <div data-gsap-child>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#596773' }}>
            <Users size={11} className="inline mr-1" />
            Tickets por Responsável
          </p>
          <div className="space-y-1.5">
            {memberCounts.slice(0, 8).map(([name, count]) => (
              <Bar
                key={name}
                value={count}
                max={maxMember}
                color={name === 'Sem responsável' ? '#596773' : '#579dff'}
                label={name.split('@')[0]}
                count={count}
              />
            ))}
          </div>
        </div>

        {/* ── Membros online ── */}
        <div data-gsap-child>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#596773' }}>
            Equipe ({profiles.length} membros)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profiles.map(p => {
              const isOnline = p.last_seen_at && (Date.now() - new Date(p.last_seen_at).getTime()) < 5 * 60_000
              return (
                <div
                  key={p.email}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(166,197,226,0.06)', color: '#8c9bab' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isOnline ? '#4bce97' : '#596773' }} />
                  {p.name || p.email.split('@')[0]}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
