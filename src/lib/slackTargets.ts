/**
 * Destinatários disponíveis no select "Escalonar para TI".
 *
 * slackId:
 *   'channel' → <!channel>  notifica todos os membros do canal
 *   'here'    → <!here>     notifica apenas membros ativos
 *   'U...'    → <@U...>     menciona usuário específico
 *   'S...'    → <!subteam^S...> menciona grupo
 *
 * webhookKey: nome do secret no Supabase com a URL do webhook.
 *   Se omitido, usa SLACK_WEBHOOK_URL (padrão).
 *   Para adicionar canal: crie webhook no Slack → adicione secret no Supabase
 *   → adicione entrada aqui com webhookKey apontando para o secret.
 */

export interface SlackTarget {
  key: string
  slackId: string
  label: string
  description?: string
  webhookKey?: string
}

export const SLACK_TARGETS: SlackTarget[] = [
  {
    key: 'suporte_teste',
    slackId: 'channel',
    label: '#suporte-teste',
    description: 'Notificar todo o canal',
    webhookKey: 'SLACK_WEBHOOK_URL_DEVS',
  },
]

export function findSlackTarget(key: string): SlackTarget | undefined {
  return SLACK_TARGETS.find(t => t.key === key)
}
