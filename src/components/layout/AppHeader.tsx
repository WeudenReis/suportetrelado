import { Bell, CalendarRange, Megaphone, Link2 } from 'lucide-react'
import IconButton from '../ui/IconButton'
import Badge from '../ui/Badge'
import UpdatesPopover from '../UpdatesPopover'
import { useNotificationContext } from '../useNotificationContext'
import { useAnnouncementContext } from '../useAnnouncementContext'

export type SidebarTab = 'inbox' | 'planner' | 'announcements' | 'links'

interface AppHeaderProps {
  /** Sidebar atualmente aberta. `null` = nenhuma. */
  activeSidebar: SidebarTab | null
  /** Callback para abrir/fechar uma sidebar (passa null para fechar tudo). */
  onSidebarChange: (tab: SidebarTab | null) => void
}

/**
 * Header global do chatPro.
 *
 * Lei da proximidade aplicada:
 *   [logo] ... (slot de busca/criar — Fase B) ... [utilitários] | [novidades]
 *
 * Os utilitários (Inbox/Planner/Avisos/Links) são toggles: clicar de novo
 * fecha a sidebar correspondente.
 */
export default function AppHeader({ activeSidebar, onSidebarChange }: AppHeaderProps) {
  const { unreadCount } = useNotificationContext()
  const { announcements } = useAnnouncementContext()

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

      <div className="app-header__spacer" />

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
      </nav>
    </header>
  )
}
