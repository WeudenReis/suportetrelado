/**
 * Destinatários disponíveis no select "Escalonar para TI".
 *
 * Cada entrada pode ser:
 *   - 'channel'  → <!channel>  notifica todos os membros do canal
 *   - 'here'     → <!here>     notifica apenas membros ativos no momento
 *   - 'U...'     → <@U...>     menciona um usuário específico
 *   - 'S...'     → <!subteam^S...> menciona um grupo
 *
 * Para adicionar um novo canal: crie um Incoming Webhook no Slack para
 * esse canal, adicione a URL como secret SLACK_WEBHOOK_URL_<KEY> no
 * Supabase, e adicione uma entrada com webhookKey apontando para esse secret.
 * Se webhookKey for omitido, usa o SLACK_WEBHOOK_URL padrão.
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
  },
]

export function findSlackTarget(key: string): SlackTarget | undefined {
  return SLACK_TARGETS.find(t => t.key === key)
}
