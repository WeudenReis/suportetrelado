/**
 * Feed de release notes do chatPro.
 *
 * Convenção:
 * - Datas no formato ISO YYYY-MM-DD (ordenam lexicograficamente).
 * - `id` único por entrada (usado para tracking de "última visualização").
 * - Tipos: feat (novidade), improvement (melhoria), fix (correção), security.
 *
 * Para adicionar: prepende um item no topo do array (ou em qualquer posição —
 * a ordem é normalizada via SORTED_CHANGELOG abaixo).
 */

export type ChangelogType = 'feat' | 'improvement' | 'fix' | 'security'

export interface ChangelogLink {
  label: string
  href: string
}

export interface ChangelogEntry {
  id: string
  date: string
  type: ChangelogType
  title: string
  description: string
  /** Lista opcional de bullets que detalham a entrada. */
  items?: string[]
  /** Link "ver mais" opcional (PR, doc, etc). */
  link?: ChangelogLink
}

const RAW_CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-04-29-rich-text-field',
    date: '2026-04-29',
    type: 'improvement',
    title: 'Editor enxuto nos cartões',
    description:
      'Os campos Descrição e Observação agora têm uma barra de formatação que aparece só quando você foca o campo, no estilo do Notion.',
    items: [
      'Atalho Ctrl+B aplica negrito na seleção',
      'Pré-visualização formatada aparece automaticamente quando o campo perde foco',
      'Marcadores ==destaque== continuam funcionando',
    ],
  },
  {
    id: '2026-04-29-header-unificado',
    date: '2026-04-29',
    type: 'improvement',
    title: 'Navegação unificada no topo',
    description:
      'Caixa de entrada, Planejador, Avisos e Links viraram ícones elegantes no canto superior direito. O dock flutuante inferior foi aposentado para reduzir poluição visual.',
    items: [
      'Busca, botão "+ Criar" e menu do usuário também subiram para o cabeçalho',
      'Atalhos Ctrl+K, K e / continuam abrindo a busca',
    ],
  },
  {
    id: '2026-04-29-changelog',
    date: '2026-04-29',
    type: 'feat',
    title: 'Central de novidades',
    description:
      'Acompanhe pelo ícone de presente o que rola de novo no chatPro: features, melhorias e correções com data e descrição.',
    items: [
      'Filtros por tipo (novidade, melhoria, correção, segurança)',
      'Toggle "apenas não lidas" para focar no que falta ler',
      'Agrupamento por data relativa (hoje, ontem, dias atrás)',
    ],
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

/**
 * Ordenado defensivamente: data DESC, depois id DESC. Garante que mudanças na
 * ordem do array bruto não quebrem o tracking de "não visualizadas".
 */
export const CHANGELOG: ReadonlyArray<ChangelogEntry> = [...RAW_CHANGELOG].sort((a, b) => {
  if (a.date !== b.date) return b.date.localeCompare(a.date)
  return b.id.localeCompare(a.id)
})

const LAST_SEEN_KEY_PREFIX = 'chatpro-changelog-last-seen-id'
const LEGACY_KEY = 'chatpro-changelog-last-seen-id'

/**
 * Chave de localStorage escopada por email do usuário, para que duas contas no
 * mesmo navegador não sobrescrevam o estado uma da outra.
 */
export function changelogStorageKey(userEmail: string | null | undefined): string {
  const safe = (userEmail || 'anon').toLowerCase().replace(/[^a-z0-9@._-]/g, '')
  return `${LAST_SEEN_KEY_PREFIX}::${safe}`
}

/** Lê o último id visto, migrando da chave global legada se necessário. */
export function readLastSeenId(userEmail: string | null | undefined): string | null {
  const key = changelogStorageKey(userEmail)
  const direct = localStorage.getItem(key)
  if (direct !== null) return direct
  // Migra da chave global antiga (apenas para o primeiro acesso).
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (legacy !== null && key !== LEGACY_KEY) {
    localStorage.setItem(key, legacy)
    return legacy
  }
  return null
}

export function writeLastSeenId(userEmail: string | null | undefined, id: string): void {
  localStorage.setItem(changelogStorageKey(userEmail), id)
}

export function countUnseen(lastSeenId: string | null): number {
  if (!lastSeenId) return CHANGELOG.length
  const idx = CHANGELOG.findIndex(e => e.id === lastSeenId)
  return idx === -1 ? CHANGELOG.length : idx
}

/** Retorna a posição (index) de cada id no feed, ou -1 se ausente. */
export function indexOfId(id: string): number {
  return CHANGELOG.findIndex(e => e.id === id)
}

/** True se a entrada é mais nova que o último id visto. */
export function isUnseen(entryId: string, lastSeenId: string | null): boolean {
  if (!lastSeenId) return true
  const entryIdx = indexOfId(entryId)
  const seenIdx = indexOfId(lastSeenId)
  if (entryIdx === -1) return true
  if (seenIdx === -1) return true
  return entryIdx < seenIdx
}

// Mantido por compatibilidade com import legado (será removido na prox. limpeza).
export const CHANGELOG_LAST_SEEN_KEY = LAST_SEEN_KEY_PREFIX
