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

export const PRESETS: Record<string, ThemeConfig> = {
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
  chatpro: {
    bgPrimary: '#1a1f23',
    bgSecondary: '#111518',
    bgCard: '#22272b',
    bgInput: '#22272b',
    borderSubtle: 'rgba(37,208,102,0.16)',
    textPrimary: '#b6c2cf',
    textSecondary: '#9fadbc',
    textMuted: '#596773',
    accent: '#25D066',
    accentHover: '#1BAD53',
  },
  purple: {
    bgPrimary: '#1a1525',
    bgSecondary: '#12101d',
    bgCard: '#231e33',
    bgInput: '#231e33',
    borderSubtle: 'rgba(168,130,255,0.16)',
    textPrimary: '#d4c8f0',
    textSecondary: '#b8a8d8',
    textMuted: '#7a6b94',
    accent: '#a882ff',
    accentHover: '#c4a8ff',
  },
  sunset: {
    bgPrimary: '#1f1815',
    bgSecondary: '#15100d',
    bgCard: '#2a201b',
    bgInput: '#2a201b',
    borderSubtle: 'rgba(255,140,70,0.16)',
    textPrimary: '#e0cfc4',
    textSecondary: '#c4b0a0',
    textMuted: '#8a7565',
    accent: '#ff8c46',
    accentHover: '#ffab73',
  },
  ocean: {
    bgPrimary: '#0f1b2d',
    bgSecondary: '#0a1220',
    bgCard: '#152238',
    bgInput: '#152238',
    borderSubtle: 'rgba(56,189,248,0.16)',
    textPrimary: '#c0d8ef',
    textSecondary: '#8fb8d8',
    textMuted: '#4a7a9b',
    accent: '#38bdf8',
    accentHover: '#7dd3fc',
  },
}

const PRESET_LIST = [
  { key: 'dark', label: 'Escuro' },
  { key: 'darker', label: 'Escuro Profundo' },
  { key: 'light', label: 'Claro' },
  { key: 'greenDark', label: 'Verde Escuro' },
  { key: 'chatpro', label: 'chatPro' },
  { key: 'purple', label: 'Roxo' },
  { key: 'sunset', label: 'Pôr do Sol' },
  { key: 'ocean', label: 'Oceano' },
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
