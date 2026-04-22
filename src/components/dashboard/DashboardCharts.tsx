import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

// ── Tipografia e paleta (alinhadas ao Manual de Marca chatPro / CLAUDE.md) ──
export const font = "'Space Grotesk', sans-serif"
export const fontH = "'Paytone One', sans-serif"

export const PRIORITY_C: Record<string, string> = {
  high:   '#ef5c48',
  medium: '#e2b203',
  low:    '#4bce97',
}

// Superfícies elevadas usadas nos trilhos e cards — deriva do Dark Kanban
// (#1d2125 / #22272b / #2c333a). Evitamos qualquer #000 puro para manter
// a legibilidade em ambientes com pouca luminosidade.
const TRACK_BG = 'rgba(44,51,58,0.55)'
const SURFACE_BG = 'rgba(44,51,58,0.5)'

function avatarColor(n: string): string {
  const colors = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899']
  return colors[(n.charCodeAt(0) || 0) % colors.length]
}

// ── Count-up animado (rAF + easeOutCubic, ~650 ms) ────────
export function useCountUp(target: number, duration = 650): number {
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

// ── Member Load Card (avatar + nome/% acima, barra robusta abaixo) ──
export function MemberLoadCard({ name, count, maxCount, index }: { name: string; count: number; maxCount: number; index: number }) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
  const fillPct = count > 0 ? Math.max(pct, 4) : 0
  const isNone = name === 'Sem responsável'
  const isHigh = pct > 80
  const barColor = isNone ? '#596773' : isHigh ? '#ef5c48' : '#25D066'
  const avatarBg = isNone ? '#596773' : avatarColor(name)
  const initials = (name || '??').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?'
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: SURFACE_BG, border: `1px solid ${isHigh ? '#ef5c4840' : 'rgba(255,255,255,0.06)'}`, boxShadow: isHigh ? `0 0 0 1px ${PRIORITY_C.high}15` : 'none' }}
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
