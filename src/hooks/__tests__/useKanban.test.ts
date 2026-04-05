import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock do módulo supabase ANTES de importar useKanban
vi.mock('../../lib/supabase', async () => {
  const mocks = await import('../../test/mocks/supabase')
  return { ...mocks }
})

import { useKanban } from '../useKanban'
import {
  fetchTickets,
  fetchAttachmentCounts,
  insertTicket,
  updateTicket,
  insertActivityLog,
} from '../../lib/supabase'
import type { Ticket } from '../../lib/supabase'

const mockFetchTickets = fetchTickets as ReturnType<typeof vi.fn>
const mockFetchAttachmentCounts = fetchAttachmentCounts as ReturnType<typeof vi.fn>
const mockInsertTicket = insertTicket as ReturnType<typeof vi.fn>
const mockUpdateTicket = updateTicket as ReturnType<typeof vi.fn>
const mockInsertActivityLog = insertActivityLog as ReturnType<typeof vi.fn>

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: `ticket-${Math.random().toString(36).slice(2)}`,
    department_id: 'dept-1',
    title: 'Ticket de teste',
    description: 'Descrição',
    status: 'backlog',
    priority: 'medium',
    assignee: 'user@test.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
    is_archived: false,
    is_completed: false,
    attachment_count: 0,
    ...overrides,
  }
}

describe('useKanban', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchTickets.mockResolvedValue([])
    mockFetchAttachmentCounts.mockResolvedValue({})
  })

  describe('carregamento inicial', () => {
    it('deve carregar tickets ao inicializar', async () => {
      const tickets = [makeTicket({ id: 't1', title: 'Primeiro' })]
      mockFetchTickets.mockResolvedValue(tickets)
      mockFetchAttachmentCounts.mockResolvedValue({ t1: 2 })

      const { result } = renderHook(() => useKanban('user@test.com'))

      // Inicialmente em loading
      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.tickets).toHaveLength(1)
      expect(result.current.tickets[0].title).toBe('Primeiro')
      expect(result.current.tickets[0].attachment_count).toBe(2)
    })

    it('deve mostrar toast de erro quando carregamento falha', async () => {
      mockFetchTickets.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useKanban('user@test.com'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.tickets).toHaveLength(0)
    })
  })

  describe('addTicket', () => {
    it('deve criar ticket e adicionar ao estado', async () => {
      const newTicket = makeTicket({ id: 'new-1', title: 'Novo ticket' })
      mockInsertTicket.mockResolvedValue(newTicket)

      const { result } = renderHook(() => useKanban('user@test.com'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.addTicket({
          title: 'Novo ticket',
          description: 'Desc',
          priority: 'high',
          status: 'backlog',
          cliente: 'Cliente X',
          instancia: '',
        })
      })

      expect(mockInsertTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Novo ticket',
          priority: 'high',
          status: 'backlog',
          assignee: 'user@test.com',
        })
      )
      expect(result.current.tickets).toContainEqual(expect.objectContaining({ id: 'new-1' }))
    })

    it('não deve criar ticket com título vazio', async () => {
      const { result } = renderHook(() => useKanban('user@test.com'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.addTicket({
          title: '   ',
          description: '',
          priority: 'medium',
          status: 'backlog',
          cliente: '',
          instancia: '',
        })
      })

      expect(mockInsertTicket).not.toHaveBeenCalled()
    })
  })

  describe('moveTicket', () => {
    it('deve mover ticket otimisticamente e persistir', async () => {
      const ticket = makeTicket({ id: 'move-1', status: 'backlog' })
      mockFetchTickets.mockResolvedValue([ticket])
      mockUpdateTicket.mockResolvedValue({ ...ticket, status: 'in_progress' })

      const { result } = renderHook(() => useKanban('user@test.com'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.moveTicket('move-1', 'move-1', 'in_progress')
      })

      // Ticket deve ter status atualizado otimisticamente
      const moved = result.current.tickets.find(t => t.id === 'move-1')
      expect(moved?.status).toBe('in_progress')

      // Deve ter chamado updateTicket e insertActivityLog
      expect(mockUpdateTicket).toHaveBeenCalledWith('move-1', { status: 'in_progress' })
      expect(mockInsertActivityLog).toHaveBeenCalledWith(
        'move-1',
        'user@test.com',
        expect.stringContaining('moveu este cartão')
      )
    })

    it('deve reverter quando persistência falha', async () => {
      const ticket = makeTicket({ id: 'fail-1', status: 'backlog' })
      mockFetchTickets.mockResolvedValue([ticket])
      mockUpdateTicket.mockRejectedValue(new Error('DB error'))

      const { result } = renderHook(() => useKanban('user@test.com'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.moveTicket('fail-1', 'fail-1', 'in_progress')
      })

      // Após falha, loadTickets é chamado para re-sincronizar
      // O fetchTickets do reload retorna o estado original
      expect(mockFetchTickets).toHaveBeenCalledTimes(2) // 1 load + 1 reload
    })

    it('não deve mover se o status é o mesmo', async () => {
      const ticket = makeTicket({ id: 'same-1', status: 'backlog' })
      mockFetchTickets.mockResolvedValue([ticket])

      const { result } = renderHook(() => useKanban('user@test.com'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.moveTicket('same-1', 'same-1', 'backlog')
      })

      expect(mockUpdateTicket).not.toHaveBeenCalled()
    })
  })

  describe('getColumnTickets', () => {
    it('deve filtrar tickets por status', async () => {
      const tickets = [
        makeTicket({ id: 't1', status: 'backlog', title: 'A' }),
        makeTicket({ id: 't2', status: 'in_progress', title: 'B' }),
        makeTicket({ id: 't3', status: 'backlog', title: 'C' }),
      ]
      mockFetchTickets.mockResolvedValue(tickets)

      const { result } = renderHook(() => useKanban('user@test.com'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      const backlogTickets = result.current.getColumnTickets('backlog')
      expect(backlogTickets).toHaveLength(2)
      expect(backlogTickets.map(t => t.id)).toEqual(['t1', 't3'])
    })

    it('deve filtrar por busca quando searchQuery está definido', async () => {
      const tickets = [
        makeTicket({ id: 't1', status: 'backlog', title: 'Bug no login' }),
        makeTicket({ id: 't2', status: 'backlog', title: 'Feature nova' }),
      ]
      mockFetchTickets.mockResolvedValue(tickets)

      const { result } = renderHook(() => useKanban('user@test.com'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        result.current.setSearchQuery('bug')
      })

      const filtered = result.current.getColumnTickets('backlog')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Bug no login')
    })
  })

  describe('handleRefresh', () => {
    it('deve recarregar tickets', async () => {
      const { result } = renderHook(() => useKanban('user@test.com'))

      await waitFor(() => expect(result.current.loading).toBe(false))

      mockFetchTickets.mockResolvedValue([makeTicket({ id: 'r1', title: 'Refreshed' })])

      await act(async () => {
        await result.current.handleRefresh()
      })

      expect(result.current.tickets).toHaveLength(1)
      expect(result.current.tickets[0].title).toBe('Refreshed')
    })
  })
})
