'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import supabase from '@/lib/supabase'

const DataContext = createContext(null)

// Global cache that persists across page navigations
const globalCache = {
  data: {},
  timestamps: {},
  TTL: 30 * 1000, // 30 seconds cache TTL for better performance
}

// Event emitter for instant updates across components
const subscribers = new Map()

function notifySubscribers(endpoint, data) {
  const callbacks = subscribers.get(endpoint) || []
  callbacks.forEach(cb => cb(data))
}

function subscribe(endpoint, callback) {
  if (!subscribers.has(endpoint)) {
    subscribers.set(endpoint, [])
  }
  subscribers.get(endpoint).push(callback)
  return () => {
    const callbacks = subscribers.get(endpoint) || []
    const index = callbacks.indexOf(callback)
    if (index > -1) callbacks.splice(index, 1)
  }
}

export function DataProvider({ children }) {
  const [cache, setCache] = useState(globalCache.data)
  const [loading, setLoading] = useState({})
  const fetchingRef = useRef({})

  const getToken = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch {
      return null
    }
  }, [])

  const fetchData = useCallback(async (endpoint, force = false) => {
    const now = Date.now()
    const cached = globalCache.data[endpoint]
    const timestamp = globalCache.timestamps[endpoint]

    // Return cached data if valid and not forced refresh
    if (!force && cached && timestamp && (now - timestamp) < globalCache.TTL) {
      return cached
    }

    // Prevent duplicate concurrent fetches
    if (fetchingRef.current[endpoint]) {
      return cached || []
    }

    fetchingRef.current[endpoint] = true
    setLoading(prev => ({ ...prev, [endpoint]: true }))

    try {
      const token = await getToken()
      // Add cache busting timestamp to URL
      const cacheBuster = `${endpoint.includes('?') ? '&' : '?'}_t=${now}`
      const res = await fetch(`/api${endpoint}${cacheBuster}`, {
        headers: { 
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      })
      if (res.ok) {
        const data = await res.json()
        globalCache.data[endpoint] = data
        globalCache.timestamps[endpoint] = now
        setCache(prev => ({ ...prev, [endpoint]: data }))
        notifySubscribers(endpoint, data)
        return data
      }
    } catch (e) {
      console.error(`Failed to fetch ${endpoint}:`, e)
    } finally {
      fetchingRef.current[endpoint] = false
      setLoading(prev => ({ ...prev, [endpoint]: false }))
    }

    return cached || []
  }, [getToken])

  // Pre-fetch all common data on mount
  const prefetchAll = useCallback(async () => {
    const token = await getToken()
    if (!token) return

    const endpoints = ['/dashboard/stats', '/queries', '/packages', '/hotels', '/activities', '/routes', '/users', '/transports']
    
    // Fetch all in parallel
    await Promise.all(endpoints.map(endpoint => fetchData(endpoint)))
  }, [fetchData, getToken])

  useEffect(() => {
    prefetchAll()
  }, [])

  const getData = useCallback((endpoint) => {
    return globalCache.data[endpoint] || cache[endpoint] || []
  }, [cache])

  const isLoading = useCallback((endpoint) => {
    return loading[endpoint] && !globalCache.data[endpoint]
  }, [loading])

  // Optimistic update - instantly update local state before server confirmation
  const optimisticUpdate = useCallback((endpoint, updateFn) => {
    const currentData = globalCache.data[endpoint] || []
    const newData = updateFn(currentData)
    globalCache.data[endpoint] = newData
    globalCache.timestamps[endpoint] = Date.now()
    setCache(prev => ({ ...prev, [endpoint]: newData }))
    notifySubscribers(endpoint, newData)
  }, [])

  const refreshData = useCallback(async (endpoint) => {
    // Clear cache first to force fresh fetch
    delete globalCache.timestamps[endpoint]
    fetchingRef.current[endpoint] = false
    return fetchData(endpoint, true)
  }, [fetchData])

  const invalidateCache = useCallback((endpoint) => {
    delete globalCache.data[endpoint]
    delete globalCache.timestamps[endpoint]
    fetchingRef.current[endpoint] = false
    setCache(prev => {
      const newCache = { ...prev }
      delete newCache[endpoint]
      return newCache
    })
  }, [])

  // Invalidate all related caches
  const invalidateAll = useCallback(() => {
    const endpoints = Object.keys(globalCache.data)
    endpoints.forEach(ep => {
      delete globalCache.timestamps[ep]
    })
  }, [])

  return (
    <DataContext.Provider value={{ 
      getData, 
      fetchData, 
      isLoading, 
      refreshData, 
      invalidateCache,
      invalidateAll,
      optimisticUpdate,
      prefetchAll,
      subscribe
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useGlobalData(endpoint) {
  const context = useContext(DataContext)
  const [localData, setLocalData] = useState(() => {
    // Initialize with cached data immediately
    return globalCache.data[endpoint] || []
  })
  const [localLoading, setLocalLoading] = useState(() => {
    // Only show loading if no cached data
    return !globalCache.data[endpoint]
  })

  useEffect(() => {
    if (!context) return

    // Get cached data immediately
    const cached = context.getData(endpoint)
    if (cached && (Array.isArray(cached) ? cached.length > 0 : Object.keys(cached).length > 0)) {
      setLocalData(cached)
      setLocalLoading(false)
    }

    // Subscribe to updates for instant reactivity
    const unsubscribe = context.subscribe(endpoint, (newData) => {
      setLocalData(newData)
      setLocalLoading(false)
    })

    // Fetch fresh data if not in cache or stale
    context.fetchData(endpoint).then(data => {
      if (data) {
        setLocalData(data)
      }
      setLocalLoading(false)
    })

    return unsubscribe
  }, [endpoint, context])

  // Instant mutate with optimistic update support
  const mutate = useCallback(async (optimisticData) => {
    if (!context) return

    // If optimistic data provided, update immediately
    if (optimisticData !== undefined) {
      if (typeof optimisticData === 'function') {
        context.optimisticUpdate(endpoint, optimisticData)
      } else {
        context.optimisticUpdate(endpoint, () => optimisticData)
      }
    }

    // Then fetch fresh data from server
    setLocalLoading(true)
    const data = await context.refreshData(endpoint)
    if (data) {
      setLocalData(data)
    }
    setLocalLoading(false)
    return data
  }, [context, endpoint])

  // Set data directly for instant updates
  const setData = useCallback((newData) => {
    if (!context) return
    if (typeof newData === 'function') {
      context.optimisticUpdate(endpoint, newData)
    } else {
      context.optimisticUpdate(endpoint, () => newData)
    }
  }, [context, endpoint])

  return {
    data: localData,
    isLoading: localLoading && (!localData || (Array.isArray(localData) && localData.length === 0)),
    mutate,
    setData
  }
}
