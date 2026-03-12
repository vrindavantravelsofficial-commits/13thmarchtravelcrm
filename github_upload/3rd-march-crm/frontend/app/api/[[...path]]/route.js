import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserFromToken, getOrgFilter, handleCORS } from '@/lib/api-helpers'

// Email notification helper using Resend or Supabase Edge Function
async function sendOrgStatusEmail(orgEmail, orgName, status, adminEmail) {
  // Check if Resend API key is configured
  const resendApiKey = process.env.RESEND_API_KEY
  const edgeFunctionUrl = process.env.SUPABASE_EMAIL_FUNCTION_URL
  
  const statusMessages = {
    approved: {
      subject: `🎉 Your organization "${orgName}" has been approved!`,
      text: `Congratulations! Your organization "${orgName}" has been approved on Travvip CRM. You can now log in with your admin credentials (${adminEmail}) and start using all features.`,
      html: `
        <h2>🎉 Organization Approved!</h2>
        <p>Congratulations! Your organization <strong>"${orgName}"</strong> has been approved on Travvip CRM.</p>
        <p>You can now log in with your admin credentials (<strong>${adminEmail}</strong>) and start using all features.</p>
        <p>Thank you for choosing Travvip CRM!</p>
      `
    },
    rejected: {
      subject: `Organization "${orgName}" registration status`,
      text: `We regret to inform you that your organization "${orgName}" registration has been rejected. Please contact support for more information.`,
      html: `
        <h2>Organization Registration Status</h2>
        <p>We regret to inform you that your organization <strong>"${orgName}"</strong> registration has been rejected.</p>
        <p>Please contact support for more information about this decision.</p>
      `
    },
    suspended: {
      subject: `Organization "${orgName}" has been suspended`,
      text: `Your organization "${orgName}" has been suspended. Please contact support for more information.`,
      html: `
        <h2>Organization Suspended</h2>
        <p>Your organization <strong>"${orgName}"</strong> has been suspended.</p>
        <p>Please contact support for more information about this decision.</p>
      `
    }
  }

  const emailContent = statusMessages[status]
  if (!emailContent) return { success: false, error: 'Unknown status' }

  try {
    // Method 1: Use Resend if API key is configured
    if (resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'noreply@travvip.com',
          to: [orgEmail],
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        }),
      })

      if (response.ok) {
        console.log(`Email sent to ${orgEmail} for status: ${status}`)
        return { success: true }
      } else {
        const error = await response.text()
        console.error('Resend email error:', error)
        return { success: false, error }
      }
    }

    // Method 2: Use Supabase Edge Function if configured
    if (edgeFunctionUrl) {
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          to: orgEmail,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
          orgName,
          status,
        }),
      })

      if (response.ok) {
        console.log(`Email sent via Edge Function to ${orgEmail}`)
        return { success: true }
      } else {
        const error = await response.text()
        console.error('Edge Function email error:', error)
        return { success: false, error }
      }
    }

    // No email service configured - log and continue
    console.log(`Email notification skipped (no service configured): ${status} for ${orgName} (${orgEmail})`)
    return { success: false, error: 'No email service configured' }

  } catch (error) {
    console.error('Email sending error:', error)
    return { success: false, error: error.message }
  }
}

// Increase API route timeout and disable all caching
export const maxDuration = 30
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// Convert camelCase to snake_case
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

// Convert snake_case to camelCase
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

// Convert object keys from camelCase to snake_case
function convertToSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj
  
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    let snakeKey = toSnakeCase(key)
    
    // Special handling for transports - map vehicleType/vehicleName to type/name
    if (key === 'vehicleType') snakeKey = 'type'
    if (key === 'vehicleName') snakeKey = 'name'
    
    // Handle array conversion for inclusions/exclusions
    if ((key === 'inclusions' || key === 'exclusions') && typeof value === 'string') {
      // Convert comma-separated string to array
      result[snakeKey] = value ? value.split(',').map(s => s.trim()).filter(Boolean) : []
    } else {
      result[snakeKey] = value
    }
  }
  return result
}

// Convert object keys from snake_case to camelCase
function convertToCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(item => convertToCamel(item))
  
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key)
    result[camelKey] = Array.isArray(value) ? value : value
  }
  
  // Special handling for transports - map type/name to vehicleType/vehicleName
  if (result.type && !result.vehicleType) {
    result.vehicleType = result.type
  }
  if (result.name && !result.vehicleName && result.type) {
    // Only if this looks like a transport (has type field)
    result.vehicleName = result.name
  }
  
  // Add frontend-expected fields for queries
  if (result.id && result.queryId) {
    result.queryNumber = result.queryId // Frontend expects queryNumber
    result.followUps = result.followUps || [] // Add empty followUps array
    result.activities = result.activities || [] // Add empty activities array
  }
  
  return result
}

