import { NextResponse } from 'next/server'
import supabase, { supabaseAdmin } from '@/lib/supabase'

// Disable caching for auth routes
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper function to handle CORS
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Organization-Id')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { email, password } = body
    
    if (!email || !password) {
      return handleCORS(NextResponse.json({ error: 'Email and password required' }, { status: 400 }))
    }
    
    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError || !authData.user) {
      return handleCORS(NextResponse.json({ error: 'Invalid credentials' }, { status: 401 }))
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !userProfile) {
      return handleCORS(NextResponse.json({ error: 'User profile not found' }, { status: 401 }))
    }

    // Check if user is active
    if (!userProfile.is_active) {
      return handleCORS(NextResponse.json({ error: 'Account is inactive' }, { status: 401 }))
    }

    // Check organization status (skip for super admin)
    if (userProfile.organization_id && !userProfile.is_super_admin) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', userProfile.organization_id)
        .single()

      if (!org) {
        return handleCORS(NextResponse.json({ error: 'Organization not found' }, { status: 401 }))
      }

      if (!org.is_approved) {
        return handleCORS(NextResponse.json({ 
          error: 'Your organization registration is pending approval.'
        }, { status: 403 }))
      }
    }

    // Return user data and token
    const user = {
      id: userProfile.id,
      email: userProfile.email,
      name: userProfile.name,
      role: userProfile.role,
      isSuperAdmin: userProfile.is_super_admin,
      isActive: userProfile.is_active,
      organizationId: userProfile.organization_id,
      createdAt: userProfile.created_at,
      updatedAt: userProfile.updated_at
    }

    return handleCORS(NextResponse.json({ 
      user, 
      token: authData.session.access_token,
      session: authData.session
    }))
  } catch (error) {
    console.error('Login error:', error)
    return handleCORS(NextResponse.json({ error: 'Server error' }, { status: 500 }))
  }
}
