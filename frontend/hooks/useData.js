'use client'

import { useGlobalData } from '@/contexts/DataContext'
import { useCallback } from 'react'

// Hook for dashboard stats
export function useDashboardStats() {
  return useGlobalData('/dashboard/stats')
}

// Hook for queries
export function useQueries() {
  return useGlobalData('/queries')
}

// Hook for packages
export function usePackages() {
  return useGlobalData('/packages')
}

// Hook for hotels
export function useHotels() {
  return useGlobalData('/hotels')
}

// Hook for activities
export function useActivities() {
  return useGlobalData('/activities')
}

// Hook for routes
export function useRoutes() {
  return useGlobalData('/routes')
}

// Hook for users
export function useUsers() {
  return useGlobalData('/users')
}

// Hook for transports
export function useTransports() {
  return useGlobalData('/transports')
}

// Generic hook for any endpoint
export function useData(endpoint) {
  return useGlobalData(endpoint)
}

// Helper to create optimistic add
export function createOptimisticAdd(newItem) {
  return (currentData) => [...currentData, newItem]
}

// Helper to create optimistic update
export function createOptimisticUpdate(id, updates) {
  return (currentData) => currentData.map(item => 
    item.id === id ? { ...item, ...updates } : item
  )
}

// Helper to create optimistic delete
export function createOptimisticDelete(id) {
  return (currentData) => currentData.filter(item => item.id !== id)
}

// Prefetch function (no-op now since DataProvider handles it)
export function prefetchData(endpoint) {
  // Data is pre-fetched by DataProvider
}
