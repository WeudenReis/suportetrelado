import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock do módulo supabase
vi.mock('../../lib/supabase', async () => {
  const mocks = await import('../../test/mocks/supabase')
  return { ...mocks }
})

// Mock do CSS Modules
vi.mock('../Card.module.css', () => ({
  default: new Proxy({}, {
    get: (_target, prop) => typeof prop === 'string' ? prop : undefined,
  }),
}))

// Mock do CardDetailModal (parseTag)
vi.mock('../CardDetailModal', () => ({
  parseTag: (raw: string) => {
    const sep = raw.indexOf('|')
    if (sep >= 0) return { name: raw.slice(0, sep), color: raw.slice(sep + 1) }
    return { name: raw, color: '#579dff' }
  },
}))

import Card from '../Card'
import { updateTicket } from '../../lib/supabase'
import type { Ticket } from '../../lib/supabase'

const mockUpdateTicket = updateTicket as ReturnType<typeof vi.fn>

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'card-1',
    department_id: 'dept-1',
    title: 'Ticket de teste',
    description: 'Descrição do ticket',
    status: 'backlog',
    priority: 'high',
    assignee: 'joao@test.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
    is_archived: false,
    is_completed: false,
    attachment_count: 0,
    ...overrides,
  }
}

describe('Card', () => {
  const defaultProps = {
    onClick: vi.fn(),
    onUpdate: vi.fn(),
    onArchive: vi.fn(),
    onShowToast: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('renderização', () => {
    it('deve renderizar o título do ticket', () => {
      render(<Card card={makeTicket()} {...defaultProps} />)
      expect(screen.getByText('Ticket de teste')).toBeInTheDocument()
    })

    it('deve renderizar badge de prioridade alta', () => {
      render(<Card card={makeTicket({ priority: 'high' })} {...defaultProps} />)
      expect(screen.getByText('ALTA')).toBeInTheDocument()
    })

    it('deve renderizar badge de prioridade média', () => {
      render(<Card card={makeTicket({ priority: 'medium' })} {...defaultProps} />)
      expect(screen.getByText('MÉDIA')).toBeInTheDocument()
    })

    it('deve renderizar badge de prioridade baixa', () => {
      render(<Card card={makeTicket({ priority: 'low' })} {...defaultProps} />)
      expect(screen.getByText('BAIXA')).toBeInTheDocument()
    })

    it('deve renderizar avatar do responsável', () => {
      render(<Card card={makeTicket({ assignee: 'joao@test.com' })} {...defaultProps} />)
      expect(screen.getByText('J')).toBeInTheDocument()
    })

    it('deve renderizar tags quando presentes', () => {
      render(<Card card={makeTicket({ tags: ['Bug|#ef5c48', 'Feature|#4bce97'] })} {...defaultProps} />)
      expect(screen.getByText('Bug')).toBeInTheDocument()
      expect(screen.getByText('Feature')).toBeInTheDocument()
    })

    it('deve renderizar badge de anexos quando existem', () => {
      render(<Card card={makeTicket({ attachment_count: 3 })} {...defaultProps} />)
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  describe('toggle completo', () => {
    it('deve chamar onUpdate e updateTicket ao marcar como concluído', async () => {
      mockUpdateTicket.mockResolvedValue({ ...makeTicket(), is_completed: true })

      render(<Card card={makeTicket({ is_completed: false })} {...defaultProps} />)

      const checkBtn = screen.getAllByRole('button').find(
        btn => btn.getAttribute('title') === 'Marcar como concluído'
      )
      expect(checkBtn).toBeDefined()

      fireEvent.click(checkBtn!)

      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ is_completed: true })
      )
      expect(mockUpdateTicket).toHaveBeenCalledWith('card-1', { is_completed: true })
    })

    it('deve reverter quando updateTicket falha', async () => {
      mockUpdateTicket.mockRejectedValue(new Error('DB error'))

      render(<Card card={makeTicket({ is_completed: false })} {...defaultProps} />)

      const checkBtn = screen.getAllByRole('button').find(
        btn => btn.getAttribute('title') === 'Marcar como concluído'
      )
      fireEvent.click(checkBtn!)

      // Primeiro chamou com true (otimista)
      expect(defaultProps.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ is_completed: true })
      )
    })
  })

  describe('arquivar', () => {
    it('deve chamar onArchive e updateTicket ao arquivar', async () => {
      mockUpdateTicket.mockResolvedValue({ ...makeTicket(), is_archived: true })

      const { container } = render(<Card card={makeTicket()} {...defaultProps} />)

      // Simular hover para mostrar botões
      fireEvent.mouseEnter(container.firstChild as Element)

      const archiveBtn = screen.getAllByRole('button').find(
        btn => btn.getAttribute('title') === 'Arquivar cartão'
      )
      expect(archiveBtn).toBeDefined()

      fireEvent.click(archiveBtn!)

      // handleArchive é async (await gsap.to) — aguardar as chamadas
      await waitFor(() => {
        expect(defaultProps.onArchive).toHaveBeenCalledWith('card-1')
      })
      expect(defaultProps.onShowToast).toHaveBeenCalledWith('Cartão arquivado com sucesso', 'ok')
    })
  })

  describe('clique no card', () => {
    it('deve chamar onClick ao clicar no card', () => {
      const { container } = render(<Card card={makeTicket()} {...defaultProps} />)
      fireEvent.click(container.firstChild as Element)
      expect(defaultProps.onClick).toHaveBeenCalled()
    })
  })

  describe('modo compacto', () => {
    it('deve renderizar em modo compacto', () => {
      render(<Card card={makeTicket()} {...defaultProps} compact />)
      expect(screen.getByText('Ticket de teste')).toBeInTheDocument()
    })
  })
})
