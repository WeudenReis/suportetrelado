import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Hook que prende o foco dentro de um elemento (focus trap para modais).
 * Quando ativo, Tab/Shift+Tab cicla apenas dentro do container.
 * Retorna foco ao elemento anterior ao desmontar.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, isActive: boolean) {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    // Salvar elemento focado anteriormente
    previousFocusRef.current = document.activeElement as HTMLElement

    // Focar primeiro elemento focável do container
    const firstFocusable = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return

      const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusableElements.length === 0) return

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        // Shift+Tab: se estiver no primeiro, vai para o último
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // Tab: se estiver no último, vai para o primeiro
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Retornar foco ao elemento anterior
      previousFocusRef.current?.focus()
    }
  }, [isActive, containerRef])
}
