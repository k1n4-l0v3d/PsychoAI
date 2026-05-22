import { darkTheme } from './dark'
import { lightTheme } from './light'

export function applyTheme(theme: 'dark' | 'light') {
  const vars = theme === 'dark' ? darkTheme : lightTheme
  const root = document.documentElement
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  root.setAttribute('data-theme', theme)
}
