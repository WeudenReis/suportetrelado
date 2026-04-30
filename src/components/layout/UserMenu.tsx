import { useState } from 'react'
import { Icon } from '../../lib/icons'
import Popover from '../ui/Popover'
import UserAvatar from '../ui/UserAvatar'

interface UserMenuProps {
  user: string
  userName?: string
  role?: string | null
  orgName?: string | null
  avatarUrl?: string | null
  avatarColor?: string | null
  onMyProfile: () => void
  onSettings: () => void
  onArchived: () => void
  onLogout: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  agent: 'Agente',
}

const ROLE_COLOR: Record<string, string> = {
  admin: '#A259FF',
  supervisor: '#579DFF',
  agent: '#25D066',
}

export default function UserMenu({
  user,
  userName,
  role,
  orgName,
  avatarUrl,
  avatarColor,
  onMyProfile,
  onSettings,
  onArchived,
  onLogout,
}: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const displayName = userName || user.split('@')[0]
  const roleLabel = role ? ROLE_LABEL[role] : null
  const roleColor = role ? ROLE_COLOR[role] ?? '#596773' : '#596773'
  const fallbackColor = avatarColor || '#25D066'

  const close = () => setOpen(false)
  const handle = (fn: () => void) => () => { close(); fn() }

  return (
    <Popover
      open={open}
      onClose={close}
      align="end"
      width={264}
      anchor={
        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          aria-label="Menu do usuário"
          aria-haspopup="menu"
          aria-expanded={open}
          title={user}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: open ? '2px solid rgba(37,208,102,0.55)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'border-color 0.15s, transform 0.15s',
            outline: 'none',
            padding: 0,
            overflow: 'hidden',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <UserAvatar
            name={displayName}
            avatarColor={fallbackColor}
            avatarUrl={avatarUrl}
            size={32}
            fontSize={13}
          />
        </button>
      }
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <UserAvatar
            name={displayName}
            avatarColor={fallbackColor}
            avatarUrl={avatarUrl}
            size={36}
            fontSize={13}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#E6E5E8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#8C96A3',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user}
            </div>
          </div>
        </div>
        {(roleLabel || orgName) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {roleLabel && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: `${roleColor}1f`,
                  color: roleColor,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {roleLabel}
              </span>
            )}
            {orgName && (
              <span style={{ fontSize: 10.5, color: '#6B7685' }}>{orgName}</span>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: 6 }} role="menu">
        <MenuItem icon={<Icon name="User" size={14} />} label="Meu perfil" onClick={handle(onMyProfile)} />
        <MenuItem icon={<Icon name="Settings" size={14} />} label="Configurações" onClick={handle(onSettings)} />
        <MenuItem icon={<Icon name="Archive" size={14} />} label="Itens arquivados" onClick={handle(onArchived)} />
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 4px' }} />
        <MenuItem icon={<Icon name="LogOut" size={14} />} label="Sair" onClick={handle(onLogout)} danger />
      </div>
    </Popover>
  )
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}

function MenuItem({ icon, label, onClick, danger }: MenuItemProps) {
  const color = danger ? '#EF5C48' : '#9FADBC'
  const hoverBg = danger ? 'rgba(239,92,72,0.10)' : 'rgba(255,255,255,0.04)'
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        borderRadius: 6,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color,
        fontSize: 12.5,
        fontWeight: 500,
        fontFamily: "'Space Grotesk', sans-serif",
        textAlign: 'left',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = hoverBg }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {icon}
      {label}
    </button>
  )
}
