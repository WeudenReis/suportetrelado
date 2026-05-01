import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../lib/icons'
import IconButton from '../ui/IconButton'
import Badge from '../ui/Badge'
import UpdatesPopover from '../UpdatesPopover'
import UserMenu from './UserMenu'
import { useNotificationContext } from '../useNotificationContext'
import { useAnnouncementContext } from '../useAnnouncementContext'
import { useSearch } from '../SearchContext'
import { useOrg } from '../../lib/orgContext'
import { supabase } from '../../lib/supabase'

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

  // Avatar do usuário atual — busca leve para alimentar UserMenu
  const [avatar, setAvatar] = useState<{ url: string | null; color: string | null; name: string | null }>({ url: null, color: null, name: null })
  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .from('user_profiles')
      .select('name, avatar_color, avatar_url')
      .eq('email', user)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setAvatar({ url: data.avatar_url ?? null, color: data.avatar_color ?? null, name: data.name ?? null })
      })

    // Realtime: refletir trocas de avatar feitas no MyProfilePanel
    const channel = supabase.channel(`user_avatar:${user}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `email=eq.${user}` },
        payload => {
          const next = payload.new as { name?: string; avatar_color?: string; avatar_url?: string | null }
          setAvatar({
            url: next.avatar_url ?? null,
            color: next.avatar_color ?? null,
            name: next.name ?? null,
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user])

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
            <Icon name="Loader2" size={14} className="animate-spin" style={{ color: '#25D066', flexShrink: 0 }} />
          ) : (
            <Icon name="Search" size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
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
              <Icon name="X" size={12} />
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
          <Icon name="Plus" size={14} style={{ marginRight: 4 }} />
          Criar
        </button>
      )}

      <nav
        className="app-header__utilities"
        role="navigation"
        aria-label="Painéis laterais"
      >
        <IconButton
          icon={<Icon name="Bell" size={16} />}
          label="Caixa de entrada"
          onClick={() => toggle('inbox')}
          active={activeSidebar === 'inbox'}
          badge={unreadCount > 0 ? <Badge count={unreadCount} color="green" pulse /> : undefined}
        />
        <IconButton
          icon={<Icon name="CalendarRange" size={16} />}
          label="Planejador"
          onClick={() => toggle('planner')}
          active={activeSidebar === 'planner'}
        />
        <IconButton
          icon={<Icon name="Megaphone" size={16} />}
          label="Avisos"
          onClick={() => toggle('announcements')}
          active={activeSidebar === 'announcements'}
          badge={announcementCount > 0 ? <Badge count={announcementCount} color={announcementColor} /> : undefined}
        />
        <IconButton
          icon={<Icon name="Link2" size={16} />}
          label="Links úteis"
          onClick={() => toggle('links')}
          active={activeSidebar === 'links'}
        />

        <span className="app-header__divider" aria-hidden="true" />

        <UpdatesPopover user={user} />

        <span className="app-header__divider" aria-hidden="true" />

        <UserMenu
          user={user}
          userName={avatar.name ?? undefined}
          role={role}
          orgName={permissions?.organization_name ?? null}
          avatarUrl={avatar.url}
          avatarColor={avatar.color}
          onMyProfile={onOpenMyProfile}
          onSettings={onOpenSettings}
          onArchived={onOpenArchived}
          onLogout={onLogout}
        />
      </nav>
    </header>
  )
}
