import { supabase } from './supabase'
import type { Ticket, Attachment } from './supabase'

export interface SlackChannel {
  id: string
  label: string
  groupHandle: string
}

// Para adicionar um novo canal: adicione uma entrada aqui e configure
// SLACK_WEBHOOK_URL_<ID_MAIUSCULO> nos secrets da Edge Function no Supabase.
// O canal "default" usa SLACK_WEBHOOK_URL (já configurado).
export const SLACK_CHANNELS: SlackChannel[] = [
  { id: 'default', label: 'Time Técnico', groupHandle: 'time-tecnico' },
]

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa 🟢',
  medium: 'Média 🟡',
  high: 'Alta 🔴',
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'Em andamento',
  waiting_devs: 'Aguardando Devs',
  resolved: 'Concluído',
}

export function buildSlackPayload(ticket: Ticket, attachments: Attachment[], opts?: { logs?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = []

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: ticket.title, emoji: true },
  })

  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Status:*\n${STATUS_LABELS[ticket.status] ?? ticket.status}` },
      { type: 'mrkdwn', text: `*Prioridade:*\n${PRIORITY_LABELS[ticket.priority] ?? ticket.priority}` },
    ],
  })

  blocks.push({ type: 'divider' })

  const infoFields: { type: string; text: string }[] = []
  if (ticket.cliente) infoFields.push({ type: 'mrkdwn', text: `*Cliente:*\n${ticket.cliente}` })
  if (ticket.instancia) infoFields.push({ type: 'mrkdwn', text: `*Instância:*\n${ticket.instancia}` })
  if (ticket.link_retaguarda) infoFields.push({ type: 'mrkdwn', text: `*Retaguarda:*\n<${ticket.link_retaguarda}|Abrir link>` })
  if (ticket.link_sessao) infoFields.push({ type: 'mrkdwn', text: `*Sessão:*\n<${ticket.link_sessao}|Abrir link>` })

  for (let i = 0; i < infoFields.length; i += 2) {
    blocks.push({ type: 'section', fields: infoFields.slice(i, i + 2) })
  }

  if (ticket.description?.trim()) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Problema:*\n${ticket.description}` },
    })
  }

  if (ticket.observacao?.trim()) {
    const lines = ticket.observacao.split('\n')
    const notes = lines.filter(l => !l.startsWith('☐') && !l.startsWith('☑')).join('\n').trim()
    const checkItems = lines
      .filter(l => l.startsWith('☐') || l.startsWith('☑'))
      .map(l => l.startsWith('☑') ? `✅ ${l.replace(/^☑\s*/, '')}` : `☐ ${l.replace(/^☐\s*/, '')}`)

    const parts: string[] = []
    if (notes) parts.push(notes)
    if (checkItems.length > 0) parts.push(checkItems.join('\n'))

    if (parts.length > 0) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Observações:*\n${parts.join('\n')}` },
      })
    }
  }

  if (attachments.length > 0) {
    blocks.push({ type: 'divider' })
    const links = attachments
      .map(a => `• <${a.file_url}|${a.file_name}>`)
      .join('\n')
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Prints / Evidências (${attachments.length}):*\n${links}` },
    })
  }

  if (opts?.logs?.trim()) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Logs:*\n\`\`\`${opts.logs.trim()}\`\`\`` },
    })
  }

  return { blocks }
}

export async function sendToSlack(
  ticket: Ticket,
  attachments: Attachment[],
  opts?: { channelId?: string; logs?: string }
): Promise<void> {
  const payload = buildSlackPayload(ticket, attachments, { logs: opts?.logs })
  const { error } = await supabase.functions.invoke('send-to-slack', {
    body: { ...payload, channelId: opts?.channelId },
  })
  if (error) throw error
}
