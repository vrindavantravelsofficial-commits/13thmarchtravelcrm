'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { prefetchData } from '@/hooks/useData'
import { 
  LayoutDashboard, FileText, Package, Settings,
  X, Sun, Moon, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useCallback, useState, useEffect } from 'react'

const routePrefetchMap = {
  '/dashboard': '/dashboard/stats',
  '/queries': '/queries',
  '/packages': '/packages',
}

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname()
  const { logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMediumScreen, setIsMediumScreen] = useState(false)

  // Detect medium screen size for auto-collapse
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      setIsMediumScreen(width >= 768 && width < 1024)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Auto-collapse on medium screens
  useEffect(() => {
    if (isMediumScreen) {
      setIsCollapsed(true)
    } else if (window.innerWidth >= 1024) {
      setIsCollapsed(false)
    }
  }, [isMediumScreen])

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { id: 'queries', label: 'Queries', icon: FileText, href: '/queries' },
    { id: 'packages', label: 'Tour Packages', icon: Package, href: '/packages' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ]

  const handleMouseEnter = useCallback((href) => {
    const endpoint = routePrefetchMap[href]
    if (endpoint) {
      prefetchData(endpoint)
    }
  }, [])

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      onClose()
    }
  }

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div 
      className={`
        fixed md:relative inset-y-0 left-0 z-40
        flex flex-col bg-card border-r border-border/50
        transform transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-64 md:w-56 lg:w-64'}
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        md:transform-none
      `}
      data-testid="sidebar"
    >
      {/* Mobile Close Button */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border/50">
        <span className={`font-semibold text-foreground transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
          Menu
        </span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Collapse Toggle Button - Desktop only */}
      <div className="hidden md:flex items-center justify-end p-2 border-b border-border/50">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleCollapse}
          className="h-8 w-8 rounded-lg hover:bg-accent transition-all duration-200"
          data-testid="sidebar-collapse-toggle"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={handleNavClick}
              onMouseEnter={() => handleMouseEnter(item.href)}
              prefetch={true}
              data-testid={`nav-${item.id}`}
              title={isCollapsed ? item.label : undefined}
              className={`
                flex items-center gap-3 px-3 py-3 rounded-xl mb-1
                transition-all duration-200 group relative
                ${isCollapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }
              `}
            >
              <Icon className={`w-5 h-5 shrink-0 transition-transform duration-200 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'} ${isCollapsed ? 'transform scale-110' : ''}`} />
              <span className={`font-medium text-sm whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                {item.label}
              </span>
              
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 border border-border">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-2 border-t border-border/50 space-y-1">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={isCollapsed ? (theme === 'light' ? 'Dark Mode' : 'Light Mode') : undefined}
          className={`
            flex items-center gap-3 w-full px-3 py-3 rounded-xl
            text-muted-foreground hover:bg-accent hover:text-foreground
            transition-all duration-200 group relative
            ${isCollapsed ? 'justify-center' : ''}
          `}
          data-testid="theme-toggle-sidebar"
        >
          {theme === 'light' ? <Moon className="w-5 h-5 shrink-0" /> : <Sun className="w-5 h-5 shrink-0" />}
          <span className={`font-medium text-sm whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </span>
          
          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 border border-border">
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </div>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          title={isCollapsed ? 'Logout' : undefined}
          className={`
            flex items-center gap-3 w-full px-3 py-3 rounded-xl
            text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
            transition-all duration-200 group relative
            ${isCollapsed ? 'justify-center' : ''}
          `}
          data-testid="logout-sidebar"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className={`font-medium text-sm whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            Logout
          </span>
          
          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 border border-border">
              Logout
            </div>
          )}
        </button>
      </div>
    </div>
  )
}
