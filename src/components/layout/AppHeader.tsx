import { useEffect, useRef } from 'react'
import { Bell, CalendarRange, Megaphone, Link2, Plus, Search, X, Loader2 } from 'lucide-react'
import IconButton from '../ui/IconButton'
import Badge from '../ui/Badge'
import UpdatesPopover from '../UpdatesPopover'
import UserMenu from './UserMenu'
import { useNotificationContext } from '../useNotificationContext'
import { useAnnouncementContext } from '../useAnnouncementContext'
import { useSearch } from '../SearchContext'
import { useOrg } from '../../lib/orgContext'

export type SidebarTab = 'inbox' | 'planner' | 'announcements' | 'links'

interface AppHeaderProps {
  /** Sidebar atualmente aberta. `null` = nenhuma. */
  activeSidebar: SidebarTab | null
  /** Callback para abrir/fechar uma sidebar (passa null para fechar tudo). */
  onSidebarChange: (tab: SidebarTab | null) => void
  /** Email do usuário autenticado. */
  user: string
  /** Mostra busca + botão Criar (somente quando o board está visível). */
  showBoardActions: boolean
  onCreateTicket: () => void
  onOpenMyProfile: () => void
  onOpenSettings: () => void
  onOpenArchived: () => void
  onLogout: () => void
}

/**
 * Header global do chatPro.
 *
 * Layout:
 *   [logo] [search* ] [+Criar*] [Inbox/Planner/Avisos/Links | Updates | UserMenu]
 *
 * Itens com `*` aparecem somente quando o board está em foco (showBoardActions).
 */
export default function AppHeader({
  activeSidebar,
  onSidebarChange,
  user,
  showBoardActions,
  onCreateTicket,
  onOpenMyProfile,
  onOpenSettings,
  onOpenArchived,
  onLogout,
}: AppHeaderProps) {
  const { unreadCount } = useNotificationContext()
  const { announcements } = useAnnouncementContext()
  const { permissions, role } = useOrg()
  const { query, setQuery, loading, resultsCount, registerInput } = useSearch()
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    registerInput(inputRef.current)
    return () => registerInput(null)
  }, [registerInput])

  const announcementCount = announcements.length
  const hasCritical = announcements.some(a => a.severity === 'critical')
  const announcementColor = hasCritical ? 'red' : 'amber'

  const toggle = (tab: SidebarTab) => {
    onSidebarChange(activeSidebar === tab ? null : tab)
  }

  return (
    <header className="app-header" role="banner">
      <div className="app-header__brand">
        <div className="app-header__logo" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
            <rect x="4" y="4" width="92" height="68" rx="14" ry="14" fill="#25D066" />
            <polygon points="50,92 40,68 60,68" fill="#25D066" />
            <circle cx="30" cy="40" r="6" fill="#0d1417" />
            <circle cx="50" cy="40" r="6" fill="#0d1417" />
            <circle cx="70" cy="40" r="6" fill="#0d1417" />
          </svg>
        </div>
        <span className="app-header__brand-name">chatPro</span>
      </div>

      {showBoardActions && (
        <div className="app-header__search" data-tour="board-search">
          {loading ? (
            <Loader2 size={14} className="animate-spin" style={{ color: '#25D066', flexShrink: 0 }} />
          ) : (
            <Search size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Pesquisar (/ ou Ctrl+K)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            role="searchbox"
            aria-label="Pesquisar tickets"
          />
          {query.trim() && !loading && (
            <span
              className="app-header__search-count"
              style={{ color: resultsCount != null ? '#25D066' : '#6B7280' }}
            >
              {resultsCount != null ? `${resultsCount} resultados` : 'local'}
            </span>
          )}
          {query.trim() && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="app-header__search-clear"
              aria-label="Limpar busca"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      <div className="app-header__spacer" />

      {showBoardActions && (
        <button
          type="button"
          onClick={onCreateTicket}
          className="trello-create-btn app-header__create"
        >
          <Plus size={14} style={{ marginRight: 4 }} />
          Criar
        </button>
      )}

      <nav
        className="app-header__utilities"
        role="navigation"
        aria-label="Painéis laterais"
      >
        <IconButton
          icon={<Bell size={16} />}
          label="Caixa de entrada"
          onClick={() => toggle('inbox')}
          active={activeSidebar === 'inbox'}
          badge={unreadCount > 0 ? <Badge count={unreadCount} color="green" pulse /> : undefined}
        />
        <IconButton
          icon={<CalendarRange size={16} />}
          label="Planejador"
          onClick={() => toggle('planner')}
          active={activeSidebar === 'planner'}
        />
        <IconButton
          icon={<Megaphone size={16} />}
          label="Avisos"
          onClick={() => toggle('announcements')}
          active={activeSidebar === 'announcements'}
          badge={announcementCount > 0 ? <Badge count={announcementCount} color={announcementColor} /> : undefined}
        />
        <IconButton
          icon={<Link2 size={16} />}
          label="Links úteis"
          onClick={() => toggle('links')}
          active={activeSidebar === 'links'}
        />

        <span className="app-header__divider" aria-hidden="true" />

        <UpdatesPopover />

        <span className="app-header__divider" aria-hidden="true" />

        <UserMenu
          user={user}
          role={role}
          orgName={permissions?.organization_name ?? null}
          onMyProfile={onOpenMyProfile}
          onSettings={onOpenSettings}
          onArchived={onOpenArchived}
          onLogout={onLogout}
        />
      </nav>
    </header>
  )
}
