import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Supabase admin client not configured' },
        { status: 500 }
      )
    }

    // Create super admin user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'newadmin@travelcrm.com',
      password: 'TravelCRM2025!',
      email_confirm: true,
      user_metadata: {
        name: 'Super Admin',
        role: 'super_admin'
      }
    })

    if (authError && !authError.message.includes('already exists')) {
      throw authError
    }

    const userId = authData?.user?.id

    // Check if user profile exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', 'newadmin@travelcrm.com')
      .single()

    if (!existingUser && userId) {
      // Create user profile
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email: 'newadmin@travelcrm.com',
          name: 'Super Admin',
          role: 'super_admin',
          is_super_admin: true,
          is_active: true
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
      }
    }

    // Create default organization
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('is_default', true)
      .single()

    if (!existingOrg) {
      await supabaseAdmin
        .from('organizations')
        .insert({
          name: 'Default Organization',
          is_default: true,
          is_approved: true,
          is_active: true
        })
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase initialized successfully'
    })
  } catch (error) {
    console.error('Initialization error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to initialize Supabase' },
      { status: 500 }
    )
  }
}
