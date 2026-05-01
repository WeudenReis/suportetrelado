import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon } from '../../lib/icons'
type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: '#25D066',
    color: '#0d1417',
    boxShadow: '0 4px 14px rgba(37,208,102,0.25)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.06)',
    color: '#E6E5E8',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  subtle: {
    background: 'transparent',
    color: '#9FADBC',
  },
  danger: {
    background: 'rgba(239,68,68,0.14)',
    color: '#F87171',
    border: '1px solid rgba(239,68,68,0.25)',
  },
}

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: 28, padding: '0 12px', fontSize: 12 },
  md: { height: 32, padding: '0 16px', fontSize: 13 },
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', leftIcon, rightIcon, loading, fullWidth, disabled, children, style, ...rest },
  ref,
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type="button"
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 8,
        border: 'none',
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        transition: 'transform 0.12s ease, opacity 0.12s ease, background 0.12s ease',
        width: fullWidth ? '100%' : undefined,
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
      {...rest}
    >
      {loading ? <Icon name="Loader2" size={14} className="animate-spin" /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  )
})

export default Button
