import { useCallback, useRef } from 'react'
import type React from 'react'

interface UseBoardScrollDragReturn {
  scrollerRef: React.MutableRefObject<HTMLDivElement | null>
  handleBoardMouseDown: (e: React.MouseEvent) => void
  handleBoardMouseMove: (e: React.MouseEvent) => void
  stopBoardDrag: () => void
}

/**
 * Permite arrastar o fundo do quadro para fazer scroll horizontal (estilo Trello).
 * Ignora cliques em colunas/cards — só ativa quando o alvo é o próprio scroller.
 */
export function useBoardScrollDrag(): UseBoardScrollDragReturn {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const boardDragRef = useRef({ isDragging: false, startX: 0, scrollLeft: 0 })

  const handleBoardMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.trello-col')) return
    const isBoard = target === scrollerRef.current
      || target.classList.contains('board-columns')
      || target.classList.contains('board-main__scroller')
      || target.classList.contains('board-main')
      || (target.closest('.board-main__scroller') === scrollerRef.current)
    if (!isBoard) return
    boardDragRef.current.isDragging = true
    boardDragRef.current.startX = e.clientX
    boardDragRef.current.scrollLeft = scrollerRef.current?.scrollLeft ?? 0
    if (scrollerRef.current) scrollerRef.current.style.cursor = 'grabbing'
  }, [])

  const handleBoardMouseMove = useCallback((e: React.MouseEvent) => {
    if (!boardDragRef.current.isDragging || !scrollerRef.current) return
    e.preventDefault()
    const walk = (e.clientX - boardDragRef.current.startX) * 1.5
    scrollerRef.current.scrollLeft = boardDragRef.current.scrollLeft - walk
  }, [])

  const stopBoardDrag = useCallback(() => {
    boardDragRef.current.isDragging = false
    if (scrollerRef.current) scrollerRef.current.style.cursor = ''
  }, [])

  return { scrollerRef, handleBoardMouseDown, handleBoardMouseMove, stopBoardDrag }
}
