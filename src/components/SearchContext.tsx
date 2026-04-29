import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'

interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
  loading: boolean
  setLoading: (b: boolean) => void
  resultsCount: number | null
  setResultsCount: (n: number | null) => void
  registerInput: (el: HTMLInputElement | null) => void
  focusInput: () => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultsCount, setResultsCount] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const registerInput = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el
  }, [])

  const focusInput = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <SearchContext.Provider
      value={{ query, setQuery, loading, setLoading, resultsCount, setResultsCount, registerInput, focusInput }}
    >
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error('useSearch deve ser usado dentro de <SearchProvider>')
  return ctx
}
