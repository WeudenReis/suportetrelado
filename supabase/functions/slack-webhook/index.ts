// Supabase Edge Function: slack-webhook
// Recebe um payload de escalonamento do frontend, monta uma mensagem
// no formato Slack Block Kit e envia para o Incoming Webhook do canal.
//
// Variaveis de ambiente esperadas:
//   - SLACK_WEBHOOK_URL  (obrigatorio)
//
// Deploy:
//   supabase functions deploy slack-webhook
//   supabase secrets set SLACK_WEBHOOK_URL=https://hooks.slack.com/...

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

interface EscalationPayload {
  targetSlackUserId: string   // ex.: 'U0XXX' ou 'S0YYY' (usergroup)
  targetLabel: string          // ex.: 'Pedro Saddi' (apenas para auditoria)
  customer: string
  instance: string
  backendUrl?: string
  problem: string
  logs?: string
  escalatedBy: string          // email do agente que escalou
  ticketTitle?: string
  ticketUrl?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** Decide o formato da mencao: usergroup (S...) usa <!subteam^ID> */
function mention(slackId: string): string {
  if (!slackId) return ''
  if (slackId.startsWith('S')) return `<!subteam^${slackId}>`
  if (slackId === 'channel' || slackId === 'here') return `<!${slackId}>`
  return `<@${slackId}>`
}

function buildBlocks(p: EscalationPayload) {
  const blocks: any[] = []

  // Linha 1: mencao (similar ao screenshot)
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: mention(p.targetSlackUserId) },
  })

  // Bloco principal com fields
  const fields: { type: string; text: string }[] = [
    { type: 'mrkdwn', text: `*Cliente:*\n${p.customer || '_não informado_'}` },
    { type: 'mrkdwn', text: `*Instância:*\n${p.instance || '_não informada_'}` },
  ]
  if (p.backendUrl) {
    fields.push({ type: 'mrkdwn', text: `*Retaguarda:*\n<${p.backendUrl}|abrir>` })
  } else {
    fields.push({ type: 'mrkdwn', text: '*Retaguarda:*\n_não informada_' })
  }
  // Slack permite no maximo 10 fields, em pares
  blocks.push({ type: 'section', fields })

  // Problema (texto longo - melhor em section dedicada)
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: `*Problema:*\n${p.problem || '_não informado_'}` },
  })

  // Logs opcionais em bloco de codigo
  if (p.logs && p.logs.trim()) {
    // Slack tem limite de 3000 chars por bloco. Trunca se passar.
    const trimmed = p.logs.length > 2800 ? p.logs.slice(0, 2800) + '\n...[truncado]' : p.logs
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '```' + trimmed + '```' },
    })
  }

  // Rodape com origem (quem escalou + ticket)
  const contextElements: { type: string; text: string }[] = [
    { type: 'mrkdwn', text: `:bust_in_silhouette: *${p.escalatedBy}*` },
  ]
  if (p.ticketTitle) {
    const ticketStr = p.ticketUrl
      ? `<${p.ticketUrl}|${p.ticketTitle}>`
      : p.ticketTitle
    contextElements.push({ type: 'mrkdwn', text: `:ticket: ${ticketStr}` })
  }
  blocks.push({ type: 'context', elements: contextElements })

  return blocks
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
  if (!webhookUrl) {
    return jsonResponse({ error: 'SLACK_WEBHOOK_URL não configurado' }, 500)
  }

  let payload: EscalationPayload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400)
  }

  // Validacoes basicas
  if (!payload.targetSlackUserId || !payload.problem || !payload.escalatedBy) {
    return jsonResponse({ error: 'Campos obrigatórios ausentes (targetSlackUserId, problem, escalatedBy)' }, 400)
  }

  const blocks = buildBlocks(payload)
  const fallback = `Escalonamento de ${payload.escalatedBy}: ${payload.problem.slice(0, 80)}`

  try {
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fallback, blocks }),
    })
    if (!slackRes.ok) {
      const detail = await slackRes.text()
      return jsonResponse({ error: 'Slack rejeitou o payload', detail }, 502)
    }
    return jsonResponse({ ok: true })
  } catch (err) {
    return jsonResponse({ error: 'Falha ao conectar ao Slack', detail: String(err) }, 500)
  }
})
