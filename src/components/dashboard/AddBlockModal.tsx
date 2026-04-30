import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon, type IconName } from '../../lib/icons'
import type { ChartType, BlockDimension, NewDashboardBlock } from '../../lib/api/dashboardBlocks'

const FONT = "'Space Grotesk', sans-serif"

interface ChartTypeOption {
  type: ChartType
  label: string
  icon: IconName
  description: string
}

const CHART_TYPES: ChartTypeOption[] = [
  { type: 'bar', label: 'Gráfico de barras', icon: 'BarChart3', description: 'Comparar quantidades entre categorias' },
  { type: 'pie', label: 'Gráfico de pizza', icon: 'GanttChart', description: 'Mostrar proporções de um total' },
  { type: 'line', label: 'Gráfico de linhas', icon: 'TrendingUp', description: 'Visualizar tendência ao longo de etapas' },
]

interface DimensionOption {
  value: BlockDimension
  label: string
}

const DIMENSIONS: DimensionOption[] = [
  { value: 'column', label: 'Cartões por lista' },
  { value: 'tag', label: 'Cartões por etiqueta' },
  { value: 'assignee', label: 'Cartões por responsável' },
  { value: 'priority', label: 'Cartões por prioridade' },
  { value: 'due_date', label: 'Cartões por data de entrega' },
]

interface AddBlockModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (block: NewDashboardBlock) => void
}

export default function AddBlockModal({ open, onClose, onConfirm }: AddBlockModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [dimension, setDimension] = useState<BlockDimension>('column')

  const reset = () => {
    setStep(1)
    setChartType('bar')
    setDimension('column')
  }

  const handleClose = () => {
    onClose()
    setTimeout(reset, 200)
  }

  const handleConfirm = () => {
    const dimLabel = DIMENSIONS.find(d => d.value === dimension)?.label ?? 'Cartões'
    onConfirm({ chart_type: chartType, dimension, title: dimLabel })
    handleClose()
  }

  const chartLabel = CHART_TYPES.find(c => c.type === chartType)?.label ?? ''

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="add-block-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={handleClose}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
              zIndex: 1000, backdropFilter: 'blur(2px)',
            }}
          />
          <motion.div
            key="add-block-modal"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-block-title"
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              zIndex: 1001, width: 'min(560px, 92vw)',
              background: '#22272b', border: '1px solid rgba(166,197,226,0.14)',
              borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
              fontFamily: FONT, color: '#E6E5E8', overflow: 'hidden',
            }}
          >
            <header style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <h2 id="add-block-title" style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                {step === 1 ? 'Adicionar bloco' : `Adicionar ${chartLabel.toLowerCase()}`}
              </h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Fechar"
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#8C96A3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.12s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <Icon name="X" size={14} />
              </button>
            </header>

            <div style={{ padding: 18, minHeight: 280 }}>
              {step === 1 ? (
                <Step1
                  selected={chartType}
                  onSelect={setChartType}
                />
              ) : (
                <Step2
                  selected={dimension}
                  onSelect={setDimension}
                />
              )}
            </div>

            <footer style={{
              display: 'flex', justifyContent: step === 1 ? 'flex-end' : 'space-between',
              alignItems: 'center', gap: 10,
              padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(0,0,0,0.18)',
            }}>
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: 'transparent', border: '1px solid rgba(166,197,226,0.18)',
                    color: '#9FADBC', padding: '7px 14px', borderRadius: 7,
                    fontFamily: FONT, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Voltar
                </button>
              )}
              <button
                type="button"
                onClick={() => step === 1 ? setStep(2) : handleConfirm()}
                style={{
                  background: '#25D066', color: '#0d1417',
                  padding: '8px 16px', borderRadius: 7, border: 'none',
                  fontFamily: FONT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(37,208,102,0.35)',
                  transition: 'background 0.12s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = '#1BAD53' }}
                onMouseOut={e => { e.currentTarget.style.background = '#25D066' }}
              >
                {step === 1 ? 'Próximo' : 'Adicionar bloco'}
              </button>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Step1({ selected, onSelect }: { selected: ChartType; onSelect: (t: ChartType) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {CHART_TYPES.map(opt => {
        const active = selected === opt.type
        return (
          <button
            key={opt.type}
            type="button"
            onClick={() => onSelect(opt.type)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              padding: '20px 12px',
              background: active ? 'rgba(37,208,102,0.08)' : 'rgba(255,255,255,0.02)',
              border: `2px solid ${active ? '#25D066' : 'rgba(166,197,226,0.12)'}`,
              borderRadius: 10, cursor: 'pointer', textAlign: 'center',
              transition: 'all 0.15s ease',
              fontFamily: FONT,
            }}
            onMouseOver={e => {
              if (!active) e.currentTarget.style.borderColor = 'rgba(166,197,226,0.28)'
            }}
            onMouseOut={e => {
              if (!active) e.currentTarget.style.borderColor = 'rgba(166,197,226,0.12)'
            }}
          >
            <span style={{
              width: 56, height: 56, borderRadius: 12,
              background: active ? 'rgba(37,208,102,0.18)' : 'rgba(255,255,255,0.04)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: active ? '#25D066' : '#9FADBC',
              transition: 'background 0.15s, color 0.15s',
            }}>
              <Icon name={opt.icon} size={26} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: active ? '#E6E5E8' : '#D1D1D5' }}>
              {opt.label}
            </span>
            <span style={{ fontSize: 10.5, color: '#8C96A3', lineHeight: 1.4 }}>
              {opt.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Step2({ selected, onSelect }: { selected: BlockDimension; onSelect: (d: BlockDimension) => void }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: '#8C96A3', marginBottom: 10,
      }}>
        Tipo
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {DIMENSIONS.map(opt => {
          const active = selected === opt.value
          return (
            <label
              key={opt.value}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: active ? 'rgba(37,208,102,0.08)' : 'transparent',
                border: `1px solid ${active ? 'rgba(37,208,102,0.4)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'background 0.12s, border-color 0.12s',
              }}
              onMouseOver={e => {
                if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              }}
              onMouseOut={e => {
                if (!active) e.currentTarget.style.background = 'transparent'
              }}
            >
              <input
                type="radio"
                name="dimension"
                checked={active}
                onChange={() => onSelect(opt.value)}
                style={{ accentColor: '#25D066', width: 14, height: 14, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, color: active ? '#E6E5E8' : '#D1D1D5', fontWeight: active ? 600 : 500 }}>
                {opt.label}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
