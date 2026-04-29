import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon, type IconName } from '../../lib/icons'

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

interface SelectionRange {
  start: number
  end: number
  selected: string
}

function getSelection(textarea: HTMLTextAreaElement, value: string): SelectionRange {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  return { start, end, selected: value.slice(start, end) }
}

/** Envolve a seleção atual com `marker` (ou desfaz se já estiver envolvida). */
function applyWrap(
  textarea: HTMLTextAreaElement,
  marker: string,
  value: string,
  onChange: (value: string) => void,
) {
  const { start, end, selected } = getSelection(textarea, value)
  const before = value.slice(0, start)
  const after = value.slice(end)

  // Toggle: se o conteúdo já tem o marker em volta, remove.
  const hasWrap =
    before.endsWith(marker) && after.startsWith(marker)
  if (hasWrap) {
    const next = before.slice(0, -marker.length) + selected + after.slice(marker.length)
    onChange(next)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.selectionStart = start - marker.length
      textarea.selectionEnd = end - marker.length
    })
    return
  }

  const next = before + marker + selected + marker + after
  onChange(next)
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.selectionStart = start + marker.length
    textarea.selectionEnd = end + marker.length
  })
}

/** Adiciona um prefixo no início de cada linha selecionada (listas, citação). */
function applyLinePrefix(
  textarea: HTMLTextAreaElement,
  prefix: string | ((lineIndex: number) => string),
  value: string,
  onChange: (value: string) => void,
) {
  const { start, end } = getSelection(textarea, value)
  // Expande a seleção para englobar linhas inteiras
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lineEnd = (() => {
    const next = value.indexOf('\n', end)
    return next === -1 ? value.length : next
  })()

  const block = value.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  const prefixed = lines
    .map((line, i) => {
      const p = typeof prefix === 'function' ? prefix(i) : prefix
      return line.length === 0 && lines.length > 1 ? line : `${p}${line}`
    })
    .join('\n')

  const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd)
  onChange(next)
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.selectionStart = lineStart
    textarea.selectionEnd = lineStart + prefixed.length
  })
}

function applyLink(
  textarea: HTMLTextAreaElement,
  value: string,
  onChange: (value: string) => void,
) {
  const { start, end, selected } = getSelection(textarea, value)
  const url = window.prompt('Cole a URL:', 'https://')
  if (!url || url.trim() === '' || url.trim() === 'https://') return
  const label = selected || 'link'
  const linkText = `[${label}](${url.trim()})`
  const next = value.slice(0, start) + linkText + value.slice(end)
  onChange(next)
  requestAnimationFrame(() => {
    textarea.focus()
    const labelStart = start + 1
    textarea.selectionStart = labelStart
    textarea.selectionEnd = labelStart + label.length
  })
}

interface ToolbarItem {
  icon: IconName
  title: string
  shortcut?: string
  apply: (textarea: HTMLTextAreaElement, value: string, onChange: (v: string) => void) => void
}

const TOOLBAR: ToolbarItem[] = [
  { icon: 'Bold', title: 'Negrito', shortcut: 'Ctrl+B', apply: (t, v, o) => applyWrap(t, '**', v, o) },
  { icon: 'Italic', title: 'Itálico', shortcut: 'Ctrl+I', apply: (t, v, o) => applyWrap(t, '*', v, o) },
  { icon: 'Underline', title: 'Sublinhado', shortcut: 'Ctrl+U', apply: (t, v, o) => applyWrap(t, '__', v, o) },
  { icon: 'Strikethrough', title: 'Riscado', apply: (t, v, o) => applyWrap(t, '~', v, o) },
  { icon: 'Highlighter', title: 'Destaque', apply: (t, v, o) => applyWrap(t, '==', v, o) },
  { icon: 'Code', title: 'Código', apply: (t, v, o) => applyWrap(t, '`', v, o) },
  { icon: 'Link2', title: 'Link', shortcut: 'Ctrl+K', apply: (t, v, o) => applyLink(t, v, o) },
  { icon: 'ListUnordered', title: 'Lista com marcadores', apply: (t, v, o) => applyLinePrefix(t, '- ', v, o) },
  { icon: 'ListOrdered', title: 'Lista numerada', apply: (t, v, o) => applyLinePrefix(t, i => `${i + 1}. `, v, o) },
  { icon: 'Quote', title: 'Citação', apply: (t, v, o) => applyLinePrefix(t, '> ', v, o) },
]

const SHORTCUT_MAP: Record<string, ToolbarItem> = {
  b: TOOLBAR[0],
  i: TOOLBAR[1],
  u: TOOLBAR[2],
  k: TOOLBAR[6],
}

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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const item = SHORTCUT_MAP[e.key.toLowerCase()]
    if (!item) return
    const t = textareaRef.current
    if (!t) return
    e.preventDefault()
    item.apply(t, value, onChange)
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
          minHeight: showPreview ? minHeight : undefined,
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
                gap: 2,
                padding: '5px 6px',
                borderBottom: '1px solid rgba(166,197,226,0.1)',
                background: 'rgba(255,255,255,0.02)',
                flexWrap: 'wrap',
              }}
            >
              {TOOLBAR.map((item, idx) => (
                <ToolbarButton
                  key={item.title}
                  onClick={() => {
                    const t = textareaRef.current
                    if (!t) return
                    item.apply(t, value, onChange)
                  }}
                  title={item.shortcut ? `${item.title} (${item.shortcut})` : item.title}
                  icon={item.icon}
                  divider={idx === 5 || idx === 6}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {showPreview ? (
          <button
            type="button"
            onClick={() => textareaRef.current?.focus()}
            aria-label="Editar conteúdo formatado"
            className="rich-text-content"
            style={{
              display: 'block',
              width: '100%',
              minHeight,
              padding: '10px 12px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'text',
              color: '#b6c2cf',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 13,
              lineHeight: 1.55,
              wordBreak: 'break-word',
            }}
          >
            {renderPreview!(value)}
          </button>
        ) : (
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
        )}
      </div>
    </div>
  )
})

interface ToolbarButtonProps {
  icon: IconName
  title: string
  onClick: () => void
  divider?: boolean
}

function ToolbarButton({ icon, title, onClick, divider }: ToolbarButtonProps) {
  return (
    <>
      {divider && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 1,
            height: 16,
            margin: '0 4px',
            background: 'rgba(166,197,226,0.18)',
          }}
        />
      )}
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
        <Icon name={icon} size={13} />
      </button>
    </>
  )
}

export default RichTextField
