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
    bgPrimary: '#1d2125',
    bgSecondary: '#0c1317',
    bgCard: '#22272b',
    bgInput: '#22272b',
    borderSubtle: 'rgba(166,197,226,0.16)',
    textPrimary: '#b6c2cf',
    textSecondary: '#9fadbc',
    textMuted: '#596773',
    accent: '#579dff',
    accentHover: '#85b8ff',
  },
  darker: {
    bgPrimary: '#161a1d',
    bgSecondary: '#0c1317',
    bgCard: '#1d2125',
    bgInput: '#1d2125',
    borderSubtle: 'rgba(166,197,226,0.12)',
    textPrimary: '#b6c2cf',
    textSecondary: '#9fadbc',
    textMuted: '#596773',
    accent: '#579dff',
    accentHover: '#85b8ff',
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
    accent: '#579dff',
    accentHover: '#85b8ff',
  },
  greenDark: {
    bgPrimary: '#101204',
    bgSecondary: '#0c1317',
    bgCard: '#22272b',
    bgInput: '#22272b',
    borderSubtle: 'rgba(75,206,151,0.16)',
    textPrimary: '#b6c2cf',
    textSecondary: '#9fadbc',
    textMuted: '#596773',
    accent: '#4bce97',
    accentHover: '#7ee2b8',
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
