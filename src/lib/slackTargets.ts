/**
 * Lista de destinatarios disponiveis no select "Escalonar para TI".
 *
 * Como obter o `slackId`:
 *   - Usuario individual: abrir o perfil do membro no Slack > More > Copy member ID
 *     (formato 'U...').
 *   - User group/grupo: nas configuracoes do grupo > Copy group ID (formato 'S...').
 *     A Edge Function envolve esses em <!subteam^ID> automaticamente.
 *   - Mencionar todo o canal: usar 'channel' ou 'here' como slackId.
 */

export interface SlackTarget {
  /** Identificador interno usado no select. */
  key: string
  /** ID do Slack — `U...` (usuario), `S...` (grupo), `channel`, ou `here`. */
  slackId: string
  /** Nome exibido no select e gravado no activity_log. */
  label: string
  /** Texto auxiliar no select (cargo, descricao). */
  description?: string
}

export const SLACK_TARGETS: SlackTarget[] = [
  {
    key: 'pedro_saddi',
    slackId: 'U_REPLACE_WITH_REAL_ID',
    label: 'Pedro Saddi',
    description: 'CTO',
  },
  {
    key: 'time_tecnico',
    slackId: 'S_REPLACE_WITH_GROUP_ID',
    label: 'Time Técnico',
    description: 'Grupo @time-tecnico',
  },
]

export function findSlackTarget(key: string): SlackTarget | undefined {
  return SLACK_TARGETS.find(t => t.key === key)
}
