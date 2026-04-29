import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bold, Highlighter } from 'lucide-react'

interface RichTextFieldProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
  placeholder?: string
  minHeight?: number
  rows?: number
  ariaLabel?: string
  disabled?: boolean
  /** Pré-visualização formatada (renderizada apenas quando o campo está desfocado e o valor não é vazio). */
  renderPreview?: (value: string) => ReactNode
}

export interface RichTextFieldHandle {
  focus: () => void
  readonly textarea: HTMLTextAreaElement | null
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  marker: string,
  value: string,
  onChange: (value: string) => void,
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = value.slice(start, end)
  const wrapped = value.slice(0, start) + marker + selected + marker + value.slice(end)
  onChange(wrapped)
  setTimeout(() => {
    textarea.focus()
    textarea.selectionStart = start + marker.length
    textarea.selectionEnd = end + marker.length
  }, 0)
}

/**
 * Campo de texto longo com toolbar Notion-style: aparece apenas quando o
 * textarea está em foco. Atalho Ctrl/Cmd+B aplica negrito.
 */
const RichTextField = forwardRef<RichTextFieldHandle, RichTextFieldProps>(function RichTextField(
  {
    value,
    onChange,
    onBlur,
    onFocus,
    placeholder,
    minHeight = 80,
    rows,
    ariaLabel,
    disabled,
    renderPreview,
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [focused, setFocused] = useState(false)

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    get textarea() {
      return textareaRef.current
    },
  }))

  const handleWrap = (marker: string) => {
    const t = textareaRef.current
    if (!t) return
    wrapSelection(t, marker, value, onChange)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key.toLowerCase() === 'b' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleWrap('**')
    }
  }

  const showPreview = !focused && value.trim().length > 0 && !!renderPreview

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          position: 'relative',
          borderRadius: 8,
          background: '#22272b',
          border: `1px solid ${focused ? 'rgba(37,208,102,0.45)' : 'rgba(166,197,226,0.16)'}`,
          transition: 'border-color 0.15s ease',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence initial={false}>
          {focused && (
            <motion.div
              key="rich-toolbar"
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 8px',
                borderBottom: '1px solid rgba(166,197,226,0.1)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <ToolbarButton onClick={() => handleWrap('**')} title="Negrito (Ctrl+B)">
                <Bold size={13} />
              </ToolbarButton>
              <ToolbarButton onClick={() => handleWrap('==')} title="Destaque amarelo">
                <Highlighter size={13} />
              </ToolbarButton>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  color: '#596773',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                **negrito** · ==destaque==
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => {
            setFocused(true)
            onFocus?.()
          }}
          onBlur={() => {
            setFocused(false)
            onBlur?.()
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          aria-label={ariaLabel}
          disabled={disabled}
          className="w-full text-sm resize-y outline-none"
          style={{
            background: 'transparent',
            color: '#b6c2cf',
            border: 'none',
            padding: '10px 12px',
            minHeight,
            display: 'block',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        />
      </div>
      {showPreview && (
        <div
          className="rich-text-preview"
          style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}
        >
          {renderPreview!(value)}
        </div>
      )}
    </div>
  )
})

function ToolbarButton({
  children,
  onClick,
  title,
}: {
  children: ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: 6,
        background: 'transparent',
        color: '#b6c2cf',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.12s ease, color 0.12s ease',
      }}
      onMouseOver={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
        e.currentTarget.style.color = '#25D066'
      }}
      onMouseOut={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = '#b6c2cf'
      }}
    >
      {children}
    </button>
  )
}

export default RichTextField
