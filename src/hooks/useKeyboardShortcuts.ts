import { useEffect, useCallback, useState } from 'react'

export interface ShortcutAction {
  key: string
  ctrl?: boolean
  shift?: boolean
  description: string
  action: () => void
}

export function useKeyboardShortcuts(shortcuts: ShortcutAction[], enabled: boolean = true) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return

    // Ignorar se estiver digitando em input/textarea/select
    const target = e.target as HTMLElement
    const tag = target.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) return

    for (const shortcut of shortcuts) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey

      if (keyMatch && ctrlMatch && shiftMatch) {
        e.preventDefault()
        shortcut.action()
        return
      }
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

export function useShortcutsHelp(): [boolean, () => void, () => void] {
  const [show, setShow] = useState(false)
  const open = useCallback(() => setShow(true), [])
  const close = useCallback(() => setShow(false), [])
  return [show, open, close]
}
