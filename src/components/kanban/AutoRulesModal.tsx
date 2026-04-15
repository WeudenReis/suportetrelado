import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Settings, X, RefreshCw, Trash2, Check } from 'lucide-react'
import type { BoardColumn } from '../../lib/boardColumns'
import { fetchAutoRules, insertAutoRule, updateAutoRule, deleteAutoRule, loadAutoRulesCache, saveLocalRules } from '../../lib/api/templates'
import { useFocusTrap } from '../../hooks/useFocusTrap'

export interface AutoRule {
  id: string
  name: string
  condition: 'priority_high' | 'priority_medium' | 'priority_low' | 'no_assignee' | 'overdue_12h' | 'overdue_24h'
  action: 'move_to'
  targetColumn: string
  enabled: boolean
}

export const AUTO_RULE_CONDITIONS: Record<string, string> = {
  priority_high: 'Prioridade Alta',
  priority_medium: 'Prioridade Média',
  priority_low: 'Prioridade Baixa',
  no_assignee: 'Sem responsável',
  overdue_12h: 'Parado há +12h',
  overdue_24h: 'Parado há +24h',
}

// Leitor síncrono do cache local (mantido para compatibilidade com consumidores antigos)
export function loadAutoRules(departmentId?: string | null): AutoRule[] {
  return loadAutoRulesCache(departmentId) as AutoRule[]
}

interface AutoRulesModalProps {
  columns: BoardColumn[]
  onClose: () => void
  onRunRules: () => void
  onShowToast: (msg: string, type: 'ok' | 'err') => void
  user: string
  departmentId?: string | null
}

export default function AutoRulesModal({ columns, onClose, onRunRules, onShowToast, user, departmentId }: AutoRulesModalProps) {
  const [rules, setRules] = useState<AutoRule[]>(() => loadAutoRules(departmentId))
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, true)

  // Carregar do banco na montagem (fetchAutoRules já atualiza o cache local)
  useEffect(() => {
    fetchAutoRules(user, departmentId).then(dbRules => {
      setRules(dbRules as AutoRule[])
    })
  }, [user, departmentId])

  const handleToggle = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId)
    if (!rule) return
    const updated = rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r)
    setRules(updated)
    saveLocalRules(updated, departmentId)
    await updateAutoRule(ruleId, { enabled: !rule.enabled }, departmentId)
    onClose()
    setTimeout(() => onRunRules(), 10)
  }

  const handleDelete = async (ruleId: string) => {
    const updated = rules.filter(r => r.id !== ruleId)
    setRules(updated)
    saveLocalRules(updated, departmentId)
    await deleteAutoRule(ruleId, departmentId)
    onClose()
    setTimeout(() => onRunRules(), 10)
  }

  const handleCreate = async () => {
    const condEl = document.getElementById('rule-condition') as HTMLSelectElement
    const targetEl = document.getElementById('rule-target') as HTMLSelectElement
    if (!condEl?.value || !targetEl?.value) { onShowToast('Selecione condição e destino', 'err'); return }
    const condLabel = AUTO_RULE_CONDITIONS[condEl.value] || condEl.value
    const targetLabel = columns.find(c => c.id === targetEl.value)?.title || targetEl.value
    const newRule = await insertAutoRule({
      name: `${condLabel} → ${targetLabel}`,
      condition: condEl.value,
      action: 'move_to',
      targetColumn: targetEl.value,
      enabled: true,
    }, user, departmentId)
    if (newRule) {
      const updated = [...rules, newRule as AutoRule]
      setRules(updated)
      saveLocalRules(updated, departmentId)
    }
    onClose()
    setTimeout(() => onRunRules(), 10)
    onShowToast('Regra criada!', 'ok')
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Regras automáticas"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
        style={{ background: '#1a1f23', border: '1px solid rgba(37,208,102,0.1)' }}
      >
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(37,208,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={15} style={{ color: '#25D066' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#E5E7EB', margin: 0, fontFamily: "'Paytone One', sans-serif" }}>Regras Automáticas</h3>
            <p style={{ fontSize: 10, color: '#596773', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>Mover cards automaticamente</p>
          </div>
          <button onClick={onClose} style={{ color: '#596773', background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8 }}><X size={15} /></button>
        </div>

        <div className="px-5 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={async () => { onClose(); onRunRules(); onShowToast('Regras executadas!', 'ok') }}
            style={{
              width: '100%', padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              background: 'rgba(37,208,102,0.08)', border: '1px solid rgba(37,208,102,0.15)',
              color: '#25D066', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.08)' }}
          >
            <RefreshCw size={12} />
            Executar regras agora
          </button>
        </div>

        <div className="p-4" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rules.map(rule => (
              <div key={rule.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderRadius: 10, background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${rule.enabled ? 'rgba(37,208,102,0.15)' : 'rgba(255,255,255,0.04)'}`,
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                <button
                  onClick={() => handleToggle(rule.id)}
                  style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: rule.enabled ? '2px solid #25D066' : '2px solid rgba(255,255,255,0.18)',
                    background: rule.enabled ? '#25D066' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  {rule.enabled && <Check size={10} strokeWidth={3} color="#000" />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: rule.enabled ? '#E5E7EB' : '#596773', display: 'block' }}>{rule.name}</span>
                  <span style={{ fontSize: 10, color: '#596773' }}>
                    Se {AUTO_RULE_CONDITIONS[rule.condition]} → Mover para {columns.find(c => c.id === rule.targetColumn)?.title || rule.targetColumn}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(rule.id)}
                  style={{ background: 'transparent', border: 'none', color: '#596773', cursor: 'pointer', padding: 4, borderRadius: 4 }}
                  title="Remover regra"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {rules.length === 0 && (
              <p style={{ fontSize: 12, color: '#596773', textAlign: 'center', padding: '20px 0', fontFamily: "'Space Grotesk', sans-serif" }}>
                Nenhuma regra criada ainda
              </p>
            )}
          </div>
        </div>

        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#596773', marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase' }}>Nova regra</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select
              id="rule-condition"
              defaultValue=""
              style={{
                flex: 1, minWidth: 120, padding: '7px 10px', borderRadius: 8, fontSize: 11,
                background: '#22272b', border: '1px solid rgba(255,255,255,0.08)', color: '#B6C2CF',
                outline: 'none', fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              <option value="" disabled>Condição...</option>
              {Object.entries(AUTO_RULE_CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select
              id="rule-target"
              defaultValue=""
              style={{
                flex: 1, minWidth: 120, padding: '7px 10px', borderRadius: 8, fontSize: 11,
                background: '#22272b', border: '1px solid rgba(255,255,255,0.08)', color: '#B6C2CF',
                outline: 'none', fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              <option value="" disabled>Mover para...</option>
              {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <button
              onClick={handleCreate}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                background: '#25D066', border: 'none', color: '#000', cursor: 'pointer',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Criar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
