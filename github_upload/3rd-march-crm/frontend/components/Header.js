'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Search, Bell, Settings, LogOut, Home,
  Hotel, Car, Calendar, ClipboardList, Wallet, 
  ArrowDownCircle, ArrowUpCircle, MapPin,
  ChevronDown, Building, Plane, Sparkles, User, UserPlus, Webhook, Menu
} from 'lucide-react'

export default function Header({ onMenuClick }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isSuperAdmin, getToken } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const userMenuRef = useRef(null)
  const notifRef = useRef(null)
  const dropdownTimeout = useRef(null)

  // Check if user has admin or finance role
  const userRoles = user?.roles || []
  const hasRole = (role) => userRoles.includes(role)
  const isAdmin = hasRole('admin') || isSuperAdmin
  const isFinanceTeam = hasRole('finance') || isAdmin

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = getToken()
        if (!token) return
        const res = await fetch('/api/queries', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const queries = await res.json()
          const now = new Date()
          const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000)
          
          const notifs = []
          
          queries.forEach(q => {
            if (q.nextFollowUp) {
              const followUpDate = new Date(q.nextFollowUp)
              if (followUpDate <= now) {
                notifs.push({
                  id: q.id,
                  type: 'followup',
                  title: `Follow-up due: ${q.customerName}`,
                  subtitle: `${q.queryNumber} • ${q.destination || 'No destination'}`,
                  query: q,
                  createdAt: q.nextFollowUp
                })
              }
            }
            
            if (q.createdAt && new Date(q.createdAt) > oneDayAgo && q.status === 'new') {
              notifs.push({
                id: `new-${q.id}`,
                type: 'new_query',
                title: `New query: ${q.customerName}`,
                subtitle: `${q.queryNumber} • ${q.destination || 'No destination'}`,
                query: q,
                createdAt: q.createdAt
              })
            }
          })
          
          const uniqueNotifs = notifs
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i)
          
          setNotifications(uniqueNotifs)
        }
      } catch (e) {
        console.error('Failed to fetch notifications')
      }
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [getToken, user])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/queries?search=${encodeURIComponent(searchQuery)}`)
      setShowMobileSearch(false)
    }
  }

  const handleMouseEnter = (menu) => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current)
    setActiveDropdown(menu)
  }

  const handleMouseLeave = () => {
    dropdownTimeout.current = setTimeout(() => {
      setActiveDropdown(null)
    }, 150)
  }

  // Left navigation items
  const leftNavItems = [
    { 
      id: 'services', 
      label: 'Services', 
      icon: Hotel,
      dropdown: [
        { label: 'Hotels', href: '/hotels', icon: Hotel },
        { label: 'Transport', href: '/transport', icon: Car },
      ]
    },
    { 
      id: 'booking', 
      label: 'Bookings', 
      icon: Calendar,
      dropdown: [
        { label: 'Hotel Booking', href: '/queries?filter=confirmed&type=hotel', icon: Hotel },
        { label: 'Operational Booking', href: '/operations', icon: ClipboardList },
      ]
    },
    ...(isFinanceTeam ? [{ 
      id: 'finance', 
      label: 'Accounting', 
      icon: Wallet,
      dropdown: [
        { label: 'Incoming Payments', href: '/finance?type=incoming', icon: ArrowDownCircle },
        { label: 'Outgoing Payments', href: '/finance?type=outgoing', icon: ArrowUpCircle },
      ]
    }] : []),
  ]

  // Right navigation items
  const rightNavItems = [
    { 
      id: 'routes', 
      label: 'Routes', 
      href: '/routes',
      icon: MapPin,
    },
  ]

  const renderNavItem = (item, isMobile = false) => {
    const Icon = item.icon
    const isActive = item.href ? pathname === item.href : 
      item.dropdown?.some(d => pathname === d.href || pathname.startsWith(d.href?.split('?')[0]))
    
    if (item.dropdown) {
      return (
        <div 
          key={item.id}
          className="relative"
          onMouseEnter={() => !isMobile && handleMouseEnter(item.id)}
          onMouseLeave={() => !isMobile && handleMouseLeave()}
        >
          <button
            onClick={() => isMobile && setActiveDropdown(activeDropdown === item.id ? null : item.id)}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors
              ${isActive ? 'text-white' : 'text-gray-300 hover:text-white'}`}
            data-testid={`nav-${item.id}`}
          >
            <span className="hidden sm:inline">{item.label}</span>
            <Icon className="w-4 h-4 sm:hidden" />
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${activeDropdown === item.id ? 'rotate-180' : ''}`} />
          </button>
          
          {activeDropdown === item.id && (
            <div 
              className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1.5 z-50"
              style={{ animation: 'fadeIn 0.15s ease-out' }}
              onMouseEnter={() => !isMobile && handleMouseEnter(item.id)}
              onMouseLeave={() => !isMobile && handleMouseLeave()}
            >
              {item.dropdown.map((subItem) => {
                const SubIcon = subItem.icon
                return (
                  <Link
                    key={subItem.label}
                    href={subItem.href}
                    onClick={() => setActiveDropdown(null)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <SubIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    {subItem.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.id}
        href={item.href}
        className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-colors
          ${isActive ? 'text-white' : 'text-gray-300 hover:text-white'}`}
        data-testid={`nav-${item.id}`}
      >
        <span className="hidden sm:inline">{item.label}</span>
        <Icon className="w-4 h-4 sm:hidden" />
      </Link>
    )
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-[#1a1a2e] border-b border-gray-800" data-testid="main-header">
      <div className="flex items-center h-14 px-2 sm:px-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-gray-300 hover:text-white hover:bg-slate-800 mr-2"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0" data-testid="header-logo">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
            <Plane className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <span className="text-sm sm:text-base font-semibold text-white hidden xs:block">Travvip</span>
        </Link>

        {/* Primary Navigation - Hidden on small mobile */}
        <nav className="hidden sm:flex items-center ml-2 sm:ml-4 lg:ml-6">
          {leftNavItems.map(item => renderNavItem(item))}
        </nav>

        {/* Center: Search Bar - Hidden on mobile, shown on desktop */}
        <div className="hidden md:flex flex-1 justify-center px-4 lg:px-8">
          <form onSubmit={handleSearch} className="w-full max-w-md lg:max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search queries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 h-9 bg-[#2a2a3e] border-0 text-white placeholder:text-gray-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm"
                data-testid="header-search"
              />
            </div>
          </form>
        </div>

        {/* Mobile Search Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-gray-300 hover:text-white hover:bg-slate-800 ml-auto"
          onClick={() => setShowMobileSearch(!showMobileSearch)}
        >
          <Search className="w-5 h-5" />
        </Button>

        {/* Right Side */}
        <div className="flex items-center gap-1 sm:gap-2 ml-auto md:ml-0">
          {/* Secondary Navigation */}
          <nav className="hidden sm:flex items-center">
            {rightNavItems.map(item => renderNavItem(item))}
          </nav>

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-gray-300 hover:text-white transition-colors relative"
              data-testid="notifications-button"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-[#1a1a2e]"></span>
              )}
            </button>

            {showNotifications && (
              <div 
                className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-50"
                style={{ animation: 'fadeIn 0.15s ease-out' }}
              >
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Notifications</span>
                  {notifications.length > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                      {notifications.length}
                    </span>
                  )}
                </div>
                <div className="max-h-64 sm:max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notifications</p>
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((notif) => (
                      <Link
                        key={notif.id}
                        href={`/queries/${notif.query?.id || notif.id}`}
                        onClick={() => setShowNotifications(false)}
                        className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700 last:border-0"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            notif.type === 'followup' 
                              ? 'bg-amber-100 dark:bg-amber-900/30' 
                              : 'bg-green-100 dark:bg-green-900/30'
                          }`}>
                            {notif.type === 'followup' ? (
                              <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <ClipboardList className="w-4 h-4 text-green-600 dark:text-green-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {notif.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {notif.subtitle}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* What's New - Hidden on mobile */}
          <Button
            variant="ghost"
            className="hidden lg:flex bg-amber-400 hover:bg-amber-500 text-gray-900 font-medium text-xs sm:text-sm px-2 sm:px-3 h-8 rounded-lg"
            data-testid="whats-new-button"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            <span className="hidden xl:inline">What's New</span>
          </Button>

          {/* Home - Hidden on small screens */}
          <Link
            href="/dashboard"
            className="hidden sm:flex p-2 text-gray-300 hover:text-white transition-colors"
            data-testid="home-button"
          >
            <Home className="w-5 h-5" />
          </Link>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-1.5 sm:p-2 text-gray-300 hover:text-white transition-colors"
              data-testid="user-menu-button"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-semibold">
                {user?.name?.[0] || user?.email?.[0]?.toUpperCase()}
              </div>
            </button>

            {showUserMenu && (
              <div 
                className="absolute right-0 top-full mt-2 w-56 sm:w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1.5 z-50"
                style={{ animation: 'fadeIn 0.15s ease-out' }}
              >
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {user?.name?.[0] || user?.email?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{user?.name || 'User'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full capitalize">
                        {user?.role || 'Admin'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Navigation Items */}
                <div className="sm:hidden py-1 border-b border-gray-100 dark:border-slate-700">
                  {leftNavItems.map(item => (
                    item.dropdown ? (
                      <div key={item.id}>
                        <p className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">{item.label}</p>
                        {item.dropdown.map(sub => (
                          <Link
                            key={sub.label}
                            href={sub.href}
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2 px-6 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <sub.icon className="w-4 h-4" />
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    ) : null
                  ))}
                  <Link
                    href="/routes"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <MapPin className="w-4 h-4" />
                    Routes
                  </Link>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                    data-testid="settings-link"
                  >
                    <Settings className="w-4 h-4 text-gray-500" />
                    Settings
                  </Link>
                  
                  <Link
                    href="/lead-sources"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <Webhook className="w-4 h-4 text-gray-500" />
                    Lead Sources
                  </Link>
                  
                  {isSuperAdmin && (
                    <Link
                      href="/organizations"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                      <Building className="w-4 h-4 text-gray-500" />
                      Organizations
                    </Link>
                  )}
                </div>

                <div className="border-t border-gray-100 dark:border-slate-700 pt-1">
                  <button
                    onClick={() => { logout(); setShowUserMenu(false); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    data-testid="header-logout-button"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {showMobileSearch && (
        <div className="md:hidden px-3 pb-3 bg-[#1a1a2e]">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search queries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 h-10 bg-[#2a2a3e] border-0 text-white placeholder:text-gray-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm"
                autoFocus
              />
            </div>
          </form>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  )
}
