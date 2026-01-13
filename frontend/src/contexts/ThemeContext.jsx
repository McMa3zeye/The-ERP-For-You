import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const THEME_STORAGE_KEY = 'wood_erp_theme'
const DENSITY_STORAGE_KEY = 'wood_erp_density'
const MOTION_STORAGE_KEY = 'wood_erp_reduce_motion'

export const THEMES = [
  { key: 'hearth', name: 'Hearth (Chimney)', description: 'Warm walnut + ember glow' },
  { key: 'forest', name: 'Forest', description: 'Deep greens + natural wood' },
  { key: 'emerald', name: 'Emerald', description: 'Bright green + clean contrast' },
  { key: 'midnight', name: 'Midnight', description: 'Slate + soft gold accents' },
  { key: 'linen', name: 'Linen', description: 'Light, warm, airy' },
  { key: 'cobalt', name: 'Cobalt', description: 'Cool professional blue' },
  { key: 'ruby', name: 'Ruby', description: 'Bold red + warm highlights' },
  { key: 'sunset', name: 'Sunset', description: 'Orange/pink glow + calm depth' },
]

const ThemeContext = createContext(null)

export function useTheme() {
  return useContext(ThemeContext)
}

function safeGet(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ?? fallback
  } catch {
    return fallback
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => safeGet(THEME_STORAGE_KEY, 'hearth'))
  const [density, setDensityState] = useState(() => safeGet(DENSITY_STORAGE_KEY, 'comfortable'))
  const [reduceMotion, setReduceMotionState] = useState(() => safeGet(MOTION_STORAGE_KEY, 'false') === 'true')

  useEffect(() => {
    // If theme key no longer exists (or user has a stale localStorage value), fall back safely.
    if (!THEMES.some((t) => t.key === theme)) {
      setThemeState('hearth')
      safeSet(THEME_STORAGE_KEY, 'hearth')
    }
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.density = density
    root.dataset.motion = reduceMotion ? 'reduced' : 'normal'
  }, [theme, density, reduceMotion])

  const setTheme = (next) => {
    setThemeState(next)
    safeSet(THEME_STORAGE_KEY, next)
  }

  const setDensity = (next) => {
    setDensityState(next)
    safeSet(DENSITY_STORAGE_KEY, next)
  }

  const setReduceMotion = (next) => {
    setReduceMotionState(next)
    safeSet(MOTION_STORAGE_KEY, next ? 'true' : 'false')
  }

  const value = useMemo(
    () => ({
      theme,
      density,
      reduceMotion,
      themes: THEMES,
      setTheme,
      setDensity,
      setReduceMotion,
    }),
    [theme, density, reduceMotion],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

