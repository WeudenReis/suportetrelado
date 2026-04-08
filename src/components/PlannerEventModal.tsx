import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Clock, Disc, Edit3 } from 'lucide-react'
import type { PlannerEvent } from '../lib/supabase'

interface PlannerEventModalProps {
  isOpen: boolean
  onClose: () => void
  userEmail: string
  selectedDate: string // YYYY-MM-DD
  existingEvent?: PlannerEvent | null
  onSave: (event: Omit<PlannerEvent, 'id' | 'created_at' | 'updated_at'>) => void
  onDelete?: (id: string) => void
}

const COLORS = ['#579dff', '#4bce97', '#f5a623', '#ef5c48', '#a259ff', '#20c997', '#6366f1', '#ec4899', '#f97316', '#64748b']

const font = "'Space Grotesk', sans-serif"

export default function PlannerEventModal({
  isOpen,
  onClose,
  userEmail,
  selectedDate,
  existingEvent,
  onSave,
  onDelete
}: PlannerEventModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(selectedDate)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [color, setColor] = useState(COLORS[0])

  useEffect(() => {
    if (isOpen) {
      if (existingEvent) {
        setTitle(existingEvent.title) // eslint-disable-line react-hooks/set-state-in-effect -- inicialização de form a partir de props
        setDescription(existingEvent.description || '')
        setDate(existingEvent.date || selectedDate)
        setStartTime(existingEvent.start_time || '')
        setEndTime(existingEvent.end_time || '')
        setColor(existingEvent.color || COLORS[0])
      } else {
        setTitle('')
        setDescription('')
        setDate(selectedDate)
        setStartTime('')
        setEndTime('')
        setColor(COLORS[0])
      }
    }
  }, [isOpen, existingEvent, selectedDate])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      organization_id: '',
      user_email: userEmail,
      title: title.trim(),
      description: description.trim(),
      date,
      start_time: startTime || null,
      end_time: endTime || null,
      color,
    })
    onClose()
  }

  const handleDelete = () => {
    if (existingEvent && onDelete) {
      if (confirm('Tem certeza que deseja remover este evento?')) {
        onDelete(existingEvent.id)
        onClose()
      }
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-sm rounded-[14px] shadow-2xl overflow-hidden"
          style={{ background: '#22272b', border: '1px solid rgba(166,197,226,0.15)' }}
        >
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#E5E7EB', fontFamily: font }}>
              {existingEvent ? 'Editar Evento' : 'Novo Evento'}
            </h3>
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent',
                color: '#8C96A3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: '20px' }}>
            {/* Titulo */}
            <div style={{ marginBottom: 16 }}>
              <input
                autoFocus
                placeholder="Título do evento (ex: Reunião Daily)"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8, background: '#1d2125',
                  border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, fontFamily: font,
                  outline: 'none', transition: 'border-color 0.2s'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#579dff'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {/* Data e Hora */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#8C96A3', marginBottom: 6, fontFamily: font }}>
                  <Calendar size={12} /> Data
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, background: '#1d2125',
                    border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, fontFamily: font,
                    outline: 'none', colorScheme: 'dark'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#579dff'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#8C96A3', marginBottom: 6, fontFamily: font }}>
                  <Clock size={12} /> Hora Início
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, background: '#1d2125',
                    border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, fontFamily: font,
                    outline: 'none', colorScheme: 'dark'
                  }}
                />
              </div>
            </div>

            {/* Descrição */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#8C96A3', marginBottom: 6, fontFamily: font }}>
                <Edit3 size={12} /> Descrição (Opcional)
              </label>
              <textarea
                rows={3}
                placeholder="Detalhes..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8, background: '#1d2125',
                  border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, fontFamily: font,
                  outline: 'none', resize: 'none'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#579dff'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {/* Cores */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#8C96A3', marginBottom: 8, fontFamily: font }}>
                <Disc size={12} /> Cor do Evento
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{
                      width: 24, height: 24, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                      transform: color === c ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: color === c ? `0 0 0 2px #22272b, 0 0 0 4px ${c}` : 'none',
                      transition: 'all 0.15s'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {existingEvent && (
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: font,
                    background: 'transparent', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)',
                    cursor: 'pointer', marginRight: 'auto'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  Excluir
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: font,
                  background: 'rgba(255,255,255,0.08)', color: '#E5E7EB', border: 'none', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim()}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: font,
                  background: title.trim() ? '#579dff' : 'rgba(87,157,255,0.3)', 
                  color: '#fff', border: 'none', cursor: title.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
