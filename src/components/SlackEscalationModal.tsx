import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '../lib/icons'
import { SLACK_TARGETS, findSlackTarget } from '../lib/slackTargets'
import { escalateToSlack } from '../lib/api/slackEscalation'

const FONT = "'Space Grotesk', sans-serif"
const FONT_HEAD = "'Paytone One', sans-serif"

interface SlackEscalationModalProps {
  open: boolean
  onClose: () => void
  /** Pre-preenchimento e auditoria */
  ticket: {
    id: string
    title: string
    cliente?: string | null
    instancia?: string | null
    link_retaguarda?: string | null
    description?: string | null
  }
  /** Email do agente que esta escalando */
  escalatedBy: string
  /** Callback chamado apos envio com sucesso (para registrar activity_log, etc) */
  onSuccess?: (info: { targetLabel: string }) => void
}

export default function SlackEscalationModal({
  open, onClose, ticket, escalatedBy, onSuccess,
}: SlackEscalationModalProps) {
  const defaultTarget = SLACK_TARGETS[0]?.key ?? ''
  const [targetKey, setTargetKey] = useState(defaultTarget)
  const [customer, setCustomer] = useState('')
  const [instance, setInstance] = useState('')
  const [backendUrl, setBackendUrl] = useState('')
  const [problem, setProblem] = useState('')
  const [logs, setLogs] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Pre-preenchimento sempre que o modal abre com um ticket diferente.
  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza form com props quando o modal e (re)aberto */
  useEffect(() => {
    if (!open) return
    setCustomer(ticket.cliente ?? '')
    setInstance(ticket.instancia ?? '')
    setBackendUrl(ticket.link_retaguarda ?? '')
    setProblem(ticket.description ?? '')
    setLogs('')
    setErrorMsg(null)
    setTargetKey(defaultTarget)
  }, [open, ticket.id, ticket.cliente, ticket.instancia, ticket.link_retaguarda, ticket.description, defaultTarget])
  /* eslint-enable react-hooks/set-state-in-effect */

  const target = findSlackTarget(targetKey)
  const canSubmit = !!target && problem.trim().length > 0 && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target) return
    setSubmitting(true)
    setErrorMsg(null)

    const result = await escalateToSlack({
      targetSlackUserId: target.slackId,
      targetLabel: target.label,
      customer: customer.trim(),
      instance: instance.trim(),
      backendUrl: backendUrl.trim() || null,
      problem: problem.trim(),
      logs: logs.trim() || undefined,
      escalatedBy,
      ticketTitle: ticket.title,
      ticketUrl: typeof window !== 'undefined' ? `${window.location.origin}/?ticket=${ticket.id}` : undefined,
    })

    setSubmitting(false)
    if (result.ok) {
      onSuccess?.({ targetLabel: target.label })
      onClose()
    } else {
      setErrorMsg(result.error || 'Falha ao enviar para o Slack')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="slack-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={submitting ? undefined : onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            }}
          />
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 10001,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16, pointerEvents: 'none',
            }}
          >
            <motion.form
              key="slack-modal"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="slack-modal-title"
              style={{
                width: 'min(560px, 92vw)',
                maxHeight: '88vh',
                display: 'flex', flexDirection: 'column',
                background: '#22272b',
                border: '1px solid rgba(166,197,226,0.14)',
                borderRadius: 14,
                boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
                fontFamily: FONT, color: '#E6E5E8',
                overflow: 'hidden',
                pointerEvents: 'auto',
              }}
            >
              <header style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'linear-gradient(180deg, rgba(74,21,75,0.18), rgba(74,21,75,0))',
              }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: 'rgba(74,21,75,0.25)',
                  color: '#ECB22E',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name="Send" size={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 id="slack-modal-title" style={{
                    margin: 0, fontFamily: FONT_HEAD, fontSize: 16, color: '#E6E5E8', letterSpacing: -0.2,
                  }}>
                    Escalonar para TI
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8C96A3' }}>
                    Notifica o destinatário no Slack com o contexto do ticket.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  aria-label="Fechar"
                  style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: 'transparent', border: 'none',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    color: '#8C96A3',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseOver={e => { if (!submitting) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <Icon name="X" size={13} />
                </button>
              </header>

              <div style={{
                padding: '16px 18px',
                overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <Field label="Destinatário">
                  <select
                    value={targetKey}
                    onChange={e => setTargetKey(e.target.value)}
                    className="modal-field"
                    required
                  >
                    {SLACK_TARGETS.map(t => (
                      <option key={t.key} value={t.key}>
                        {t.label}{t.description ? ` — ${t.description}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Cliente">
                    <input
                      type="text" value={customer}
                      onChange={e => setCustomer(e.target.value)}
                      className="modal-field"
                      placeholder="Nome do cliente"
                    />
                  </Field>
                  <Field label="Instância">
                    <input
                      type="text" value={instance}
                      onChange={e => setInstance(e.target.value)}
                      className="modal-field"
                      placeholder="Ex.: chatpro-2fbe2905b7"
                    />
                  </Field>
                </div>

                <Field label="Retaguarda">
                  <input
                    type="url" value={backendUrl}
                    onChange={e => setBackendUrl(e.target.value)}
                    className="modal-field"
                    placeholder="https://..."
                  />
                </Field>

                <Field label="Problema *">
                  <textarea
                    value={problem}
                    onChange={e => setProblem(e.target.value)}
                    className="modal-field"
                    required
                    rows={4}
                    placeholder="Descreva o problema relatado pelo cliente"
                    style={{ resize: 'vertical', minHeight: 90 }}
                  />
                </Field>

                <Field label="Logs (opcional)">
                  <textarea
                    value={logs}
                    onChange={e => setLogs(e.target.value)}
                    className="modal-field"
                    rows={4}
                    placeholder="Stack trace, JSON, GraphQL... entra como bloco de código"
                    style={{
                      resize: 'vertical', minHeight: 90,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      fontSize: 12,
                    }}
                  />
                </Field>

                {errorMsg && (
                  <div style={{
                    padding: '8px 10px', borderRadius: 7,
                    background: 'rgba(239,92,72,0.10)', border: '1px solid rgba(239,92,72,0.32)',
                    color: '#ef5c48', fontSize: 11.5,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Icon name="AlertTriangle" size={12} />
                    {errorMsg}
                  </div>
                )}
              </div>

              <footer style={{
                display: 'flex', justifyContent: 'flex-end', gap: 8,
                padding: '12px 18px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(0,0,0,0.18)',
              }}>
                <button
                  type="button" onClick={onClose} disabled={submitting}
                  style={{
                    background: 'transparent', border: '1px solid rgba(166,197,226,0.18)',
                    color: '#9FADBC', padding: '7px 14px', borderRadius: 7,
                    fontFamily: FONT, fontSize: 12, fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={!canSubmit}
                  style={{
                    background: canSubmit ? '#25D066' : 'rgba(37,208,102,0.4)',
                    color: '#0d1417',
                    padding: '8px 16px', borderRadius: 7, border: 'none',
                    fontFamily: FONT, fontSize: 12, fontWeight: 700,
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    boxShadow: canSubmit ? '0 0 12px rgba(37,208,102,0.35)' : 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {submitting ? (
                    <>
                      <Icon name="Loader2" size={12} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Icon name="Send" size={12} />
                      Enviar para o Slack
                    </>
                  )}
                </button>
              </footer>
            </motion.form>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 10.5, fontWeight: 700, color: '#8C96A3',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {label}
      </span>
      {children}
    </label>
  )
}
