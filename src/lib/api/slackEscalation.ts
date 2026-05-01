import { supabase } from '../supabase'
import { logger } from '../logger'

export interface EscalateToSlackPayload {
  targetSlackUserId: string
  targetLabel: string
  webhookKey?: string
  customer: string
  instance: string
  backendUrl?: string | null
  problem: string
  logs?: string
  escalatedBy: string
  ticketTitle?: string
  ticketUrl?: string
}

export interface EscalateResult {
  ok: boolean
  error?: string
}

/**
 * Envia um payload de escalonamento para a Edge Function `slack-webhook`,
 * que monta os blocos do Slack Block Kit e dispara o webhook.
 */
export async function escalateToSlack(payload: EscalateToSlackPayload): Promise<EscalateResult> {
  try {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      'slack-webhook',
      { body: payload },
    )
    if (error) {
      logger.error('SlackEscalation', 'Edge function falhou', { error: error.message })
      return { ok: false, error: error.message }
    }
    if (data && data.ok) return { ok: true }
    return { ok: false, error: data?.error ?? 'Resposta inesperada do servidor' }
  } catch (err) {
    logger.error('SlackEscalation', 'Falha ao invocar edge function', { error: String(err) })
    return { ok: false, error: String(err) }
  }
}
