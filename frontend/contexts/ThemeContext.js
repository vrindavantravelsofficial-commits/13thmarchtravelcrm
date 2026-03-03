'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setSpecificTheme: () => {}
})

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const savedTheme = localStorage.getItem('theme') || 'light'
      setTheme(savedTheme)
      document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    } catch (e) {
      // localStorage not available
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    try {
      localStorage.setItem('theme', newTheme)
    } catch (e) {}
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const setSpecificTheme = (newTheme) => {
    setTheme(newTheme)
    try {
      localStorage.setItem('theme', newTheme)
    } catch (e) {}
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  // Always render children, just with default values before mounting
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setSpecificTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  return context
}
