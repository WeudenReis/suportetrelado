import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

import { PRIORITY_C } from './dashboardConstants'

const font = "'Space Grotesk', sans-serif"
const fontH = "'Paytone One', sans-serif"

// Superfícies elevadas usadas nos trilhos e cards — deriva do Dark Kanban
// (#1d2125 / #22272b / #2c333a). Evitamos qualquer #000 puro para manter
// a legibilidade em ambientes com pouca luminosidade.
const TRACK_BG = 'rgba(44,51,58,0.55)'
const SURFACE_BG = 'rgba(44,51,58,0.5)'

// Garante que nenhuma cor vinda de config (ex.: dot_color da coluna) chegue
// quase preta na UI — substitui por azul neutro quando a luminância for baixa.
function safeAccent(hex: string, fallback = '#579dff'): string {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return fallback
  const h = hex.replace('#', '')
  const s = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (s.length < 6) return fallback
  const r = parseInt(s.slice(0, 2), 16)
  const g = parseInt(s.slice(2, 4), 16)
  const b = parseInt(s.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return fallback
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return l < 0.28 ? fallback : hex
}

function avatarColor(n: string): string {
  const colors = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899']
  return colors[(n.charCodeAt(0) || 0) % colors.length]
}

// ── Count-up animado (rAF + easeOutCubic, ~650 ms) ────────
function useCountUp(target: number, duration = 650): number {
  const [val, setVal] = useState(0)
  const startTs = useRef<number | null>(null)
  useEffect(() => {
    let raf = 0
    startTs.current = null
    const step = (ts: number) => {
      if (startTs.current === null) startTs.current = ts
      const elapsed = ts - startTs.current
      const p = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(target * eased)
      if (p < 1) raf = requestAnimationFrame(step)
      else setVal(target)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

export function AnimatedNumber({ value, suffix = '', style }: { value: number; suffix?: string; style?: React.CSSProperties }) {
  const v = useCountUp(value, 650)
  return <span style={style}>{Math.round(v).toLocaleString('pt-BR')}{suffix}</span>
}

// ── Barra horizontal moderna (label/valor acima, trilho full-width abaixo) ──
export function HBar({ label, value, max, color, delay = 0 }: { label: string; value: number; max: number; color: string; delay?: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const fillPct = value > 0 ? Math.max(pct, 4) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#F1F0F2', fontFamily: font, letterSpacing: 0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 900, color, fontFamily: fontH, flexShrink: 0, letterSpacing: -0.3 }}>{value}</span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: 22, borderRadius: 12, overflow: 'hidden', background: TRACK_BG, border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 2px rgba(13,17,22,0.35)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            height: '100%',
            borderRadius: 12,
            background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`,
            boxShadow: `0 0 12px ${color}55, inset 0 1px 0 rgba(255,255,255,0.22)`,
          }}
        />
      </div>
    </div>
  )
}

// ── Mini Stat Card (estilo Asana/Jira: número grande + barra fina + chip %) ──
// Usado para Status e Prioridade no lugar de barras horizontais.
export function MiniStatCard({
  label,
  value,
  total,
  color,
  delay = 0,
}: {
  label: string
  value: number
  total: number
  color: string
  delay?: number
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const fillPct = value > 0 ? Math.max(pct, 3) : 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.015, y: -1 }}
      style={{
        position: 'relative',
        padding: '12px 14px',
        borderRadius: 12,
        background: SURFACE_BG,
        border: `1px solid ${color}22`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflow: 'hidden',
        boxShadow: `0 0 0 1px ${color}0A, 0 6px 18px -12px ${color}40`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}AA`, flexShrink: 0 }} />
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#8C96A3',
          fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.7,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <AnimatedNumber
          value={value}
          style={{ fontSize: 26, fontWeight: 900, color: '#F1F0F2', fontFamily: fontH, lineHeight: 1, letterSpacing: -0.6 }}
        />
        <span style={{
          fontSize: 10, fontWeight: 700, color, fontFamily: font,
          padding: '3px 7px', borderRadius: 6,
          background: `${color}14`, border: `1px solid ${color}33`,
          letterSpacing: 0.3, flexShrink: 0,
        }}>{pct}%</span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{ delay: delay + 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', borderRadius: 2, background: color, boxShadow: `0 0 6px ${color}88` }}
        />
      </div>
    </motion.div>
  )
}

// ── Mini Stat Line (estilo Stripe/Notion: linha minimalista de report) ──
// Número em destaque à direita (Paytone One), barra fina de 6px,
// separador sutil entre linhas. Foco em legibilidade, não em cor.
export function MiniStatLine({
  label,
  value,
  total,
  color,
  delay = 0,
  showDivider = true,
  onClick,
  isActive = false,
}: {
  label: string
  value: number
  total: number
  color: string
  delay?: number
  showDivider?: boolean
  onClick?: () => void
  isActive?: boolean
}) {
  const accent = safeAccent(color)
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const fillPct = value > 0 ? Math.max(pct, 2) : 0
  const interactive = !!onClick
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      whileHover={interactive ? { x: 2, backgroundColor: 'rgba(255,255,255,0.025)' } : undefined}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }) : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        padding: '10px 8px 12px',
        marginInline: -8,
        borderRadius: 8,
        cursor: interactive ? 'pointer' : 'default',
        outline: 'none',
        background: isActive ? `${accent}14` : 'transparent',
        boxShadow: isActive ? `inset 0 0 0 1px ${accent}55` : 'none',
        borderBottom: showDivider ? '1px solid rgba(255,255,255,0.05)' : 'none',
        transition: 'background 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 2,
            background: accent, boxShadow: `0 0 6px ${accent}66`, flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 600, color: '#D1D1D5',
            fontFamily: font, letterSpacing: 0.15,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
          }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
          <AnimatedNumber
            value={value}
            style={{ fontSize: 22, fontWeight: 900, color: '#F1F0F2', fontFamily: fontH, letterSpacing: -0.5, lineHeight: 1 }}
          />
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#8C96A3',
            fontFamily: font, letterSpacing: 0.3, minWidth: 28, textAlign: 'right',
          }}>{pct}%</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{ delay: delay + 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', borderRadius: 3, background: accent }}
        />
      </div>
    </motion.div>
  )
}

