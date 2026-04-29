/**
 * Feed de release notes do chatPro.
 *
 * Convenção:
 * - Entradas em ordem cronológica decrescente (mais recente no topo).
 * - Datas no formato ISO YYYY-MM-DD (ordenam lexicograficamente).
 * - `id` único por entrada (usado para tracking de "última visualização").
 *
 * Para adicionar uma novidade: prepende um item no topo do array.
 */

export type ChangelogType = 'feat' | 'improvement' | 'fix' | 'security'

export interface ChangelogEntry {
  id: string
  date: string
  type: ChangelogType
  title: string
  description: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-04-29-header-unificado',
    date: '2026-04-29',
    type: 'improvement',
    title: 'Navegação unificada no topo',
    description:
      'Caixa de entrada, Planejador, Avisos e Links viraram ícones elegantes no canto superior direito. O dock flutuante inferior foi aposentado para reduzir poluição visual.',
  },
  {
    id: '2026-04-29-changelog',
    date: '2026-04-29',
    type: 'feat',
    title: 'Central de novidades',
    description:
      'Acompanhe pelo ícone de presente o que rola de novo no chatPro: features, melhorias e correções com data e descrição.',
  },
  {
    id: '2026-04-28-dashboard-cfd',
    date: '2026-04-28',
    type: 'feat',
    title: 'Dashboard+ ganha CFD aproximado',
    description:
      'Visualização cumulativa do fluxo por coluna ajuda a identificar gargalos e WIP crescendo descontroladamente.',
  },
  {
    id: '2026-04-28-cycle-time-histogram',
    date: '2026-04-28',
    type: 'feat',
    title: 'Histograma de Cycle Time',
    description:
      'Distribuição do tempo de resolução por faixas (<1h … >7d) com p50, p90 e tamanho da amostra.',
  },
  {
    id: '2026-04-27-top-clientes-forecast',
    date: '2026-04-27',
    type: 'feat',
    title: 'Top Clientes e Forecast de Backlog',
    description:
      'Veja os clientes que mais demandam atendimento e estime quantos dias até zerar o backlog com base na velocidade das últimas 4 semanas.',
  },
  {
    id: '2026-04-26-dashboard-plus',
    date: '2026-04-26',
    type: 'feat',
    title: 'Dashboard+ com KPIs comparativos',
    description:
      'Aging dos cards abertos, Heatmap de criação por hora/dia, Throughput semanal e KPIs com delta de período-sobre-período.',
  },
  {
    id: '2026-04-25-kanban-plus',
    date: '2026-04-25',
    type: 'feat',
    title: 'Kanban+ com swimlanes e ações em massa',
    description:
      'Agrupamento inline por responsável, prioridade ou cliente. Seleção múltipla com ações em lote (mover, concluir, arquivar).',
  },
  {
    id: '2026-04-24-security-hardening',
    date: '2026-04-24',
    type: 'security',
    title: 'Hardening de segurança no banco',
    description:
      'FORCE RLS em todas as tabelas, WITH CHECK em UPDATEs, search_path fixo em funções definer e revogação total para o role anon.',
  },
]

export const CHANGELOG_LAST_SEEN_KEY = 'chatpro-changelog-last-seen-id'

export function countUnseen(lastSeenId: string | null): number {
  if (!lastSeenId) return CHANGELOG.length
  const idx = CHANGELOG.findIndex(e => e.id === lastSeenId)
  return idx === -1 ? CHANGELOG.length : idx
}