// Main route handler
async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    if (!supabaseAdmin) {
      return handleCORS(
        NextResponse.json(
          {
            error: 'Supabase admin client not configured.',
            hint: 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in frontend/.env.local.',
          },
          { status: 500 }
        )
      )
    }

    // Get user context
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const currentUser = await getUserFromToken(token)

    // Helper: check if user is super admin
    const isSuperAdmin = currentUser?.is_super_admin || currentUser?.role === 'super_admin'
    const userOrgId = currentUser?.organization_id || null

    // Helper: apply org scope to a SELECT query
    function scopeQuery(query) {
      if (isSuperAdmin) return query
      if (userOrgId) return query.eq('organization_id', userOrgId)
      return query.is('organization_id', null)
    }

    // Helper: stamp org_id on data for INSERT
    function stampOrg(data) {
      if (!isSuperAdmin && userOrgId) {
        data.organization_id = userOrgId
      }
      return data
    }

    // Helper: verify record belongs to user's org (for PUT/DELETE)
    async function verifyOwnership(table, id) {
      if (isSuperAdmin) return true
      const { data } = await supabaseAdmin.from(table).select('organization_id').eq('id', id).single()
      if (!data) return false
      if (!userOrgId) return data.organization_id === null
      return data.organization_id === userOrgId
    }

    // ===== QUERIES ROUTES =====
    if (route.startsWith('/queries')) {
      const queryId = path[1]
      
      if (method === 'GET' && queryId) {
        let query = supabaseAdmin.from('queries').select('*').eq('id', queryId)
        query = scopeQuery(query)
        const { data, error } = await query.single()
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 404 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'GET') {
        let query = supabaseAdmin.from('queries').select('*')
        query = scopeQuery(query)
        const { data, error } = await query.order('created_at', { ascending: false })
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
        
        // Convert snake_case to camelCase for frontend
        const camelData = data ? data.map(convertToCamel) : []
        return handleCORS(NextResponse.json(camelData))
      }
      
      if (method === 'POST') {
        const body = await request.json()
        console.log('[API] Creating query with body:', JSON.stringify(body, null, 2))
        const snakeData = convertToSnake(body)
        console.log('[API] Converted to snake_case:', JSON.stringify(snakeData, null, 2))
        
        // Generate short sequential query ID like QRY-001
        // Find max existing QRY number to avoid duplicates
        const { data: existingQueries } = await supabaseAdmin
          .from('queries')
          .select('query_id')
          .like('query_id', 'QRY-%')
          .order('query_id', { ascending: false })
          .limit(1)
        
        let nextNum = 1
        if (existingQueries && existingQueries.length > 0) {
          const maxId = existingQueries[0].query_id
          const numPart = parseInt(maxId.replace('QRY-', ''), 10)
          if (!isNaN(numPart)) {
            nextNum = numPart + 1
          }
        }
        snakeData.query_id = `QRY-${String(nextNum).padStart(3, '0')}`
        snakeData.created_by = currentUser?.id
        stampOrg(snakeData)
        
        // CRITICAL FIX: Sanitize UUID fields - PostgreSQL rejects empty strings for UUID type
        // Must convert empty strings to null for all UUID columns
        const uuidFields = ['created_by', 'organization_id', 'assigned_to', 'tour_package']
        uuidFields.forEach(field => {
          if (snakeData[field] === '' || snakeData[field] === undefined || snakeData[field] === 'none') {
            snakeData[field] = null
          }
        })
        
        // Also sanitize date fields - empty strings cause issues
        const dateFields = ['travel_date', 'next_follow_up']
        dateFields.forEach(field => {
          if (snakeData[field] === '' || snakeData[field] === undefined) {
            snakeData[field] = null
          }
        })
        
        console.log('[API] Final data to insert (after sanitization):', JSON.stringify(snakeData, null, 2))
        
        const { data, error } = await supabaseAdmin
          .from('queries')
          .insert(snakeData)
          .select()
          .single()
        
        if (error) {
          console.error('[API] Supabase insert error:', error)
          return handleCORS(NextResponse.json({ error: error.message, details: error }, { status: 400 }))
        }
        console.log('[API] Query created successfully:', data.query_id)
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'PUT' && queryId) {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        
        const { data, error } = await supabaseAdmin
          .from('queries')
          .update({ ...snakeData, updated_at: new Date().toISOString() })
          .eq('id', queryId)
          .select()
          .single()
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'DELETE' && queryId) {
        const { error } = await supabaseAdmin.from('queries').delete().eq('id', queryId)
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // ===== PACKAGES ROUTES =====
    if (route.startsWith('/packages')) {
      const packageId = path[1]
      
      if (method === 'GET' && packageId) {
        let query = supabaseAdmin.from('packages').select('*').eq('id', packageId)
        query = scopeQuery(query)
        const { data, error } = await query.single()
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 404 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'GET') {
        let query = supabaseAdmin.from('packages').select('*')
        query = scopeQuery(query)
        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
        
        // Convert snake_case to camelCase for frontend
        const camelData = data ? data.map(convertToCamel) : []
        return handleCORS(NextResponse.json(camelData))
      }
      
      if (method === 'POST') {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        stampOrg(snakeData)
        
        const { data, error } = await supabaseAdmin.from('packages').insert(snakeData).select().single()
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'PUT' && packageId) {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        
        const { data, error } = await supabaseAdmin
          .from('packages')
          .update({ ...snakeData, updated_at: new Date().toISOString() })
          .eq('id', packageId)
          .select()
          .single()
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'DELETE' && packageId) {
        const { error } = await supabaseAdmin.from('packages').delete().eq('id', packageId)
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // ===== HOTELS ROUTES =====
    if (route.startsWith('/hotels')) {
      const hotelId = path[1]
      
      if (method === 'GET' && hotelId) {
        let query = supabaseAdmin.from('hotels').select('*').eq('id', hotelId)
        query = scopeQuery(query)
        const { data, error } = await query.single()
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 404 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'GET') {
        let query = supabaseAdmin.from('hotels').select('*')
        query = scopeQuery(query)
        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
        
        // Convert snake_case to camelCase for frontend
        const camelData = data ? data.map(convertToCamel) : []
        return handleCORS(NextResponse.json(camelData))
      }
      
      if (method === 'POST') {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        stampOrg(snakeData)
        
        const { data, error } = await supabaseAdmin.from('hotels').insert(snakeData).select().single()
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'PUT' && hotelId) {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        
        const { data, error } = await supabaseAdmin
          .from('hotels')
          .update({ ...snakeData, updated_at: new Date().toISOString() })
          .eq('id', hotelId)
          .select()
          .single()
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'DELETE' && hotelId) {
        const { error } = await supabaseAdmin.from('hotels').delete().eq('id', hotelId)
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // ===== ACTIVITIES ROUTES =====
    if (route.startsWith('/activities')) {
      const activityId = path[1]
      
      if (method === 'GET' && activityId) {
        let query = supabaseAdmin.from('activities').select('*').eq('id', activityId)
        query = scopeQuery(query)
        const { data, error } = await query.single()
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 404 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'GET') {
        let query = supabaseAdmin.from('activities').select('*')
        query = scopeQuery(query)
        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
        
        // Convert snake_case to camelCase for frontend
        const camelData = data ? data.map(convertToCamel) : []
        return handleCORS(NextResponse.json(camelData))
      }
      
      if (method === 'POST') {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        stampOrg(snakeData)
        
        const { data, error } = await supabaseAdmin.from('activities').insert(snakeData).select().single()
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'PUT' && activityId) {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        
        const { data, error } = await supabaseAdmin
          .from('activities')
          .update({ ...snakeData, updated_at: new Date().toISOString() })
          .eq('id', activityId)
          .select()
          .single()
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'DELETE' && activityId) {
        const { error } = await supabaseAdmin.from('activities').delete().eq('id', activityId)
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // ===== ROUTES (TOURS) ROUTES =====
    if (route.startsWith('/routes')) {
      const routeId = path[1]
      
      if (method === 'GET' && routeId) {
        let query = supabaseAdmin.from('routes').select('*').eq('id', routeId)
        query = scopeQuery(query)
        const { data, error } = await query.single()
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 404 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'GET') {
        let query = supabaseAdmin.from('routes').select('*')
        query = scopeQuery(query)
        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
        
        // Convert snake_case to camelCase for frontend
        const camelData = data ? data.map(convertToCamel) : []
        return handleCORS(NextResponse.json(camelData))
      }
      
      if (method === 'POST') {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        stampOrg(snakeData)
        
        const { data, error } = await supabaseAdmin.from('routes').insert(snakeData).select().single()
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'PUT' && routeId) {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        
        const { data, error } = await supabaseAdmin
          .from('routes')
          .update({ ...snakeData, updated_at: new Date().toISOString() })
          .eq('id', routeId)
          .select()
          .single()
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'DELETE' && routeId) {
        const { error } = await supabaseAdmin.from('routes').delete().eq('id', routeId)
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // ===== TRANSPORTS ROUTES =====
    if (route.startsWith('/transports')) {
      const transportId = path[1]
      
      if (method === 'GET' && transportId) {
        let query = supabaseAdmin.from('transports').select('*').eq('id', transportId)
        query = scopeQuery(query)
        const { data, error } = await query.single()
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 404 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'GET') {
        let query = supabaseAdmin.from('transports').select('*')
        query = scopeQuery(query)
        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
        
        const camelData = data ? data.map(convertToCamel) : []
        return handleCORS(NextResponse.json(camelData))
      }
      
      if (method === 'POST') {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        stampOrg(snakeData)
        
        const { data, error } = await supabaseAdmin.from('transports').insert(snakeData).select().single()
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'PUT' && transportId) {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        
        const { data, error } = await supabaseAdmin
          .from('transports')
          .update({ ...snakeData, updated_at: new Date().toISOString() })
          .eq('id', transportId)
          .select()
          .single()
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'DELETE' && transportId) {
        const { error } = await supabaseAdmin.from('transports').delete().eq('id', transportId)
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // ===== DASHBOARD STATS =====
    if (route === '/dashboard/stats' && method === 'GET') {
      // Get all queries to calculate various stats
      let queriesQuery = supabaseAdmin.from('queries').select('*')
      queriesQuery = scopeQuery(queriesQuery)
      const { data: queries } = await queriesQuery
      
      // Get packages and hotels count
      let qP = supabaseAdmin.from('packages').select('*', { count: 'exact', head: true })
      let qH = supabaseAdmin.from('hotels').select('*', { count: 'exact', head: true })
      qP = scopeQuery(qP)
      qH = scopeQuery(qH)
      const [{ count: packagesCount }, { count: hotelsCount }] = await Promise.all([qP, qH])
      
      // Calculate stats from queries
      const totalQueries = queries?.length || 0
      const newQueries = queries?.filter(q => q.status === 'new').length || 0
      const ongoingQueries = queries?.filter(q => q.status === 'ongoing').length || 0
      const confirmedQueries = queries?.filter(q => q.status === 'confirmed').length || 0
      const cancelledQueries = queries?.filter(q => q.status === 'cancelled').length || 0
      
      // Calculate total revenue from confirmed queries
      const totalRevenue = queries?.reduce((sum, q) => {
        if (q.status === 'confirmed' && q.budget) {
          return sum + parseFloat(q.budget)
        }
        return sum
      }, 0) || 0
      
      // Get pending follow-ups
      const today = new Date().toISOString().split('T')[0]
      const pendingFollowUps = queries?.filter(q => q.follow_up_date && q.follow_up_date <= today).length || 0
      
      // Conversion rate
      const conversionRate = totalQueries > 0 ? Math.round((confirmedQueries / totalQueries) * 100) : 0
      
      return handleCORS(NextResponse.json({
        totalQueries,
        newQueries,
        ongoingQueries,
        confirmedQueries,
        cancelledQueries,
        totalRevenue,
        pendingFollowUps,
        conversionRate,
        packagesCount: packagesCount || 0,
        hotelsCount: hotelsCount || 0,
        totalPackages: packagesCount || 0,
        totalHotels: hotelsCount || 0,
      }))
    }

    // ===== USERS ROUTES =====
    if (route.startsWith('/users')) {
      const userId = path[1]
      
      if (method === 'GET' && userId) {
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 404 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'GET') {
        let query = supabaseAdmin.from('users').select('*')
        // Org admins see only users in their org
        if (!isSuperAdmin && userOrgId) {
          query = query.eq('organization_id', userOrgId)
        }
        const { data, error} = await query.order('created_at', { ascending: false })
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
        const camelData = data ? data.map(convertToCamel) : []
        return handleCORS(NextResponse.json(camelData))
      }
      
      if (method === 'POST') {
        const body = await request.json()
        const { email, password, name, roles, phone, designation, organizationId, isOrgAdmin } = body
        
        // Validate roles array
        const userRoles = Array.isArray(roles) && roles.length > 0 ? roles : ['sales']
        const isSuperAdmin = userRoles.includes('super_admin')
        
        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name,
            roles: userRoles,
            email_verified: true
          }
        })
        
        if (authError) {
          console.error('Auth user creation error:', authError)
          return handleCORS(NextResponse.json({ error: authError.message }, { status: 400 }))
        }
        
        // Insert user profile in users table
        const userProfile = {
          id: authData.user.id,
          email,
          name,
          roles: userRoles,
          phone: phone || null,
          designation: designation || null,
          organization_id: organizationId || userOrgId || null,
          is_super_admin: isSuperAdmin,
          is_org_admin: isOrgAdmin || false,
          is_active: true
        }
        
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('users')
          .insert(userProfile)
          .select()
          .single()
        
        if (profileError) {
          console.error('User profile creation error:', profileError)
          // Try to delete the auth user if profile creation failed
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
          return handleCORS(NextResponse.json({ error: profileError.message }, { status: 400 }))
        }
        
        return handleCORS(NextResponse.json(convertToCamel(profileData)))
      }
      
      if (method === 'PUT' && userId) {
        const body = await request.json()
        console.log('Update user request:', { userId, body })
        
        // Build update object without automatic conversion for specific fields
        const updateData = {
          updated_at: new Date().toISOString()
        }
        
        // Handle roles - keep as is (already an array)
        if (body.roles !== undefined) {
          updateData.roles = Array.isArray(body.roles) ? body.roles : [body.roles]
        }
        
        // Handle other fields with snake_case conversion
        if (body.name !== undefined) updateData.name = body.name
        if (body.phone !== undefined) updateData.phone = body.phone
        if (body.designation !== undefined) updateData.designation = body.designation
        if (body.isOrgAdmin !== undefined) updateData.is_org_admin = body.isOrgAdmin
        
        // Check if user is super admin
        if (updateData.roles && updateData.roles.includes('super_admin')) {
          updateData.is_super_admin = true
        }
        
        console.log('Update data to Supabase:', updateData)
        
        // Update user profile
        const { data, error } = await supabaseAdmin
          .from('users')
          .update(updateData)
          .eq('id', userId)
          .select()
          .single()
        
        if (error) {
          console.error('Update error:', error)
          return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        }
        
        console.log('Updated user data:', data)
        
        // If roles changed, update user metadata in Auth
        if (body.roles) {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: { roles: body.roles }
          })
        }
        
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'DELETE' && userId) {
        // Delete from users table
        const { error: profileError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', userId)
        
        if (profileError) {
          return handleCORS(NextResponse.json({ error: profileError.message }, { status: 400 }))
        }
        
        // Delete from Auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        
        if (authError) {
          console.error('Auth user deletion error:', authError)
          // Profile is already deleted, so we'll return success
        }
        
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // ===== ORGANIZATION ROUTES =====
    if (route === '/organization') {
      if (method === 'GET') {
        // Get organization settings scoped to user's org
        let query = supabaseAdmin.from('organizations').select('*')
        
        if (isSuperAdmin) {
          // Super admin gets the default org
          query = query.eq('is_default', true)
        } else if (userOrgId) {
          // Org users get their own org
          query = query.eq('id', userOrgId)
        } else {
          // Fallback: default org
          query = query.eq('is_default', true)
        }
        
        const { data, error } = await query.limit(1).single()
        
        if (error) {
          console.log('No organization found, returning defaults')
          return handleCORS(NextResponse.json({
            name: '',
            email: '',
            phone: '',
            website: '',
            address: '',
            aboutUs: '',
            gst: '',
            pan: '',
            termsAndConditions: '',
            consultantName: '',
            primaryColor: '#2563eb',
            pdfTabColor: '#2563eb',
            pdfFontColor: '#ffffff'
          }))
        }
        
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'PUT') {
        const body = await request.json()
        console.log('Updating organization:', body)
        
        // Convert to snake_case for database
        const updateData = {
          name: body.name,
          email: body.email,
          phone: body.phone,
          website: body.website,
          address: body.address,
          about_us: body.aboutUs,
          logo: body.logo,
          header_image: body.headerImage,
          footer_image: body.footerImage,
          gst: body.gst,
          pan: body.pan,
          terms_and_conditions: body.termsAndConditions,
          consultant_name: body.consultantName,
          primary_color: body.primaryColor,
          pdf_tab_color: body.pdfTabColor,
          pdf_font_color: body.pdfFontColor,
          updated_at: new Date().toISOString()
        }
        
        // Find the correct org to update
        let orgId
        if (isSuperAdmin) {
          const { data: existing } = await supabaseAdmin.from('organizations').select('id').eq('is_default', true).limit(1).single()
          orgId = existing?.id
        } else if (userOrgId) {
          orgId = userOrgId
        }
        
        if (!orgId) {
          // Fallback: get first org
          const { data: existing } = await supabaseAdmin.from('organizations').select('id').limit(1).single()
          orgId = existing?.id
        }
        
        let result
        if (orgId) {
          const { data, error } = await supabaseAdmin
            .from('organizations')
            .update(updateData)
            .eq('id', orgId)
            .select()
            .single()
          
          if (error) {
            console.error('Organization update error:', error)
            return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
          }
          result = data
        } else {
          // Create new
          const { data, error } = await supabaseAdmin
            .from('organizations')
            .insert(updateData)
            .select()
            .single()
          
          if (error) {
            console.error('Organization create error:', error)
            return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
          }
          result = data
        }
        
        // Also sync name to tenant_organizations if applicable
        if (userOrgId) {
          await supabaseAdmin.from('tenant_organizations').update({ name: body.name, updated_at: new Date().toISOString() }).eq('id', userOrgId)
        }
        
        return handleCORS(NextResponse.json(convertToCamel(result)))
      }
    }

    // ===== ITINERARIES ROUTES (return empty for now) =====
    // ===== ITINERARIES BY QUERY =====
    if (route.startsWith('/itineraries/query/')) {
      // Get itineraries for specific query
      // URL: /api/itineraries/query/{queryId}
      // path[0] = 'itineraries', path[1] = 'query', path[2] = queryId
      const queryId = path[2]
      console.log('Fetching itineraries for query:', queryId)
      if (queryId) {
        let query = supabaseAdmin
          .from('itineraries')
          .select('*')
          .eq('query_id', queryId)
        query = scopeQuery(query)
        const { data, error } = await query.order('created_at', { ascending: false })
        
        if (error) {
          console.error('Error fetching itineraries for query:', error)
          return handleCORS(NextResponse.json([]))
        }
        console.log(`Found ${data?.length || 0} itineraries for query ${queryId}`)
        if (data && data.length > 0) {
          console.log('First itinerary costs:', data[0].costs)
        }
        const camelData = data ? data.map(convertToCamel) : []
        if (camelData.length > 0) {
          console.log('First itinerary after camelCase:', camelData[0].costs)
        }
        return handleCORS(NextResponse.json(camelData))
      }
      return handleCORS(NextResponse.json([]))
    }

    // ===== ITINERARIES CRUD =====
    if (route.startsWith('/itineraries')) {
      const itineraryId = path[1]
      
      if (method === 'GET' && itineraryId) {
        let query = supabaseAdmin.from('itineraries').select('*').eq('id', itineraryId)
        query = scopeQuery(query)
        const { data, error } = await query.single()
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 404 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'GET') {
        let query = supabaseAdmin.from('itineraries').select('*')
        query = scopeQuery(query)
        const { data, error } = await query.order('created_at', { ascending: false })
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
        const camelData = data ? data.map(convertToCamel) : []
        return handleCORS(NextResponse.json(camelData))
      }
      
      if (method === 'POST') {
        const body = await request.json()
        const snakeData = convertToSnake(body)
        
        // Store complex objects as JSONB
        snakeData.hotel_selections = snakeData.hotel_selections || []
        snakeData.transport_selections = snakeData.transport_selections || []
        snakeData.day_plans = snakeData.day_plans || []
        snakeData.extra_services = snakeData.extra_services || []
        snakeData.costs = snakeData.costs || {}
        stampOrg(snakeData)

        // Stamp quote creator on first save (used in PDF "Your Travel Consultant")
        if (!snakeData.created_by && currentUser?.id) {
          snakeData.created_by = currentUser.id
        }
        
        // Generate sequential quote number based on query_id
        // Format: {query_number}-{sequence} e.g., QRY-001-01, QRY-001-02
        if (snakeData.query_id) {
          // First get the query number for this query
          const { data: queryData } = await supabaseAdmin
            .from('queries')
            .select('query_id')
            .eq('id', snakeData.query_id)
            .single()
          
          const queryNumber = queryData?.query_id || `QRY-${snakeData.query_id.substring(0, 3)}`
          
          // Find the highest existing quote number for this query
          const { data: existingQuotes } = await supabaseAdmin
            .from('itineraries')
            .select('quote_number')
            .eq('query_id', snakeData.query_id)
            .order('created_at', { ascending: false })
          
          let nextSeq = 1
          if (existingQuotes && existingQuotes.length > 0) {
            // Parse existing quote numbers to find the max sequence
            for (const quote of existingQuotes) {
              if (quote.quote_number) {
                // Extract the sequence number from the end (e.g., "QRY-001-03" -> 3)
                const match = quote.quote_number.match(/-(\d+)$/)
                if (match) {
                  const seqNum = parseInt(match[1], 10)
                  if (!isNaN(seqNum) && seqNum >= nextSeq) {
                    nextSeq = seqNum + 1
                  }
                }
              }
            }
          }
          
          // Set the sequential quote number
          snakeData.quote_number = `${queryNumber}-${String(nextSeq).padStart(2, '0')}`
          console.log(`Generated sequential quote number: ${snakeData.quote_number} for query ${snakeData.query_id}`)
        }
        
        // Keep only last 7 quotes per query - delete oldest if >= 7
        if (snakeData.query_id) {
          const { data: existingQuotes } = await supabaseAdmin
            .from('itineraries')
            .select('id, created_at')
            .eq('query_id', snakeData.query_id)
            .order('created_at', { ascending: false })
          
          if (existingQuotes && existingQuotes.length >= 7) {
            // Delete oldest quotes to keep only 6 (so new one makes 7)
            const quotesToDelete = existingQuotes.slice(6)
            const idsToDelete = quotesToDelete.map(q => q.id)
            
            console.log(`Deleting ${idsToDelete.length} old quotes to maintain limit of 7`)
            
            const { error: deleteError } = await supabaseAdmin
              .from('itineraries')
              .delete()
              .in('id', idsToDelete)
            
            if (deleteError) {
              console.error('Error deleting old quotes:', deleteError)
            } else {
              console.log(`Successfully deleted ${idsToDelete.length} old quotes`)
            }
          }
        }
        
        const { data, error } = await supabaseAdmin
          .from('itineraries')
          .insert(snakeData)
          .select()
          .single()
        
        if (error) {
          console.error('Itinerary insert error:', error)
          return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        }
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'PUT' && itineraryId) {
        const body = await request.json()
        const snakeData = convertToSnake(body)

        // Prevent changing quote creator via update
        if ('created_by' in snakeData) delete snakeData.created_by
        
        // CRITICAL: If status is being set to 'confirmed', un-confirm ALL other quotes for this query first
        if (snakeData.status === 'confirmed') {
          // First, get the query_id for this itinerary
          const { data: currentItinerary, error: fetchError } = await supabaseAdmin
            .from('itineraries')
            .select('query_id')
            .eq('id', itineraryId)
            .single()
          
          if (fetchError) {
            console.error('Error fetching itinerary for confirmation:', fetchError)
            return handleCORS(NextResponse.json({ error: fetchError.message }, { status: 400 }))
          }
          
          if (currentItinerary?.query_id) {
            // Set ALL other quotes for this query to 'draft' (bulk update, no .single())
            const { error: bulkUpdateError } = await supabaseAdmin
              .from('itineraries')
              .update({ status: 'draft', updated_at: new Date().toISOString() })
              .eq('query_id', currentItinerary.query_id)
              .neq('id', itineraryId)
            
            if (bulkUpdateError) {
              console.error('Error un-confirming other quotes:', bulkUpdateError)
              // Continue anyway - we still want to confirm the target quote
            } else {
              console.log(`Un-confirmed all other quotes for query ${currentItinerary.query_id}`)
            }
          }
        }
        
        // Now update the target itinerary
        const { data, error } = await supabaseAdmin
          .from('itineraries')
          .update({ ...snakeData, updated_at: new Date().toISOString() })
          .eq('id', itineraryId)
          .select()
          .single()
        
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json(convertToCamel(data)))
      }
      
      if (method === 'DELETE' && itineraryId) {
        const { error } = await supabaseAdmin.from('itineraries').delete().eq('id', itineraryId)
        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
        return handleCORS(NextResponse.json({ success: true }))
      }
    }

    // ===== ORGANIZATION REGISTRATION =====
    if (route === '/organizations/register' && method === 'POST') {
      const body = await request.json()
      const { organizationName, adminName, adminEmail, adminPassword, phone, address, website } = body

      if (!organizationName || !adminName || !adminEmail || !adminPassword) {
        return handleCORS(NextResponse.json({ error: 'Organization name, admin name, email and password are required' }, { status: 400 }))
      }

      // Check if email already exists in auth
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const emailExists = existingUsers?.users?.some(u => u.email === adminEmail)
      if (emailExists) {
        return handleCORS(NextResponse.json({ error: 'Email already registered' }, { status: 400 }))
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { name: adminName, roles: ['org_admin'] }
      })

      if (authError) {
        console.error('Auth creation error:', authError)
        return handleCORS(NextResponse.json({ error: authError.message }, { status: 400 }))
      }

      // Create tenant organization
      const { data: orgData, error: orgError } = await supabaseAdmin
        .from('tenant_organizations')
        .insert({
          name: organizationName,
          admin_name: adminName,
          admin_email: adminEmail,
          admin_user_id: authData.user.id,
          phone: phone || null,
          address: address || null,
          website: website || null,
          status: 'pending'
        })
        .select()
        .single()

      if (orgError) {
        console.error('Org creation error:', orgError)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return handleCORS(NextResponse.json({ error: orgError.message }, { status: 400 }))
      }

      // Also create a row in organizations table with same ID (for FK references)
      await supabaseAdmin
        .from('organizations')
        .insert({
          id: orgData.id,
          name: organizationName,
          email: adminEmail,
          phone: phone || null,
          address: address || null,
          website: website || null
        })

      // Create user profile linked to this org
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: adminEmail,
          name: adminName,
          role: 'org_admin',
          roles: ['org_admin'],
          is_org_admin: true,
          is_active: true,
          organization_id: orgData.id
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        await supabaseAdmin.from('tenant_organizations').delete().eq('id', orgData.id)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return handleCORS(NextResponse.json({ error: profileError.message }, { status: 400 }))
      }

      return handleCORS(NextResponse.json({ success: true, organization: convertToCamel(orgData) }))
    }

    // ===== TENANT ORGANIZATIONS MANAGEMENT (Super Admin) =====
    if (route.startsWith('/tenant-organizations')) {
      const orgId = path[1]
      const action = path[2] // approve, reject, suspend

      // GET all tenant organizations - always fresh data
      if (method === 'GET' && !orgId) {
        const { data, error } = await supabaseAdmin
          .from('tenant_organizations')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
        const camelData = data ? data.map(convertToCamel) : []
        
        // Return with no-cache headers
        const response = NextResponse.json(camelData)
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        return handleCORS(response)
      }

      // POST actions: approve, reject, suspend
      if (method === 'POST' && orgId && action) {
        const validActions = ['approve', 'reject', 'suspend']
        if (!validActions.includes(action)) {
          return handleCORS(NextResponse.json({ error: 'Invalid action' }, { status: 400 }))
        }

        const statusMap = { approve: 'approved', reject: 'rejected', suspend: 'suspended' }
        const newStatus = statusMap[action]

        // First update the status
        const { error: updateError } = await supabaseAdmin
          .from('tenant_organizations')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', orgId)

        if (updateError) {
          console.error('Update error:', updateError)
          return handleCORS(NextResponse.json({ error: updateError.message }, { status: 400 }))
        }

        // Then fetch the updated record
        const { data, error: fetchError } = await supabaseAdmin
          .from('tenant_organizations')
          .select('*')
          .eq('id', orgId)
          .single()

        if (fetchError || !data) {
          console.error('Fetch error:', fetchError)
          return handleCORS(NextResponse.json({ error: 'Organization not found after update' }, { status: 404 }))
        }

        // If suspending or rejecting, also deactivate the admin user
        if (newStatus === 'suspended' || newStatus === 'rejected') {
          if (data.admin_user_id) {
            await supabaseAdmin.from('users').update({ is_active: false }).eq('id', data.admin_user_id)
          }
        }

        // If approving, reactivate the admin user
        if (newStatus === 'approved') {
          if (data.admin_user_id) {
            await supabaseAdmin.from('users').update({ is_active: true }).eq('id', data.admin_user_id)
          }
        }

        return handleCORS(NextResponse.json(convertToCamel(data)))
      }

      // DELETE tenant organization
      if (method === 'DELETE' && orgId) {
        // Get org to find admin user
        const { data: orgData } = await supabaseAdmin
          .from('tenant_organizations')
          .select('*')
          .eq('id', orgId)
          .single()

        if (orgData) {
          // Delete all users belonging to this org
          const { data: orgUsers } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('organization_id', orgId)

          if (orgUsers && orgUsers.length > 0) {
            for (const user of orgUsers) {
              await supabaseAdmin.from('users').delete().eq('id', user.id)
              try {
                await supabaseAdmin.auth.admin.deleteUser(user.id)
              } catch (e) {
                console.log('Could not delete auth user:', e.message)
              }
            }
          }

          // Delete the org
          const { error } = await supabaseAdmin.from('tenant_organizations').delete().eq('id', orgId)
          if (error) {
            console.error('Delete error:', error)
            return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
          }
        }

        return handleCORS(NextResponse.json({ success: true, deleted: orgId }))
      }
    }

    // Route not found
    return handleCORS(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
    
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 }))
  }
}

// Export handlers
export async function GET(request, context) {
  return handleRoute(request, context)
}

export async function POST(request, context) {
  return handleRoute(request, context)
}

export async function PUT(request, context) {
  return handleRoute(request, context)
}

export async function DELETE(request, context) {
  return handleRoute(request, context)
}
