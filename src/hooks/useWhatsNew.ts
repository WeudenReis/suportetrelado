import { useCallback, useEffect, useState } from 'react'

/**
 * Versao atual do "What's new". Incrementar quando houver um lote novo de
 * novidades para mostrar — usuarios que ja viram a versao anterior verao a
 * proxima ao logar de novo.
 */
export const WHATS_NEW_VERSION = 'v1-2026-04-30'

const ONBOARDING_KEY = 'chatpro-onboarding-completed'
const WHATS_NEW_KEY = 'chatpro-whats-new'
const REOPEN_EVENT = 'chatpro:whats-new:open'

/**
 * Mostra um popover de novidades para usuarios *existentes* (que ja completaram
 * o onboarding inicial). Usuarios novos veem o tour padrao e ja saem cientes
 * da versao atual — nao precisam ver as "novidades".
 */
export function useWhatsNew() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onboardingDone = localStorage.getItem(ONBOARDING_KEY)
    const lastSeen = localStorage.getItem(WHATS_NEW_KEY)

    // Usuario novo (sem onboarding) -> deixa o tour assumir, nao mostra novidades
    // Ja viu esta versao -> nao abre automaticamente (mas pode reabrir manualmente)
    if (onboardingDone && lastSeen !== WHATS_NEW_VERSION) {
      // Espera um pouco para nao competir com a renderizacao inicial
      const timer = setTimeout(() => setOpen(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  // Permite reabrir o popover sob demanda (ex.: item "Ver novidades" no menu)
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(REOPEN_EVENT, handler)
    return () => window.removeEventListener(REOPEN_EVENT, handler)
  }, [])

  const dismiss = useCallback(() => {
    setOpen(false)
    localStorage.setItem(WHATS_NEW_KEY, WHATS_NEW_VERSION)
  }, [])

  return { open, dismiss }
}

/** Reabre o popover de novidades manualmente. Pode ser chamado de qualquer
 *  lugar (ex.: item de menu) — emite um evento que o hook escuta. */
export function openWhatsNew() {
  window.dispatchEvent(new CustomEvent(REOPEN_EVENT))
}

/** Marca a versao atual como vista — chamado quando o tour de onboarding termina,
 *  para que usuarios novos nao vejam o popover de novidades logo apos o tour. */
export function markWhatsNewSeen() {
  localStorage.setItem(WHATS_NEW_KEY, WHATS_NEW_VERSION)
}
