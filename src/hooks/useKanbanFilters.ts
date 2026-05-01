import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Ticket, UserProfile } from '../lib/supabase'
import { searchTicketsRPC, searchTicketsLocal, debounce } from '../lib/search'

interface UseKanbanFiltersProps {
  tickets: Ticket[]
  allMembers: UserProfile[]
}

export function useKanbanFilters({ tickets, allMembers }: UseKanbanFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterLabel, setFilterLabel] = useState<string>('all')
  const [serverSearchResults, setServerSearchResults] = useState<Ticket[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce retorna função estável
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setServerSearchResults(null)
        setSearchLoading(false)
        return
      }
      setSearchLoading(true)
      const results = await searchTicketsRPC(query)
      setServerSearchResults(results.length > 0 ? results : null)
      setSearchLoading(false)
    }, 350),
    []
  )

  useEffect(() => {
    debouncedSearch(searchQuery)
  }, [searchQuery, debouncedSearch])

  const getColumnTickets = useCallback((status: string) => {
    if (serverSearchResults && searchQuery.trim()) {
      let filtered = serverSearchResults.filter(t => t.status === status)
      if (filterPriority !== 'all') filtered = filtered.filter(t => t.priority === filterPriority)
      if (filterAssignee !== 'all') {
        if (filterAssignee === '__none__') {
          filtered = filtered.filter(t => !t.assignee)
        } else {
          const member = allMembers.find(m => m.email === filterAssignee)
          filtered = filtered.filter(t => {
            if (!t.assignee) return false
            const parts = t.assignee.split(',').map(s => s.trim().toLowerCase())
            const fa = filterAssignee.toLowerCase()
            return parts.some(p => p === fa || (member && (p === member.name.toLowerCase() || p === member.email.toLowerCase())))
          })
        }
      }
      if (filterLabel !== 'all') filtered = filtered.filter(t => t.tags && t.tags.some(tag => tag.includes(filterLabel)))
      return filtered
    }

    let filtered = tickets.filter(t => t.status === status)
    if (searchQuery.trim()) filtered = searchTicketsLocal(filtered, searchQuery)
    if (filterPriority !== 'all') filtered = filtered.filter(t => t.priority === filterPriority)
    if (filterAssignee !== 'all') {
      if (filterAssignee === '__none__') {
        filtered = filtered.filter(t => !t.assignee)
      } else {
        const member = allMembers.find(m => m.email === filterAssignee)
        filtered = filtered.filter(t => {
          if (!t.assignee) return false
          const parts = t.assignee.split(',').map(s => s.trim().toLowerCase())
          const fa = filterAssignee.toLowerCase()
          return parts.some(p => p === fa || (member && (p === member.name.toLowerCase() || p === member.email.toLowerCase())))
        })
      }
    }
    if (filterLabel !== 'all') filtered = filtered.filter(t => t.tags && t.tags.some(tag => tag.includes(filterLabel)))
    return filtered
  // eslint-disable-next-line react-hooks/exhaustive-deps -- allMembers omitido intencionalmente
  }, [tickets, searchQuery, serverSearchResults, filterPriority, filterAssignee, filterLabel])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterPriority !== 'all') count++
    if (filterAssignee !== 'all') count++
    if (filterLabel !== 'all') count++
    return count
  }, [filterPriority, filterAssignee, filterLabel])

  const uniqueAssignees = useMemo(() => {
    const seen = new Map<string, string>()
    for (const t of tickets) {
      if (t.assignee) {
        t.assignee.split(',').map(s => s.trim()).filter(Boolean).forEach(raw => {
          const member = allMembers.find(m => m.email === raw || m.name === raw || m.email.split('@')[0].toLowerCase() === raw.toLowerCase())
          const key = member?.email || raw.toLowerCase()
          if (!seen.has(key)) {
            seen.set(key, member?.name || (raw.includes('@') ? raw.split('@')[0] : raw))
          }
        })
      }
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [tickets, allMembers])

  const uniqueLabels = useMemo(() => {
    const set = new Set<string>()
    for (const t of tickets) {
      if (t.tags) t.tags.forEach(tag => set.add(tag))
    }
    return Array.from(set).sort()
  }, [tickets])

  const clearAllFilters = useCallback(() => {
    setFilterPriority('all')
    setFilterAssignee('all')
    setFilterLabel('all')
  }, [])

  return {
    searchQuery, setSearchQuery,
    showFilters, setShowFilters,
    filterPriority, setFilterPriority,
    filterAssignee, setFilterAssignee,
    filterLabel, setFilterLabel,
    serverSearchResults,
    searchLoading,
    getColumnTickets,
    activeFilterCount,
    uniqueAssignees,
    uniqueLabels,
    clearAllFilters,
  }
}
