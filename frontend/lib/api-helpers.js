// Supabase API helpers
import { supabaseAdmin } from './supabase'

// Get user from token
export async function getUserFromToken(token) {
  if (!token || !supabaseAdmin) return null
  
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data.user) return null
    
    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()
    
    return profile
  } catch (error) {
    console.error('Error getting user from token:', error)
    return null
  }
}

// Get organization filter based on user role
export function getOrgFilter(user, organizationId) {
  // Super admin can see all data
  if (user?.is_super_admin || user?.role === 'super_admin') {
    return organizationId ? { organization_id: organizationId } : {}
  }
  
  // Regular users see their org data only
  if (user?.organization_id) {
    return { organization_id: user.organization_id }
  }
  
  // Users without org see no org-specific data
  return { organization_id: null }
}

// Convert camelCase to snake_case for Supabase
export function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object') return obj
  
  const converted = {}
  for (const [key, value] of Object.entries(obj)) {
    // Convert camelCase to snake_case
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    converted[snakeKey] = value
  }
  return converted
}

// Convert snake_case to camelCase for frontend
export function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toCamelCase)
  
  const converted = {}
  for (const [key, value] of Object.entries(obj)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    converted[camelKey] = Array.isArray(value) ? value : value
  }
  return converted
}

// Add organization_id to new documents
export function addOrgId(data, user) {
  // Convert camelCase to snake_case first
  const snakeData = toSnakeCase(data)
  
  if (user?.organization_id && !user?.is_super_admin) {
    return { ...snakeData, organization_id: user.organization_id }
  }
  return snakeData
}

// Generate unique ID
export function generateId() {
  return crypto.randomUUID()
}

// Handle CORS headers
export function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Organization-Id')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}
