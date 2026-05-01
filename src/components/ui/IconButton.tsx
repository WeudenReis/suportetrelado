import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type IconButtonVariant = 'default' | 'active' | 'danger'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Ícone (já dimensionado pelo chamador). */
  icon: ReactNode
  /** Texto descritivo — vira aria-label e title (tooltip nativo). */
  label: string
  /** Marca o botão como "ligado" (estado verde chatPro). */
  active?: boolean
  /** Variante visual. `active` sobrescreve `variant`. */
  variant?: IconButtonVariant
  /** Conteúdo posicionado no canto superior direito (ex: <Badge>). */
  badge?: ReactNode
}

/**
 * Botão padrão do chatPro para ações representadas por ícone.
 * Substitui o uso direto de `.trello-icon-btn`, padronizando aria/tooltip/badge.
 */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, active, variant = 'default', badge, className, style, ...rest },
  ref,
) {
  const isActive = active || variant === 'active'
  const isDanger = variant === 'danger'

  const cls = [
    'trello-icon-btn',
    isDanger ? 'trello-icon-btn--danger' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  const inlineStyle = isActive
    ? { color: '#25D066', background: 'rgba(37,208,102,0.12)', position: 'relative' as const, ...style }
    : { position: 'relative' as const, ...style }

  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      title={label}
      aria-label={label}
      aria-pressed={active ? true : undefined}
      style={inlineStyle}
      {...rest}
    >
      {icon}
      {badge}
    </button>
  )
})

export default IconButton
