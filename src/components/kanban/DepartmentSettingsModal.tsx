import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2, Save, RotateCcw, Building2 } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useDepartmentSettings } from '../../hooks/useDepartmentSettings'
import {
  DEFAULT_DEPARTMENT_SETTINGS,
  type DepartmentSettings,
  type SupportFieldKey,
} from '../../lib/departmentSettings'

interface DepartmentSettingsModalProps {
  onClose: () => void
  onShowToast?: (msg: string, type: 'ok' | 'err') => void
}

const FIELD_LABELS: Record<SupportFieldKey, string> = {
  cliente: 'Cliente',
  instancia: 'Instância',
  link_retaguarda: 'Link Retaguarda',
  link_sessao: 'Link Sessão',
  observacao: 'Observações',
}

export default function DepartmentSettingsModal({ onClose, onShowToast }: DepartmentSettingsModalProps) {
  const { settings, save, loading } = useDepartmentSettings()
  const [draft, setDraft] = useState<DepartmentSettings>(settings)
  const [saving, setSaving] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, true)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const handleFieldToggle = (key: SupportFieldKey, visible: boolean) => {
    setDraft(d => ({ ...d, fields: { ...d.fields, [key]: { ...d.fields[key], visible } } }))
  }
  const handleFieldLabel = (key: SupportFieldKey, label: string) => {
    setDraft(d => ({ ...d, fields: { ...d.fields, [key]: { ...d.fields[key], label } } }))
  }
  const handleModuleToggle = (key: 'announcements' | 'links', on: boolean) => {
    setDraft(d => ({ ...d, modules: { ...d.modules, [key]: on } }))
  }
  const handleTerminology = (key: 'ticket_singular' | 'ticket_plural', value: string) => {
    setDraft(d => ({ ...d, terminology: { ...d.terminology, [key]: value } }))
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await save(draft)
    setSaving(false)
    if (error) {
      onShowToast?.(`Falha ao salvar: ${error}`, 'err')
      return
    }
    onShowToast?.('Configurações do departamento salvas.', 'ok')
    onClose()
  }

  const handleReset = () => {
    setDraft(DEFAULT_DEPARTMENT_SETTINGS)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Configurações do departamento"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="rounded-2xl w-full max-w-lg flex flex-col"
        style={{
          background: '#1a1f23',
          border: '1px solid rgba(37,208,102,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
          maxHeight: 'calc(100dvh - 2rem)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,208,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} style={{ color: '#25D066' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#E5E7EB', margin: 0, fontFamily: "'Paytone One', sans-serif" }}>Configurações do Departamento</h2>
            <p style={{ fontSize: 11, color: '#596773', margin: 0, marginTop: 1 }}>Ajuste campos e terminologia específicos deste departamento</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: '#596773', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#B6C2CF' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 flex-1 overflow-y-auto modal-scroll">
          {/* Terminologia */}
          <section>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#25D066', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: "'Space Grotesk', sans-serif" }}>Terminologia</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#B6C2CF', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Singular</label>
                <input value={draft.terminology.ticket_singular} onChange={e => handleTerminology('ticket_singular', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: '#22272b', color: '#E5E7EB', fontSize: 12, outline: 'none', fontFamily: "'Space Grotesk', sans-serif" }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#B6C2CF', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Plural</label>
                <input value={draft.terminology.ticket_plural} onChange={e => handleTerminology('ticket_plural', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: '#22272b', color: '#E5E7EB', fontSize: 12, outline: 'none', fontFamily: "'Space Grotesk', sans-serif" }} />
              </div>
            </div>
            <p style={{ fontSize: 10, color: '#596773', margin: '6px 0 0', fontFamily: "'Space Grotesk', sans-serif" }}>Ex.: "Chamado", "Negociação", "Solicitação"</p>
          </section>

          {/* Campos */}
          <section>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#25D066', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: "'Space Grotesk', sans-serif" }}>Campos do cartão</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Object.keys(FIELD_LABELS) as SupportFieldKey[]).map(key => {
                const cfg = draft.fields[key]
                return (
                  <div key={key} style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={cfg.visible}
                        onChange={e => handleFieldToggle(key, e.target.checked)}
                        style={{ width: 15, height: 15, accentColor: '#25D066', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#E5E7EB', fontFamily: "'Space Grotesk', sans-serif", flex: 1 }}>
                        {FIELD_LABELS[key]}
                      </span>
                      <span style={{ fontSize: 10, color: cfg.visible ? '#25D066' : '#596773', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
                        {cfg.visible ? 'Visível' : 'Oculto'}
                      </span>
                    </div>
                    {cfg.visible && (
                      <input
                        value={cfg.label ?? ''}
                        onChange={e => handleFieldLabel(key, e.target.value)}
                        placeholder={`Rótulo (padrão: ${FIELD_LABELS[key]})`}
                        style={{ width: '100%', marginTop: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: '#1a1f23', color: '#B6C2CF', fontSize: 11, outline: 'none', fontFamily: "'Space Grotesk', sans-serif" }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Módulos */}
          <section>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#25D066', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: "'Space Grotesk', sans-serif" }}>Módulos auxiliares</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                ['announcements', 'Mural de Avisos'],
                ['links', 'Links úteis'],
              ] as const).map(([key, label]) => (
                <div key={key} style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={draft.modules[key]}
                    onChange={e => handleModuleToggle(key, e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: '#25D066', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#E5E7EB', fontFamily: "'Space Grotesk', sans-serif", flex: 1 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 10, color: draft.modules[key] ? '#25D066' : '#596773', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
                    {draft.modules[key] ? 'Ativo' : 'Desativado'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={handleReset} disabled={saving}
            style={{ padding: '11px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#8C96A3', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Space Grotesk', sans-serif", display: 'flex', alignItems: 'center', gap: 5 }}
            title="Restaurar configuração padrão"
          >
            <RotateCcw size={13} /> Padrão
          </button>
          <button onClick={onClose} disabled={saving}
            style={{ flex: 1, padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#8C96A3', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            style={{ flex: 1, padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', background: saving ? 'rgba(37,208,102,0.3)' : '#25D066', border: 'none', cursor: saving || loading ? 'not-allowed' : 'pointer', fontFamily: "'Space Grotesk', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, boxShadow: '0 2px 12px rgba(37,208,102,0.3)' }}>
            {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <><Save size={15} /> Salvar</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
