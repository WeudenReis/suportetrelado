import { useState, useEffect, type ReactNode } from 'react'
import { ThemeContext, PRESETS, PRESET_LIST, type ThemeConfig } from './themeContext'

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
    } catch { /* ignore parse errors */ }
    return 'dark'
  })

  const [theme, setTheme] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.theme || PRESETS.dark
      }
    } catch { /* ignore parse errors */ }
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
