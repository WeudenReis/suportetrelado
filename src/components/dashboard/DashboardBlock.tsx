import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Icon } from '../../lib/icons'
import type { ChartType, BlockDimension, DashboardBlock } from '../../lib/api/dashboardBlocks'
import { aggregateBlockData, type ChartDataPoint, type DashboardBlockContext } from './dashboardBlockData'

const FONT = "'Space Grotesk', sans-serif"

// ─────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────

export function BarChartBlock({ data }: { data: ChartDataPoint[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const ticks = niceTicks(max, 4)
  const tickMax = ticks[ticks.length - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, height: 180, position: 'relative', padding: '4px 4px 0 28px' }}>
        {/* Eixo Y */}
        <div style={{
          position: 'absolute', left: 0, top: 4, bottom: 0, width: 24,
          display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between',
          fontSize: 9, color: '#596773', fontFamily: FONT, fontWeight: 600,
        }}>
          {ticks.map(t => <span key={t} style={{ lineHeight: 1 }}>{t}</span>)}
        </div>
        {/* Linhas guia */}
        <div style={{ position: 'absolute', left: 28, right: 4, top: 4, bottom: 18, pointerEvents: 'none' }}>
          {ticks.map(t => (
            <div key={t} style={{
              position: 'absolute',
              bottom: `${(t / tickMax) * 100}%`,
              left: 0, right: 0,
              borderTop: '1px dashed rgba(166,197,226,0.08)',
            }} />
          ))}
        </div>
        {/* Barras */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 6, height: 'calc(100% - 18px)' }}>
          {data.map((d, i) => {
            const h = (d.value / tickMax) * 100
            return (
              <div key={`${d.label}-${i}`} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                height: '100%', justifyContent: 'flex-end', minWidth: 24,
              }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(h, d.value > 0 ? 2 : 0)}%` }}
                  transition={{ delay: i * 0.04, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  title={`${d.label}: ${d.value}`}
                  style={{
                    width: '70%', minWidth: 16, borderRadius: '4px 4px 0 0',
                    background: `linear-gradient(to top, ${d.color}, ${d.color}cc)`,
                    boxShadow: `0 0 10px ${d.color}33, inset 0 1px 0 rgba(255,255,255,0.18)`,
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
      {/* Labels do eixo X */}
      <div style={{ display: 'flex', gap: 6, padding: '0 4px 0 28px' }}>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} style={{
            flex: 1, minWidth: 24, fontSize: 9, color: '#8C96A3', fontFamily: FONT, fontWeight: 600,
            textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          title={d.label}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export function PieChartBlock({ data }: { data: ChartDataPoint[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return <EmptyChart />
  }
  const radius = 70
  const strokeWidth = 26
  const circumference = 2 * Math.PI * radius
  const segments = data.reduce<Array<ChartDataPoint & { dasharray: string; dashoffset: number }>>((acc, d) => {
    const len = (d.value / total) * circumference
    const offset = acc.reduce((s, prev) => s + (prev.value / total) * circumference, 0)
    acc.push({ ...d, dasharray: `${len} ${circumference - len}`, dashoffset: -offset })
    return acc
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'center', padding: '8px 4px' }}>
      <svg width={180} height={180} viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={90} cy={90} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
        {segments.map((s, i) => (
          <motion.circle
            key={`${s.label}-${i}`}
            cx={90} cy={90} r={radius} fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={s.dasharray}
            strokeDashoffset={s.dashoffset}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
          />
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0, maxHeight: 180, overflowY: 'auto' }}>
        {data.filter(d => d.value > 0).map((d, i) => {
          const pct = Math.round((d.value / total) * 100)
          return (
            <div key={`${d.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0, boxShadow: `0 0 6px ${d.color}88` }} />
              <span style={{ fontSize: 11, color: '#D1D1D5', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.label}>{d.label}</span>
              <span style={{ fontSize: 11, color: '#8C96A3', fontWeight: 600 }}>{d.value} <span style={{ color: '#596773' }}>({pct}%)</span></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LineChartBlock({ data }: { data: ChartDataPoint[] }) {
  if (data.length === 0) return <EmptyChart />
  const max = Math.max(...data.map(d => d.value), 1)
  const ticks = niceTicks(max, 4)
  const tickMax = ticks[ticks.length - 1]
  const w = 100
  const h = 100
  const points = data.map((d, i) => {
    const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w
    const y = h - (d.value / tickMax) * h
    return { x, y, ...d }
  })
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, height: 180, position: 'relative', padding: '4px 4px 0 28px' }}>
        <div style={{
          position: 'absolute', left: 0, top: 4, bottom: 18, width: 24,
          display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between',
          fontSize: 9, color: '#596773', fontFamily: FONT, fontWeight: 600,
        }}>
          {ticks.map(t => <span key={t} style={{ lineHeight: 1 }}>{t}</span>)}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            {ticks.map(t => (
              <line key={t}
                x1={0} x2={w}
                y1={h - (t / tickMax) * h}
                y2={h - (t / tickMax) * h}
                stroke="rgba(166,197,226,0.08)" strokeWidth={0.3} strokeDasharray="1,1.5"
              />
            ))}
            <motion.path
              d={areaD}
              fill="url(#lineblock-gradient)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
            />
            <motion.path
              d={pathD}
              fill="none"
              stroke="#25D066"
              strokeWidth={1.2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
            <defs>
              <linearGradient id="lineblock-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#25D066" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#25D066" stopOpacity={0} />
              </linearGradient>
            </defs>
            {points.map((p, i) => (
              <motion.circle key={i}
                cx={p.x} cy={p.y} r={1.6}
                fill={p.color}
                stroke="#0d1417" strokeWidth={0.4}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.04 }}
              >
                <title>{`${p.label}: ${p.value}`}</title>
              </motion.circle>
            ))}
          </svg>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 4px 0 28px' }}>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} style={{
            flex: 1, minWidth: 24, fontSize: 9, color: '#8C96A3', fontFamily: FONT, fontWeight: 600,
            textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          title={d.label}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export function HBarChartBlock({ data }: { data: ChartDataPoint[] }) {
  if (data.length === 0) return <EmptyChart />
  const max = Math.max(...data.map(d => d.value), 1)
  const visible = data.slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      {visible.map((d, i) => {
        const pct = (d.value / max) * 100
        return (
          <div key={`${d.label}-${i}`} style={{
            display: 'grid', gridTemplateColumns: '110px 1fr 36px',
            alignItems: 'center', gap: 8, fontFamily: FONT,
          }}>
            <span style={{
              fontSize: 11, color: '#D1D1D5', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={d.label}>
              {d.label}
            </span>
            <div style={{
              position: 'relative', height: 18, borderRadius: 6,
              background: 'rgba(255,255,255,0.04)', overflow: 'hidden',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct, d.value > 0 ? 1.5 : 0)}%` }}
                transition={{ delay: i * 0.04, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  height: '100%',
                  background: `linear-gradient(to right, ${d.color}cc, ${d.color})`,
                  boxShadow: `0 0 8px ${d.color}33, inset 0 1px 0 rgba(255,255,255,0.12)`,
                  borderRadius: 6,
                }}
                title={`${d.label}: ${d.value}`}
              />
            </div>
            <span className="font-numeric" style={{
              fontSize: 11, color: d.color, fontWeight: 700, textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {d.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function DonutChartBlock({ data }: { data: ChartDataPoint[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <EmptyChart />
  const radius = 70
  const strokeWidth = 16 // mais fino que o pie -> "miolo" maior
  const circumference = 2 * Math.PI * radius
  const segments = data.reduce<Array<ChartDataPoint & { dasharray: string; dashoffset: number }>>((acc, d) => {
    const len = (d.value / total) * circumference
    const offset = acc.reduce((s, prev) => s + (prev.value / total) * circumference, 0)
    acc.push({ ...d, dasharray: `${len} ${circumference - len}`, dashoffset: -offset })
    return acc
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'center', padding: '8px 4px' }}>
      <div style={{ position: 'relative', width: 180, height: 180 }}>
        <svg width={180} height={180} viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={90} cy={90} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
          {segments.map((s, i) => (
            <motion.circle
              key={`${s.label}-${i}`}
              cx={90} cy={90} r={radius} fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={s.dasharray}
              strokeDashoffset={s.dashoffset}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            />
          ))}
        </svg>
        {/* Total no centro */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONT, pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: 28, fontWeight: 900, color: '#E6E5E8',
            fontFamily: "'Paytone One', sans-serif", letterSpacing: -0.5, lineHeight: 1,
          }}>
            {total}
          </span>
          <span style={{ fontSize: 10, color: '#8C96A3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
            Total
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0, maxHeight: 180, overflowY: 'auto' }}>
        {data.filter(d => d.value > 0).map((d, i) => {
          const pct = Math.round((d.value / total) * 100)
          return (
            <div key={`${d.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0, boxShadow: `0 0 6px ${d.color}88` }} />
              <span style={{ fontSize: 11, color: '#D1D1D5', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.label}>{d.label}</span>
              <span style={{ fontSize: 11, color: '#8C96A3', fontWeight: 600 }}>{d.value} <span style={{ color: '#596773' }}>({pct}%)</span></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FunnelChartBlock({ data }: { data: ChartDataPoint[] }) {
  if (data.length === 0) return <EmptyChart />
  const max = Math.max(...data.map(d => d.value), 1)
  const items = data.filter(d => d.value > 0).length > 0 ? data : data.slice(0, 0)
  if (items.length === 0) return <EmptyChart />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 4px' }}>
      {items.map((d, i) => {
        const pct = (d.value / max) * 100
        const prev = i > 0 ? items[i - 1].value : null
        const dropPct = prev && prev > 0 ? Math.round(((prev - d.value) / prev) * 100) : null
        return (
          <div key={`${d.label}-${i}`}>
            {dropPct !== null && dropPct > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'center', fontSize: 9, color: '#8C96A3',
                fontFamily: FONT, fontWeight: 600, padding: '2px 0',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '1px 8px', borderRadius: 10,
                  background: 'rgba(239,92,72,0.10)', color: '#ef5c48',
                }}>
                  <Icon name="ArrowDown" size={9} />
                  -{dropPct}%
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                margin: '0 auto', padding: '8px 14px',
                width: `${Math.max(pct, 12)}%`,
                minWidth: 140,
                background: `linear-gradient(135deg, ${d.color}dd, ${d.color}aa)`,
                borderRadius: 8,
                boxShadow: `0 0 12px ${d.color}44, inset 0 1px 0 rgba(255,255,255,0.18)`,
                color: '#0d1417',
                fontFamily: FONT, fontWeight: 700,
              }}
              title={`${d.label}: ${d.value}`}
            >
              <motion.span
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: i * 0.08, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  flex: 1, fontSize: 12,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transformOrigin: 'left',
                }}
              >
                {d.label}
              </motion.span>
              <span className="font-numeric" style={{
                fontSize: 13, fontWeight: 900,
                fontFamily: "'Paytone One', sans-serif",
              }}>
                {d.value}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyChart() {
  return (
    <div style={{
      height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#596773', fontFamily: FONT, fontSize: 12,
    }}>
      Sem dados para o filtro atual
    </div>
  )
}

/** Calcula 4-5 ticks "redondos" cobrindo o intervalo [0, max]. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  const step = niceStep(max / count)
  const top = Math.ceil(max / step) * step
  const out: number[] = []
  for (let v = 0; v <= top + 0.001; v += step) out.push(Math.round(v))
  return out
}
function niceStep(raw: number): number {
  const exp = Math.floor(Math.log10(raw))
  const base = Math.pow(10, exp)
  const norm = raw / base
  let step = 1
  if (norm > 5) step = 10
  else if (norm > 2) step = 5
  else if (norm > 1) step = 2
  return step * base
}

// ─────────────────────────────────────────────
// Card que envelopa o gráfico
// ─────────────────────────────────────────────

const CHART_LABEL: Record<ChartType, string> = {
  bar: 'Barras',
  pie: 'Pizza',
  line: 'Linhas',
  hbar: 'Barras horizontais',
  donut: 'Donut',
  funnel: 'Funil',
}

const DIMENSION_LABEL: Record<BlockDimension, string> = {
  column: 'Cartões por lista',
  tag: 'Cartões por etiqueta',
  assignee: 'Cartões por responsável',
  priority: 'Cartões por prioridade',
  due_date: 'Cartões por data de entrega',
}

export interface DashboardBlockCardProps extends DashboardBlockContext {
  block: DashboardBlock
  onDelete?: (id: string) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
  onRename?: (id: string, title: string) => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}

export function DashboardBlockCard({
  block,
  tickets,
  columns,
  profiles,
  boardLabels,
  onDelete,
  onMoveUp,
  onMoveDown,
  onRename,
  canMoveUp,
  canMoveDown,
}: DashboardBlockCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(block.title)

  const data = useMemo(
    () => aggregateBlockData(block.dimension, { tickets, columns, profiles, boardLabels }),
    [block.dimension, tickets, columns, profiles, boardLabels],
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: '#22272b',
        border: '1px solid rgba(166,197,226,0.12)',
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={() => {
              const trimmed = titleDraft.trim()
              if (trimmed && trimmed !== block.title && onRename) onRename(block.id, trimmed)
              else setTitleDraft(block.title)
              setEditingTitle(false)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') { setTitleDraft(block.title); setEditingTitle(false) }
            }}
            style={{
              flex: 1, fontSize: 14, fontWeight: 700, color: '#E6E5E8', fontFamily: FONT,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(37,208,102,0.4)',
              borderRadius: 6, padding: '4px 8px', outline: 'none',
            }}
          />
        ) : (
          <h3
            onClick={() => onRename && setEditingTitle(true)}
            style={{
              flex: 1, fontSize: 14, fontWeight: 700, color: '#E6E5E8', fontFamily: FONT,
              margin: 0, cursor: onRename ? 'text' : 'default',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            title={block.title}
          >
            {block.title}
          </h3>
        )}
        {(onDelete || onMoveUp || onMoveDown || onRename) && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="Menu do bloco"
              onClick={() => setMenuOpen(o => !o)}
              style={{
                width: 26, height: 26, borderRadius: 6,
                background: menuOpen ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: 'none', color: '#8C96A3', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.12s',
              }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseOut={e => { e.currentTarget.style.background = menuOpen ? 'rgba(255,255,255,0.06)' : 'transparent' }}
            >
              <Icon name="MoreHorizontal" size={14} />
            </button>
            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                />
                <div
                  role="menu"
                  style={{
                    position: 'absolute', top: 30, right: 0, zIndex: 11,
                    minWidth: 180, padding: 4,
                    background: '#1d2125', border: '1px solid rgba(166,197,226,0.14)',
                    borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                    fontFamily: FONT,
                  }}
                >
                  {onRename && (
                    <MenuOption
                      icon="Pencil" label="Renomear"
                      onClick={() => { setMenuOpen(false); setEditingTitle(true) }}
                    />
                  )}
                  {onMoveUp && (
                    <MenuOption
                      icon="ArrowUp" label="Mover para cima" disabled={!canMoveUp}
                      onClick={() => { setMenuOpen(false); onMoveUp(block.id) }}
                    />
                  )}
                  {onMoveDown && (
                    <MenuOption
                      icon="ArrowDown" label="Mover para baixo" disabled={!canMoveDown}
                      onClick={() => { setMenuOpen(false); onMoveDown(block.id) }}
                    />
                  )}
                  {onDelete && (
                    <>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 2px' }} />
                      <MenuOption
                        icon="Trash2" label="Excluir bloco" danger
                        onClick={() => {
                          setMenuOpen(false)
                          if (window.confirm('Excluir este bloco do painel?')) onDelete(block.id)
                        }}
                      />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, color: '#596773', fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {CHART_LABEL[block.chart_type]} · {DIMENSION_LABEL[block.dimension]}
      </div>

      {block.chart_type === 'bar' && <BarChartBlock data={data} />}
      {block.chart_type === 'pie' && <PieChartBlock data={data} />}
      {block.chart_type === 'line' && <LineChartBlock data={data} />}
      {block.chart_type === 'hbar' && <HBarChartBlock data={data} />}
      {block.chart_type === 'donut' && <DonutChartBlock data={data} />}
      {block.chart_type === 'funnel' && <FunnelChartBlock data={data} />}
    </motion.div>
  )
}

function MenuOption({
  icon, label, onClick, danger, disabled,
}: {
  icon: 'Pencil' | 'ArrowUp' | 'ArrowDown' | 'Trash2'
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  const color = disabled ? '#454F59' : danger ? '#EF5C48' : '#9FADBC'
  return (
    <button
      type="button"
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '7px 10px', borderRadius: 6,
        background: 'transparent', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color, fontSize: 12, fontWeight: 500, fontFamily: FONT, textAlign: 'left',
        transition: 'background 0.12s',
      }}
      onMouseOver={e => {
        if (disabled) return
        e.currentTarget.style.background = danger ? 'rgba(239,92,72,0.10)' : 'rgba(255,255,255,0.04)'
      }}
      onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  )
}
