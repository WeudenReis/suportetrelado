import React, { useState } from 'react'
import { X, Loader2, Send } from 'lucide-react'
import type { Ticket, Attachment } from '../lib/supabase'
import { SLACK_CHANNELS, sendToSlack } from '../lib/slack'

interface EscalonarModalProps {
  ticket: Ticket
  attachments: Attachment[]
  cliente: string
  instancia: string
  linkRetaguarda: string
  description: string
  onClose: () => void
  onSent: () => void
}

export default function EscalonarModal({
  ticket,
  attachments,
  cliente,
  instancia,
  linkRetaguarda,
  description,
  onClose,
  onSent,
}: EscalonarModalProps) {
  const [channelId, setChannelId] = useState(SLACK_CHANNELS[0].id)
  const [clienteVal, setClienteVal] = useState(cliente)
  const [instanciaVal, setInstanciaVal] = useState(instancia)
  const [retaguardaVal, setRetaguardaVal] = useState(linkRetaguarda)
  const [problemaVal, setProblemaVal] = useState(description)
  const [logsVal, setLogsVal] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    if (!problemaVal.trim()) return
    setSending(true)
    setError('')
    try {
      const currentTicket: Ticket = {
        ...ticket,
        cliente: clienteVal,
        instancia: instanciaVal,
        link_retaguarda: retaguardaVal,
        description: problemaVal,
      }
      await sendToSlack(currentTicket, attachments, { channelId, logs: logsVal })
      onSent()
    } catch (err) {
      console.error('Slack error:', err)
      setError('Erro ao enviar. Verifique a configuração do canal.')
    }
    setSending(false)
  }

  const fieldStyle = {
    background: '#22272b',
    color: '#b6c2cf',
    border: '1px solid rgba(166,197,226,0.16)',
  } as const

  const labelStyle = {
    display: 'block',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '4px',
    color: '#596773',
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(2px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full mx-4 rounded-xl overflow-hidden"
        style={{
          maxWidth: 480,
          background: '#1d2125',
          border: '1px solid rgba(166,197,226,0.18)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#22272b' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 36, height: 36, background: 'rgba(74,21,75,0.35)', border: '1px solid rgba(224,30,90,0.25)' }}
            >
              <Send size={16} style={{ color: '#E01E5A' }} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: '#b6c2cf' }}>Escalonar para TI</div>
              <div className="text-xs" style={{ color: '#596773' }}>
                Notifica o destinatário no Slack com o contexto do ticket.
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
            style={{ color: '#596773' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {/* Destinatário */}
          <div>
            <label style={labelStyle}>Destinatário</label>
            <select
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            >
              {SLACK_CHANNELS.map(ch => (
                <option key={ch.id} value={ch.id}>
                  {ch.label} — Grupo @{ch.groupHandle}
                </option>
              ))}
            </select>
          </div>

          {/* Cliente + Instância */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Cliente</label>
              <input
                value={clienteVal}
                onChange={e => setClienteVal(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={fieldStyle}
                placeholder="Nome do cliente"
              />
            </div>
            <div>
              <label style={labelStyle}>Instância</label>
              <input
                value={instanciaVal}
                onChange={e => setInstanciaVal(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={fieldStyle}
                placeholder="Ex.: chatpro-2fbe2905b7"
              />
            </div>
          </div>

          {/* Retaguarda */}
          <div>
            <label style={labelStyle}>Retaguarda</label>
            <input
              value={retaguardaVal}
              onChange={e => setRetaguardaVal(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm outline-none"
              style={fieldStyle}
              placeholder="https://..."
            />
          </div>

          {/* Problema */}
          <div>
            <label style={labelStyle}>
              Problema <span style={{ color: '#ef5c48' }}>*</span>
            </label>
            <textarea
              value={problemaVal}
              onChange={e => setProblemaVal(e.target.value)}
              rows={4}
              className="w-full rounded-md px-3 py-2 text-sm outline-none resize-y"
              style={{
                ...fieldStyle,
                border: !problemaVal.trim()
                  ? '1px solid rgba(239,92,72,0.5)'
                  : fieldStyle.border,
              }}
              placeholder="Descreva o problema relatado pelo cliente"
            />
          </div>

          {/* Logs */}
          <div>
            <label style={labelStyle}>Logs (opcional)</label>
            <textarea
              value={logsVal}
              onChange={e => setLogsVal(e.target.value)}
              rows={3}
              className="w-full rounded-md px-3 py-2 outline-none resize-y font-mono"
              style={{ ...fieldStyle, fontSize: '11px', color: '#8c9bab' }}
              placeholder="Stack trace, JSON, GraphQL... entra como bloco de código"
            />
          </div>

          {error && (
            <p className="text-xs px-3 py-2 rounded-md" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-white/5"
            style={{ color: '#596773' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={!problemaVal.trim() || sending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: '#4A154B', color: '#fff' }}
          >
            {sending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                </svg>
                Enviar para o Slack
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