// ── Stacked Priority Bar (Alta / Média / Baixa compondo 100%) ──
export function StackedPriorityBar({ high, medium, low }: { high: number; medium: number; low: number }) {
  const total = high + medium + low
  const segments = [
    { pct: total > 0 ? (high / total) * 100 : 0, color: PRIORITY_C.high, key: 'h' },
    { pct: total > 0 ? (medium / total) * 100 : 0, color: PRIORITY_C.medium, key: 'm' },
    { pct: total > 0 ? (low / total) * 100 : 0, color: PRIORITY_C.low, key: 'l' },
  ].filter(s => s.pct > 0)
  return (
    <div style={{ width: '100%', height: 26, borderRadius: 13, overflow: 'hidden', background: TRACK_BG, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', boxShadow: 'inset 0 1px 3px rgba(13,17,22,0.4)' }}>
      {segments.length === 0 && <div style={{ width: '100%' }} />}
      {segments.map((s, i) => (
        <motion.div
          key={s.key}
          initial={{ width: 0 }}
          animate={{ width: `${s.pct}%` }}
          transition={{ delay: 0.08 + i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${s.color} 0%, ${s.color}DD 100%)`,
            boxShadow: `0 0 12px ${s.color}55, inset 0 1px 0 rgba(255,255,255,0.22)`,
          }}
        />
      ))}
    </div>
  )
}

export function PriorityLegend({ high, medium, low }: { high: number; medium: number; low: number }) {
  const total = high + medium + low
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)
  const items = [
    { label: 'Alta',  color: PRIORITY_C.high,   value: high },
    { label: 'Média', color: PRIORITY_C.medium, value: medium },
    { label: 'Baixa', color: PRIORITY_C.low,    value: low },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
      {items.map(it => (
        <div key={it.label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: SURFACE_BG, border: `1px solid ${it.color}26` }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: it.color, boxShadow: `0 0 10px ${it.color}99`, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <AnimatedNumber value={pct(it.value)} suffix="%" style={{ fontSize: 17, fontWeight: 900, color: it.color, fontFamily: fontH, letterSpacing: -0.4 }} />
            <span style={{ fontSize: 9, color: '#D1D1D5', fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 700, opacity: 0.8 }}>{it.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Delta Pill (variação vs período anterior) ─────────────
// `inverted` quando MENOR é melhor (ex.: tempo médio, alta prioridade).
export function DeltaPill({ delta, inverted = false, size = 'md' }: {
  delta: number | null
  inverted?: boolean
  size?: 'sm' | 'md'
}) {
  if (delta === null) {
    return (
      <span style={{
        fontSize: size === 'sm' ? 9 : 10, fontWeight: 700, color: '#596773',
        fontFamily: font, padding: size === 'sm' ? '2px 6px' : '2px 7px',
        borderRadius: 5, background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)', letterSpacing: 0.3,
      }}>—</span>
    )
  }
  const positive = delta > 0
  // Para KPIs invertidos (menor = melhor), positivo é ruim
  const good = inverted ? delta < 0 : positive
  const neutral = delta === 0
  const color = neutral ? '#8C96A3' : good ? '#4bce97' : '#ef5c48'
  const arrow = neutral ? '→' : positive ? '▲' : '▼'
  return (
    <span style={{
      fontSize: size === 'sm' ? 9 : 10, fontWeight: 700, color, fontFamily: font,
      padding: size === 'sm' ? '2px 6px' : '2px 7px', borderRadius: 5,
      background: `${color}14`, border: `1px solid ${color}33`,
      letterSpacing: 0.3, display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      <span style={{ fontSize: size === 'sm' ? 7 : 8 }}>{arrow}</span>
      {Math.abs(delta)}%
    </span>
  )
}

// ── Aging Bars (idade dos tickets abertos) ────────────────
// Lista vertical com barras horizontais coloridas por bucket.
// Cada linha mostra: cor + label + barra preenchida + contagem.
export function AgingBars({
  buckets,
}: {
  buckets: { key: string; label: string; color: string; count: number }[]
}) {
  const total = buckets.reduce((s, b) => s + b.count, 0)
  const max = Math.max(...buckets.map(b => b.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {buckets.map((b, i) => {
        const pct = max > 0 ? (b.count / max) * 100 : 0
        const fillPct = b.count > 0 ? Math.max(pct, 3) : 0
        const sharePct = total > 0 ? Math.round((b.count / total) * 100) : 0
        return (
          <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 80, flexShrink: 0 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: b.color, boxShadow: `0 0 6px ${b.color}66`, flexShrink: 0,
              }} />
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#D1D1D5', fontFamily: font,
                letterSpacing: 0.1, whiteSpace: 'nowrap',
              }}>{b.label}</span>
            </div>
            <div style={{
              flex: 1, height: 16, borderRadius: 8, overflow: 'hidden',
              background: TRACK_BG, border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: 'inset 0 1px 2px rgba(13,17,22,0.35)',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${fillPct}%` }}
                transition={{ delay: i * 0.04 + 0.04, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  height: '100%', borderRadius: 8,
                  background: `linear-gradient(90deg, ${b.color} 0%, ${b.color}CC 100%)`,
                  boxShadow: `0 0 10px ${b.color}55, inset 0 1px 0 rgba(255,255,255,0.22)`,
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 56, justifyContent: 'flex-end', flexShrink: 0 }}>
              <span style={{
                fontSize: 14, fontWeight: 900, color: '#F1F0F2', fontFamily: fontH,
                letterSpacing: -0.3, lineHeight: 1,
              }}>{b.count}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#8C96A3', fontFamily: font }}>{sharePct}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Heatmap Grid (dia da semana × hora) ────────────────────
// 7 linhas (Dom-Sab) × 24 colunas (0-23h). Cor mais saturada = mais tickets.
const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export function HeatmapGrid({ matrix, max }: { matrix: number[][]; max: number }) {
  const cellColor = (v: number) => {
    if (v === 0) return 'rgba(255,255,255,0.04)'
    const intensity = max > 0 ? v / max : 0
    // Verde chatPro com opacidade proporcional (0.18 .. 1.0)
    const alpha = 0.18 + intensity * 0.82
    return `rgba(37,208,102,${alpha.toFixed(3)})`
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Hora labels (0, 6, 12, 18) */}
      <div style={{ display: 'grid', gridTemplateColumns: '20px repeat(24, 1fr)', gap: 2, fontSize: 8, color: '#596773', fontFamily: font, fontWeight: 600 }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} style={{ textAlign: 'center', opacity: h % 6 === 0 ? 1 : 0 }}>
            {h.toString().padStart(2, '0')}h
          </span>
        ))}
      </div>
      {matrix.map((row, wd) => (
        <div key={wd} style={{ display: 'grid', gridTemplateColumns: '20px repeat(24, 1fr)', gap: 2, alignItems: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#8C96A3', fontFamily: font, textAlign: 'center' }}>
            {WEEKDAY_LABELS[wd]}
          </span>
          {row.map((v, h) => (
            <motion.div
              key={h}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: (wd * 24 + h) * 0.0014, duration: 0.18 }}
              title={`${WEEKDAY_LABELS[wd]} ${h.toString().padStart(2, '0')}h: ${v} ticket${v === 1 ? '' : 's'}`}
              style={{
                aspectRatio: '1 / 1', borderRadius: 3,
                background: cellColor(v),
                border: v > 0 ? '1px solid rgba(37,208,102,0.18)' : '1px solid rgba(255,255,255,0.025)',
                cursor: 'default',
              }}
            />
          ))}
        </div>
      ))}
      {/* Legenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: '#596773', fontFamily: font }}>Menos</span>
        {[0.18, 0.4, 0.6, 0.8, 1.0].map(a => (
          <span key={a} style={{
            width: 14, height: 12, borderRadius: 3,
            background: `rgba(37,208,102,${a.toFixed(2)})`,
            border: '1px solid rgba(37,208,102,0.18)',
          }} />
        ))}
        <span style={{ fontSize: 9, fontWeight: 600, color: '#596773', fontFamily: font }}>Mais</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: '#596773', fontFamily: font }}>
          Pico: {max} ticket{max === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  )
}

// ── Throughput Bars (criados vs concluídos por semana) ─────
// Barras lado a lado por semana, com legenda e labels nas semanas.
export function ThroughputBars({
  weeks,
}: {
  weeks: { weekStart: string; label: string; created: number; completed: number }[]
}) {
  const max = Math.max(...weeks.flatMap(w => [w.created, w.completed]), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140, padding: '0 4px' }}>
        {weeks.map((w, i) => {
          const hCreated = max > 0 ? (w.created / max) * 100 : 0
          const hCompleted = max > 0 ? (w.completed / max) * 100 : 0
          return (
            <div key={w.weekStart} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              height: '100%', justifyContent: 'flex-end', minWidth: 28,
            }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: '88%', width: '100%', justifyContent: 'center' }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(hCreated, w.created > 0 ? 4 : 0)}%` }}
                  transition={{ delay: i * 0.05, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  title={`Criados: ${w.created}`}
                  style={{
                    width: '38%', minWidth: 8, borderRadius: '3px 3px 0 0',
                    background: 'linear-gradient(to top, #357fe0, #579dff)',
                    boxShadow: '0 0 8px rgba(87,157,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(hCompleted, w.completed > 0 ? 4 : 0)}%` }}
                  transition={{ delay: i * 0.05 + 0.08, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  title={`Concluídos: ${w.completed}`}
                  style={{
                    width: '38%', minWidth: 8, borderRadius: '3px 3px 0 0',
                    background: 'linear-gradient(to top, #1BAD53, #25D066)',
                    boxShadow: '0 0 8px rgba(37,208,102,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                />
              </div>
              <span style={{ fontSize: 9, color: '#596773', fontFamily: font, fontWeight: 600 }}>
                {w.label}
              </span>
            </div>
          )
        })}
      </div>
      {/* Legenda */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 10, fontFamily: font }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#D1D1D5' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#579dff', boxShadow: '0 0 6px rgba(87,157,255,0.5)' }} />
          Criados
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#D1D1D5' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#25D066', boxShadow: '0 0 6px rgba(37,208,102,0.5)' }} />
          Concluídos
        </span>
      </div>
    </div>
  )
}

// ── Top Clients List (lista compacta de clientes por volume) ──────
// Cada linha: avatar de iniciais + nome + total + abertos + barra + tempo medio.
export function TopClientsList({
  clients,
}: {
  clients: { cliente: string; count: number; openCount: number; completedCount: number; avgHours: number }[]
}) {
  const max = Math.max(...clients.map(c => c.count), 1)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
      {clients.map((c, i) => {
        const pct = (c.count / max) * 100
        const fillPct = Math.max(pct, 4)
        const initials = (c.cliente.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || '?'
        const bg = avatarColor(c.cliente)
        return (
          <motion.div
            key={c.cliente}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 10,
              background: SURFACE_BG, border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#fff', fontFamily: fontH,
              flexShrink: 0,
              boxShadow: `0 0 10px ${bg}55, inset 0 1px 0 rgba(255,255,255,0.25)`,
            }}>{initials}</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: '#F1F0F2', fontFamily: font,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                }}>{c.cliente}</span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 900, color: '#F1F0F2', fontFamily: fontH,
                    letterSpacing: -0.3, lineHeight: 1,
                  }}>{c.count}</span>
                  {c.openCount > 0 && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: '#e2b203', fontFamily: font,
                      padding: '1px 5px', borderRadius: 4,
                      background: 'rgba(226,178,3,0.12)', border: '1px solid rgba(226,178,3,0.28)',
                    }}>{c.openCount} aberto{c.openCount === 1 ? '' : 's'}</span>
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  flex: 1, height: 5, borderRadius: 3,
                  background: TRACK_BG, overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${fillPct}%` }}
                    transition={{ delay: i * 0.04 + 0.06, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    style={{ height: '100%', borderRadius: 3, background: bg, boxShadow: `0 0 6px ${bg}66` }}
                  />
                </div>
                {c.avgHours > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: '#8C96A3', fontFamily: font,
                    flexShrink: 0, letterSpacing: 0.2,
                  }}>Ø {c.avgHours}h</span>
                )}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ── Member Load Card (avatar + nome/% acima, barra robusta abaixo) ──
export function MemberLoadCard({ name, count, maxCount, index, onClick, isActive = false }: { name: string; count: number; maxCount: number; index: number; onClick?: () => void; isActive?: boolean }) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
  const fillPct = count > 0 ? Math.max(pct, 4) : 0
  const isNone = name === 'Sem responsável'
  const isHigh = pct > 80
  const barColor = isNone ? '#596773' : isHigh ? '#ef5c48' : '#25D066'
  const avatarBg = isNone ? '#596773' : avatarColor(name)
  const initials = (name || '??').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?'
  const interactive = !!onClick
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }) : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', borderRadius: 12,
        background: isActive ? `${barColor}1F` : SURFACE_BG,
        border: `1px solid ${isActive ? `${barColor}66` : isHigh ? '#ef5c4840' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isActive
          ? `0 0 0 1px ${barColor}33`
          : isHigh ? `0 0 0 1px ${PRIORITY_C.high}15` : 'none',
        cursor: interactive ? 'pointer' : 'default',
        outline: 'none',
        transition: 'background 0.15s, border 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: fontH, flexShrink: 0, boxShadow: `0 0 12px ${avatarBg}55, inset 0 1px 0 rgba(255,255,255,0.25)` }}>
        {initials}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#F1F0F2', fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: barColor, fontFamily: fontH, flexShrink: 0, display: 'inline-flex', alignItems: 'baseline', gap: 4, letterSpacing: -0.3 }}>
            {count}
            <span style={{ fontSize: 10, color: '#8C96A3', fontWeight: 700, fontFamily: font }}>({pct}%)</span>
          </span>
        </div>
        <div style={{ width: '100%', height: 10, borderRadius: 8, overflow: 'hidden', background: TRACK_BG, border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 1px 2px rgba(13,17,22,0.35)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${fillPct}%` }}
            transition={{ delay: 0.06 + index * 0.05, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: '100%', borderRadius: 8, background: `linear-gradient(90deg, ${barColor} 0%, ${barColor}CC 100%)`, boxShadow: `0 0 10px ${barColor}66, inset 0 1px 0 rgba(255,255,255,0.25)` }}
          />
        </div>
      </div>
    </motion.div>
  )
}
