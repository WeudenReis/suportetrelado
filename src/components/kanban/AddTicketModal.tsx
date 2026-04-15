import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Plus, X, FileText, ChevronDown, Copy, Trash2, Loader2 } from 'lucide-react'
import type { Ticket, TicketStatus } from '../../lib/supabase'
import type { BoardColumn } from '../../lib/boardColumns'
import { fetchTemplates, insertTemplate, deleteTemplate, type TicketTemplate } from '../../lib/api/templates'
import { useOrg } from '../../lib/org'
import { useFocusTrap } from '../../hooks/useFocusTrap'

// Re-export para compatibilidade
export type { TicketTemplate }

interface AddTicketModalProps {
  columns: BoardColumn[]
  onAdd: (ticket: { title: string; description: string; priority: Ticket['priority']; status: TicketStatus; cliente: string; instancia: string }) => void
  onClose: () => void
  onShowToast: (msg: string, type: 'ok' | 'err') => void
  initialStatus: TicketStatus
  isCreating?: boolean
  user: string
}

export default function AddTicketModal({ columns, onAdd, onClose, onShowToast, initialStatus, isCreating, user }: AddTicketModalProps) {
  const { departmentId } = useOrg()
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'medium' as Ticket['priority'], status: initialStatus, cliente: '', instancia: '' })
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<TicketTemplate[]>([])
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, true)

  useEffect(() => {
    fetchTemplates(user, departmentId).then(setTemplates)
  }, [user, departmentId])

  const handleAdd = () => {
    if (!newTicket.title.trim()) return
    onAdd(newTicket)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="rounded-2xl w-full max-w-md overflow-hidden"
        style={{ background: '#1a1f23', border: '1px solid rgba(37,208,102,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Criar novo ticket"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,208,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={18} style={{ color: '#25D066' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#E5E7EB', margin: 0, fontFamily: "'Paytone One', sans-serif" }}>Novo Ticket</h2>
            <p style={{ fontSize: 11, color: '#596773', margin: 0, marginTop: 1 }}>Preencha os dados do chamado</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: '#596773', background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#B6C2CF' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#596773' }}><X size={16} /></button>
        </div>

        {/* Templates */}
        <div style={{ padding: '8px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={() => setShowTemplates(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: showTemplates ? 'rgba(37,208,102,0.08)' : 'transparent', border: '1px solid rgba(37,208,102,0.15)', color: '#25D066', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.background = showTemplates ? 'rgba(37,208,102,0.08)' : 'transparent' }}
          >
            <FileText size={12} /> Templates ({templates.length})
            <ChevronDown size={12} style={{ transform: showTemplates ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          {showTemplates && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {templates.length === 0 && (
                <p style={{ fontSize: 11, color: '#596773', padding: '8px 10px', fontFamily: "'Space Grotesk', sans-serif" }}>
                  Nenhum template salvo. Preencha o formulário e clique no ícone 📄 no rodapé para salvar.
                </p>
              )}
              {templates.map(tmpl => (
                <div key={tmpl.id} role="button" tabIndex={0}
                  onClick={() => { setNewTicket(p => ({ ...p, title: tmpl.title, description: tmpl.description, priority: tmpl.priority as Ticket['priority'], status: (tmpl.status || p.status) as TicketStatus })); setShowTemplates(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', color: '#B6C2CF', fontSize: 12, fontWeight: 500, fontFamily: "'Space Grotesk', sans-serif", textAlign: 'left', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.06)'; e.currentTarget.style.borderColor = 'rgba(37,208,102,0.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)' }}
                >
                  <Copy size={12} style={{ color: '#25D066', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tmpl.name}</span>
                    <span style={{ fontSize: 10, color: '#596773' }}>{tmpl.title}</span>
                  </div>
                  <button onClick={async e => { e.stopPropagation(); await deleteTemplate(tmpl.id, departmentId); setTemplates(prev => prev.filter(t => t.id !== tmpl.id)) }}
                    style={{ background: 'transparent', border: 'none', color: '#596773', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', transition: 'color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#596773' }}
                    title="Remover template"
                  ><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto modal-scroll">
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, color: '#25D066' }}>Título <span style={{ color: '#ef4444' }}>*</span></label>
            <input autoFocus placeholder="Título do ticket..." value={newTicket.title} onChange={e => setNewTicket(p => ({ ...p, title: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(37,208,102,0.15)', background: '#22272b', color: '#E5E7EB', fontSize: 14, fontWeight: 500, outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s', fontFamily: "'Space Grotesk', sans-serif" }} onFocus={e => { e.currentTarget.style.borderColor = '#25D066'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.1)' }} onBlur={e => { e.currentTarget.style.borderColor = 'rgba(37,208,102,0.15)'; e.currentTarget.style.boxShadow = 'none' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, color: '#B6C2CF' }}>Cliente</label>
              <input placeholder="Nome do cliente..." value={newTicket.cliente} onChange={e => setNewTicket(p => ({ ...p, cliente: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: '#22272b', color: '#E5E7EB', fontSize: 13, outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s', fontFamily: "'Space Grotesk', sans-serif" }} onFocus={e => { e.currentTarget.style.borderColor = '#25D066'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.1)' }} onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, color: '#B6C2CF' }}>Instância</label>
              <input placeholder="Código da instância..." value={newTicket.instancia} onChange={e => setNewTicket(p => ({ ...p, instancia: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: '#22272b', color: '#E5E7EB', fontSize: 13, outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s', fontFamily: "'Space Grotesk', sans-serif" }} onFocus={e => { e.currentTarget.style.borderColor = '#25D066'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.1)' }} onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, color: '#B6C2CF' }}>Prioridade</label>
              <select value={newTicket.priority} onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value as Ticket['priority'] }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: '#22272b', color: '#E5E7EB', fontSize: 13, outline: 'none', cursor: 'pointer', appearance: 'none' as const, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2525D066' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, fontFamily: "'Space Grotesk', sans-serif", transition: 'border-color 0.15s' }} onFocus={e => { e.currentTarget.style.borderColor = '#25D066' }} onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, color: '#B6C2CF' }}>Coluna</label>
              <select value={newTicket.status} onChange={e => setNewTicket(p => ({ ...p, status: e.target.value as TicketStatus }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: '#22272b', color: '#E5E7EB', fontSize: 13, outline: 'none', cursor: 'pointer', appearance: 'none' as const, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2525D066' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32, fontFamily: "'Space Grotesk', sans-serif", transition: 'border-color 0.15s' }} onFocus={e => { e.currentTarget.style.borderColor = '#25D066' }} onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
                {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, color: '#B6C2CF' }}>Descrição</label>
            <textarea placeholder="Descreva o problema em detalhes..." value={newTicket.description} onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))} rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: '#22272b', color: '#E5E7EB', fontSize: 13, outline: 'none', resize: 'none' as const, fontFamily: "'Space Grotesk', sans-serif", transition: 'border-color 0.15s, box-shadow 0.15s' }} onFocus={e => { e.currentTarget.style.borderColor = '#25D066'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,208,102,0.1)' }} onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none' }} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={async () => {
            if (!newTicket.title.trim()) { onShowToast('Preencha o título para salvar como template', 'err'); return }
            const templateName = prompt('Nome do template:')
            if (!templateName?.trim()) return
            const saved = await insertTemplate({ name: templateName.trim(), title: newTicket.title, description: newTicket.description, priority: newTicket.priority, status: newTicket.status }, user, departmentId)
            if (saved) setTemplates(prev => [...prev, saved])
            onShowToast('Template salvo!', 'ok')
          }}
            style={{ padding: '11px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#25D066', background: 'rgba(37,208,102,0.06)', border: '1px solid rgba(37,208,102,0.15)', cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Space Grotesk', sans-serif", display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,208,102,0.06)' }}
            title="Salvar como template"
          ><FileText size={13} /></button>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#8C96A3', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Space Grotesk', sans-serif" }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#E5E7EB' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#8C96A3' }}>Cancelar</button>
          <button onClick={handleAdd} disabled={!newTicket.title.trim() || isCreating} style={{ flex: 1, padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', background: (newTicket.title.trim() && !isCreating) ? '#25D066' : 'rgba(37,208,102,0.3)', border: 'none', cursor: (newTicket.title.trim() && !isCreating) ? 'pointer' : 'not-allowed', transition: 'all 0.15s', fontFamily: "'Space Grotesk', sans-serif", boxShadow: (newTicket.title.trim() && !isCreating) ? '0 2px 12px rgba(37,208,102,0.3)' : 'none' }} onMouseEnter={e => { if (newTicket.title.trim() && !isCreating) e.currentTarget.style.background = '#1BAD53' }} onMouseLeave={e => { if (newTicket.title.trim() && !isCreating) e.currentTarget.style.background = '#25D066' }}>
            {isCreating ? (
              <><Loader2 size={15} className="inline mr-1 animate-spin" style={{ verticalAlign: '-2px' }} />Criando...</>
            ) : (
              <><Plus size={15} className="inline mr-1" style={{ verticalAlign: '-2px' }} />Criar Ticket</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
