import type { CSSProperties } from 'react'

type BadgeVariant = 'count' | 'dot'
type BadgeColor = 'green' | 'amber' | 'red' | 'neutral'

interface BadgeProps {
  variant?: BadgeVariant
  color?: BadgeColor
  /** Para variant=`count`. Acima de 99 mostra "99+". */
  count?: number
  /** Posicionamento absoluto sobre o canto superior direito do parent. */
  floating?: boolean
  /** Animação de pulse (ex: notificações novas). */
  pulse?: boolean
  style?: CSSProperties
}

const COLOR_BG: Record<BadgeColor, string> = {
  green: '#25D066',
  amber: '#F5A623',
  red: '#EF5C48',
  neutral: '#596773',
}

const COLOR_TEXT: Record<BadgeColor, string> = {
  green: '#0d1417',
  amber: '#0d1417',
  red: '#FFFFFF',
  neutral: '#FFFFFF',
}

export default function Badge({
  variant = 'count',
  color = 'green',
  count = 0,
  floating = true,
  pulse = false,
  style,
}: BadgeProps) {
  if (variant === 'count' && count <= 0) return null

  const base: CSSProperties = floating
    ? { position: 'absolute', top: -4, right: -4, zIndex: 1 }
    : { position: 'relative' }

  if (variant === 'dot') {
    return (
      <span
        aria-hidden="true"
        style={{
          ...base,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: COLOR_BG[color],
          boxShadow: `0 0 0 2px var(--bg-secondary, #1d2125)`,
          ...style,
        }}
        className={pulse ? 'inbox-badge-pulse' : undefined}
      />
    )
  }

  const display = count > 99 ? '99+' : String(count)

  return (
    <span
      aria-label={`${count} novos`}
      style={{
        ...base,
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        borderRadius: 8,
        background: COLOR_BG[color],
        color: COLOR_TEXT[color],
        fontSize: 9,
        fontWeight: 800,
        fontFamily: "'Space Grotesk', sans-serif",
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 0 2px var(--bg-secondary, #1d2125)`,
        ...style,
      }}
      className={pulse ? 'inbox-badge-pulse' : undefined}
    >
      {display}
    </span>
  )
}
