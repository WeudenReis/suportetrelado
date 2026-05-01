import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchBoardColumns, updateBoardColumn, type BoardColumn } from '../lib/boardColumns'
import { COLUMNS } from '../lib/kanbanColumns'
import type { Ticket } from '../lib/supabase'

export const COL_COLORS = ['#101204', '#579dff', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#22c55e', '#ec4899', '#a855f7', '#f97316', '#64748b']

function buildFallbackColumns(): BoardColumn[] {
  return COLUMNS.map((c, i) => ({
    id: c.id,
    department_id: '',
    title: c.label,
    position: i,
    dot_color: c.accent,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))
}

interface UseKanbanColumnsCRUDOptions {
  departmentId: string | null
  showToast: (msg: string, type: 'ok' | 'err') => void
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>
}

/**
 * Carrega colunas do quadro (com fallback para COLUMNS legadas), expõe state
 * derivado (allColumns, ids, mapa) e handlers de edição (título, cor, ordenação).
 */
export function useKanbanColumnsCRUD({ departmentId, showToast, setTickets }: UseKanbanColumnsCRUDOptions) {
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingColumnTitle, setEditingColumnTitle] = useState('')
  const [colorPickerColumnId, setColorPickerColumnId] = useState<string | null>(null)
  const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [colMenuView, setColMenuView] = useState<'main' | 'color' | 'sort'>('main')

  // Carregar colunas do Supabase (com fallback para COLUMNS legadas) e assinar Realtime
  useEffect(() => {
    let isMounted = true

    const fetchCols = async () => {
      try {
        const cols = await fetchBoardColumns(departmentId ?? undefined)
        if (!isMounted) return
        
        if (cols.length > 0) {
          setColumns(cols)
          setColumnOrder(cols.map(c => c.id))
        } else {
          const fallback = buildFallbackColumns()
          setColumns(fallback)
          setColumnOrder(fallback.map(c => c.id))
        }
      } catch {
        if (!isMounted) return
        const fallback = buildFallbackColumns()
        setColumns(fallback)
        setColumnOrder(fallback.map(c => c.id))
      }
    }
    
    fetchCols()

    // Realtime subscription para Board Columns
    const realtimeFilter = departmentId ? { filter: `department_id=eq.${departmentId}` } : {}
    const channel = import('../lib/supabase').then(({ supabase }) => {
      const ch = supabase
        .channel(`board-columns-realtime-${departmentId || 'all'}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'board_columns', ...realtimeFilter }, () => {
          fetchCols()
        })
        .subscribe()
      return ch
    })

    return () => {
      isMounted = false
      channel.then(ch => {
        import('../lib/supabase').then(({ supabase }) => {
          supabase.removeChannel(ch)
        })
      })
    }
  }, [departmentId])

  const allColumnsById = useMemo(() => new Map(columns.map(col => [col.id, col])), [columns])
  const allColumns = useMemo(
    () => columnOrder.map(id => allColumnsById.get(id)).filter((col): col is NonNullable<typeof col> => Boolean(col)),
    [columnOrder, allColumnsById],
  )
  const columnIds = useMemo(() => allColumns.map(col => col.id), [allColumns])

  const handleSaveColumnTitle = useCallback(async (colId: string, newTitle: string) => {
    const trimmed = newTitle.trim().slice(0, 30)
    if (!trimmed) { setEditingColumnId(null); return }
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, title: trimmed } : c))
    setEditingColumnId(null)
    try {
      await updateBoardColumn(colId, { title: trimmed })
    } catch {
      showToast('Erro ao renomear lista', 'err')
    }
  }, [showToast])

  const handleSaveColumnColor = useCallback(async (colId: string, color: string) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, dot_color: color } : c))
    setColorPickerColumnId(null)
    try {
      await updateBoardColumn(colId, { dot_color: color })
    } catch {
      showToast('Erro ao mudar cor da lista', 'err')
    }
  }, [showToast])

  const handleSortColumn = useCallback((colId: string, sortType: 'newest' | 'oldest' | 'alpha' | 'due') => {
    setTickets(prev => {
      const colTickets = prev.filter(t => t.status === colId)
      const rest = prev.filter(t => t.status !== colId)
      const sorted = [...colTickets].sort((a, b) => {
        switch (sortType) {
          case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          case 'alpha': return a.title.localeCompare(b.title, 'pt-BR')
          case 'due': {
            const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity
            const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity
            return aDate - bDate
          }
          default: return 0
        }
      })
      sorted.forEach((t, i) => { (t as Ticket & { position?: number }).position = i })
      return [...rest, ...sorted]
    })
    setColorPickerColumnId(null)
    showToast('Lista ordenada', 'ok')
  }, [showToast, setTickets])

  return {
    columns, setColumns,
    columnOrder, setColumnOrder,
    allColumns, allColumnsById, columnIds,
    editingColumnId, setEditingColumnId,
    editingColumnTitle, setEditingColumnTitle,
    colorPickerColumnId, setColorPickerColumnId,
    colorPickerPos, setColorPickerPos,
    colMenuView, setColMenuView,
    handleSaveColumnTitle,
    handleSaveColumnColor,
    handleSortColumn,
    COL_COLORS,
  }
}
