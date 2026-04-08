import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useOnboarding } from '../hooks/useOnboarding'

interface TooltipPosition {
  top: number
  left: number
  arrowSide: 'top' | 'bottom' | 'left' | 'right'
}

function getTooltipPosition(
  targetRect: DOMRect,
  placement: 'top' | 'bottom' | 'left' | 'right',
  tooltipWidth: number,
  tooltipHeight: number
): TooltipPosition {
  const gap = 12

  switch (placement) {
    case 'bottom':
      return {
        top: targetRect.bottom + gap,
        left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        arrowSide: 'top',
      }
    case 'top':
      return {
        top: targetRect.top - tooltipHeight - gap,
        left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        arrowSide: 'bottom',
      }
    case 'right':
      return {
        top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
        left: targetRect.right + gap,
        arrowSide: 'left',
      }
    case 'left':
      return {
        top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
        left: targetRect.left - tooltipWidth - gap,
        arrowSide: 'right',
      }
  }
}

function clampPosition(pos: TooltipPosition, tooltipWidth: number, tooltipHeight: number): TooltipPosition {
  const padding = 12
  return {
    ...pos,
    top: Math.max(padding, Math.min(pos.top, window.innerHeight - tooltipHeight - padding)),
    left: Math.max(padding, Math.min(pos.left, window.innerWidth - tooltipWidth - padding)),
  }
}

export default function Onboarding() {
  const {
    isActive, currentStep, totalSteps, step,
    isFirstVisit, startTour, nextStep, prevStep, skipTour,
  } = useOnboarding()

  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [showWelcome, setShowWelcome] = useState(false)

  // Show welcome on first visit
  useEffect(() => {
    if (isFirstVisit()) {
      const timer = setTimeout(() => setShowWelcome(true), 800)
      return () => clearTimeout(timer)
    }
  }, [isFirstVisit])

  // Position tooltip when step changes
  useEffect(() => {
    if (!isActive || !step) return

    const target = document.querySelector(`[data-tour="${step.target}"]`)
    if (!target) return

    const rect = target.getBoundingClientRect()
    setTargetRect(rect) // eslint-disable-line react-hooks/set-state-in-effect -- posicionamento imperativo do tooltip

    // Wait for tooltip to render to get its size
    requestAnimationFrame(() => {
      const tooltip = tooltipRef.current
      const tw = tooltip?.offsetWidth || 300
      const th = tooltip?.offsetHeight || 160
      const pos = getTooltipPosition(rect, step.placement, tw, th)
      setPosition(clampPosition(pos, tw, th))
    })
  }, [isActive, currentStep, step])

  const handleStartTour = () => {
    setShowWelcome(false)
    startTour()
  }

  const handleDismissWelcome = () => {
    setShowWelcome(false)
    skipTour()
  }

  return (
    <>
      {/* Welcome modal */}
      <AnimatePresence>
        {showWelcome && !isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={handleDismissWelcome}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#22272B',
                border: '1px solid rgba(37,208,102,0.2)',
                borderRadius: 16,
                padding: '32px 28px',
                maxWidth: 380,
                textAlign: 'center',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: 'rgba(37,208,102,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 28,
              }}>
                👋
              </div>
              <h2 style={{
                fontFamily: "'Paytone One', sans-serif",
                fontSize: 20, color: '#E5E7EB', margin: '0 0 8px',
              }}>
                Bem-vindo ao chatPro!
              </h2>
              <p style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 14, color: '#9CA3AF', margin: '0 0 24px', lineHeight: 1.5,
              }}>
                Quer fazer um tour rápido para conhecer as principais funcionalidades?
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={handleDismissWelcome}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '10px 20px',
                    color: '#9CA3AF', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Pular
                </button>
                <button
                  onClick={handleStartTour}
                  style={{
                    background: '#25D066',
                    border: 'none', borderRadius: 8, padding: '10px 20px',
                    color: '#000', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Começar tour
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tour overlay + tooltip */}
      <AnimatePresence>
        {isActive && step && position && (
          <>
            {/* Backdrop with spotlight hole */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                pointerEvents: 'none',
              }}
            >
              {/* Dark overlay */}
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                <defs>
                  <mask id="spotlight-mask">
                    <rect width="100%" height="100%" fill="white" />
                    {targetRect && (
                      <rect
                        x={targetRect.left - 6}
                        y={targetRect.top - 6}
                        width={targetRect.width + 12}
                        height={targetRect.height + 12}
                        rx={8}
                        fill="black"
                      />
                    )}
                  </mask>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill="rgba(0,0,0,0.55)"
                  mask="url(#spotlight-mask)"
                />
              </svg>

              {/* Spotlight border glow */}
              {targetRect && (
                <div style={{
                  position: 'absolute',
                  top: targetRect.top - 6,
                  left: targetRect.left - 6,
                  width: targetRect.width + 12,
                  height: targetRect.height + 12,
                  borderRadius: 8,
                  border: '2px solid rgba(37,208,102,0.5)',
                  boxShadow: '0 0 20px rgba(37,208,102,0.15)',
                  pointerEvents: 'none',
                }} />
              )}
            </motion.div>

            {/* Tooltip */}
            <motion.div
              ref={tooltipRef}
              initial={{ opacity: 0, y: position.arrowSide === 'top' ? -8 : position.arrowSide === 'bottom' ? 8 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                zIndex: 10001,
                width: 300,
                background: '#22272B',
                border: '1px solid rgba(37,208,102,0.25)',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                overflow: 'hidden',
                pointerEvents: 'auto',
              }}
            >
              {/* Green bar */}
              <div style={{ height: 3, background: 'linear-gradient(90deg, #25D066, #24FF72)' }} />

              <div style={{ padding: '16px 16px 12px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{
                    margin: 0, fontSize: 15, fontWeight: 700,
                    color: '#E5E7EB', fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {step.title}
                  </h3>
                  <button
                    onClick={skipTour}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#6B7280', display: 'flex', padding: 2,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Description */}
                <p style={{
                  margin: '0 0 16px', fontSize: 13, color: '#9CA3AF', lineHeight: 1.5,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  {step.description}
                </p>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* Step counter */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: totalSteps }, (_, i) => (
                      <div
                        key={i}
                        style={{
                          width: i === currentStep ? 16 : 6,
                          height: 6,
                          borderRadius: 3,
                          background: i === currentStep ? '#25D066' : 'rgba(255,255,255,0.12)',
                          transition: 'all 0.2s ease',
                        }}
                      />
                    ))}
                  </div>

                  {/* Navigation */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {currentStep > 0 && (
                      <button
                        onClick={prevStep}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 6, padding: '6px 10px',
                          color: '#B6C2CF', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 12, fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        <ChevronLeft size={12} />
                        Anterior
                      </button>
                    )}
                    <button
                      onClick={nextStep}
                      style={{
                        background: '#25D066', border: 'none',
                        borderRadius: 6, padding: '6px 14px',
                        color: '#000', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 12, fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      {currentStep < totalSteps - 1 ? (
                        <>Próximo <ChevronRight size={12} /></>
                      ) : (
                        'Concluir'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
