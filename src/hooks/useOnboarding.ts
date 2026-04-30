import { useState, useCallback } from 'react'
import { markWhatsNewSeen } from './useWhatsNew'

const STORAGE_KEY = 'chatpro-onboarding-completed'

export interface TourStep {
  target: string       // data-tour attribute value
  title: string
  description: string
  placement: 'top' | 'bottom' | 'left' | 'right'
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: 'board-search',
    title: 'Pesquisa rápida',
    description: 'Use a barra de pesquisa para encontrar tickets por título, descrição ou cliente. Atalho: / ou Ctrl+K.',
    placement: 'bottom',
  },
  {
    target: 'board-add-ticket',
    title: 'Criar ticket',
    description: 'Clique no + para criar um novo ticket na coluna desejada.',
    placement: 'bottom',
  },
  {
    target: 'board-column',
    title: 'Colunas do Kanban',
    description: 'Arraste tickets entre colunas para atualizar o status. Clique no título da coluna para editar.',
    placement: 'top',
  },
  {
    target: 'bottom-nav',
    title: 'Navegação',
    description: 'Acesse a Caixa de Entrada, Planner, Avisos, Links e Dashboard por aqui.',
    placement: 'top',
  },
]

export function useOnboarding() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)

  const isFirstVisit = useCallback(() => {
    return !localStorage.getItem(STORAGE_KEY)
  }, [])

  const startTour = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
  }, [])

  const completeTour = useCallback(() => {
    setIsActive(false)
    localStorage.setItem(STORAGE_KEY, 'true')
    // Usuario que acabou de ver o tour ja conhece tudo da versao atual
    markWhatsNewSeen()
  }, [])

  const nextStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      completeTour()
    }
  }, [currentStep, completeTour])

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const skipTour = useCallback(() => {
    setIsActive(false)
    localStorage.setItem(STORAGE_KEY, 'true')
    markWhatsNewSeen()
  }, [])

  return {
    isActive,
    currentStep,
    totalSteps: TOUR_STEPS.length,
    step: TOUR_STEPS[currentStep],
    isFirstVisit,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
  }
}
