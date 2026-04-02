import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Settings, Bell, CalendarIcon, Loader2 } from 'lucide-react'
import { fetchPlannerSettings, upsertPlannerSettings } from '../lib/supabase'

interface PlannerSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  userEmail: string
}

const font = "'Space Grotesk', sans-serif"

export default function PlannerSettingsPanel({ isOpen, onClose, userEmail }: PlannerSettingsPanelProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notifyDaysBefore, setNotifyDaysBefore] = useState<number[]>([1]) // Default 1 day before

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      fetchPlannerSettings(userEmail).then(settings => {
        if (settings && settings.notify_days_before) {
          setNotifyDaysBefore(settings.notify_days_before)
        }
        setLoading(false)
      })
    }
  }, [isOpen, userEmail])

  const toggleDay = (day: number) => {
    setNotifyDaysBefore(prev => {
      if (prev.includes(day)) return prev.filter(d => d !== day)
      return [...prev, day].sort()
    })
  }

  const handleSave = async () => {
    setSaving(true)
    await upsertPlannerSettings({ user_email: userEmail, notify_days_before: notifyDaysBefore })
    setSaving(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[998]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={{
              position: 'absolute', top: 60, right: 20, zIndex: 999, width: 320,
              background: '#22272b', borderRadius: 14, overflow: 'hidden',
              border: '1px solid rgba(166,197,226,0.15)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={16} color="#8C96A3" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#E5E7EB', fontFamily: font }}>
                  Configurações do Planejador
                </h3>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent',
                  color: '#8C96A3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <X size={14} />
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center', color: '#8C96A3' }}>
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : (
              <div style={{ padding: '20px' }}>
                
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#B6C2CF' }}>
                    <Bell size={14} />
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: font }}>Alertas de Vencimento</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#596773', marginBottom: 12, lineHeight: 1.4, fontFamily: font }}>
                    Receba notificações na sua Caixa de Entrada antes do vencimento dos cartões. 
                    (Apenas para cartões com data de entrega).
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { value: 1, label: '1 dia (24h) antes' },
                      { value: 2, label: '2 dias antes' },
                      { value: 3, label: '3 dias antes' },
                    ].map(opt => (
                      <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, 
                          border: notifyDaysBefore.includes(opt.value) ? 'none' : '1px solid rgba(255,255,255,0.2)',
                          background: notifyDaysBefore.includes(opt.value) ? '#579dff' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {notifyDaysBefore.includes(opt.value) && (
                            <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </motion.svg>
                          )}
                        </div>
                        <span style={{ fontSize: 13, color: '#E5E7EB', fontFamily: font }}>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: font,
                      background: '#579dff', color: '#fff', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    {saving && <Loader2 size={12} className="animate-spin" />}
                    Salvar Preferências
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
