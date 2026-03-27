import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface ThemeConfig {
  bgPrimary: string
  bgSecondary: string
  bgCard: string
  bgInput: string
  borderSubtle: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
  accentHover: string
}

const PRESETS: Record<string, ThemeConfig> = {
  dark: {
    bgPrimary: '#111111',
    bgSecondary: '#1a1a1a',
    bgCard: '#222222',
    bgInput: '#181818',
    borderSubtle: 'rgba(255,255,255,0.08)',
    textPrimary: '#F1F0F2',
    textSecondary: '#D1D1D5',
    textMuted: '#888888',
    accent: '#25D066',
    accentHover: '#1BAD53',
  },
  darker: {
    bgPrimary: '#0a0a0a',
    bgSecondary: '#141414',
    bgCard: '#1a1a1a',
    bgInput: '#111111',
    borderSubtle: 'rgba(255,255,255,0.06)',
    textPrimary: '#E6E5E8',
    textSecondary: '#D1D1D5',
    textMuted: '#777777',
    accent: '#25D066',
    accentHover: '#1BAD53',
  },
  light: {
    bgPrimary: '#F1F0F2',
    bgSecondary: '#E6E5E8',
    bgCard: '#FFFFFF',
    bgInput: '#F1F0F2',
    borderSubtle: 'rgba(0,0,0,0.10)',
    textPrimary: '#111111',
    textSecondary: '#333333',
    textMuted: '#777777',
    accent: '#1BAD53',
    accentHover: '#25D066',
  },
  greenDark: {
    bgPrimary: '#0d1a12',
    bgSecondary: '#142218',
    bgCard: '#1a2e20',
    bgInput: '#112016',
    borderSubtle: 'rgba(37,208,102,0.12)',
    textPrimary: '#EEFCF3',
    textSecondary: '#D1D1D5',
    textMuted: '#6b8f76',
    accent: '#25D066',
    accentHover: '#24FF72',
  },
}

const PRESET_LIST = [
  { key: 'dark', label: 'Escuro' },
  { key: 'darker', label: 'Escuro Profundo' },
  { key: 'light', label: 'Claro' },
  { key: 'greenDark', label: 'Verde Escuro' },
] as const

interface ThemeContextValue {
  theme: ThemeConfig
  presetKey: string
  setPreset: (key: string) => void
  setCustomColor: (key: keyof ThemeConfig, value: string) => void
  presets: typeof PRESET_LIST
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme outside ThemeProvider')
  return ctx
}

function applyThemeToDom(t: ThemeConfig) {
  const root = document.documentElement.style
  root.setProperty('--bg-primary', t.bgPrimary)
  root.setProperty('--bg-secondary', t.bgSecondary)
  root.setProperty('--bg-card', t.bgCard)
  root.setProperty('--bg-input', t.bgInput)
  root.setProperty('--border-subtle', t.borderSubtle)
  root.setProperty('--text-primary', t.textPrimary)
  root.setProperty('--text-secondary', t.textSecondary)
  root.setProperty('--text-muted', t.textMuted)
  root.setProperty('--accent', t.accent)
  root.setProperty('--accent-hover', t.accentHover)
}

const STORAGE_KEY = 'chatpro-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [presetKey, setPresetKey] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.presetKey || 'dark'
      }
    } catch {}
    return 'dark'
  })

  const [theme, setTheme] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.theme || PRESETS.dark
      }
    } catch {}
    return PRESETS.dark
  })

  useEffect(() => {
    applyThemeToDom(theme)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ presetKey, theme }))
  }, [theme, presetKey])

  const setPreset = (key: string) => {
    const t = PRESETS[key]
    if (t) {
      setPresetKey(key)
      setTheme(t)
    }
  }

  const setCustomColor = (key: keyof ThemeConfig, value: string) => {
    setPresetKey('custom')
    setTheme(prev => ({ ...prev, [key]: value }))
  }

  return (
    <ThemeContext.Provider value={{ theme, presetKey, setPreset, setCustomColor, presets: PRESET_LIST }}>
      {children}
    </ThemeContext.Provider>
  )
}
