'use client'

import { useTheme } from './ThemeProvider'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme()

    return (
        <button
            onClick={toggleTheme}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center
                       bg-slate-800/60
                       border border-slate-700/40 hover:border-slate-600 
                       text-slate-400 hover:text-white
                       transition-all duration-300 active:scale-90"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
            ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
            )}
        </button>
    )
}
