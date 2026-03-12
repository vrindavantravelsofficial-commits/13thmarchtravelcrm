// Initialize Supabase Database with default data
import { supabaseAdmin } from './supabase.js'

export async function initializeSupabase() {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not available')
    return
  }

  try {
    // Check if super admin user exists in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', 'newadmin@travelcrm.com')
      .single()

    if (!existingUser) {
      console.log('Creating default super admin user...')
      
      // Create auth user first
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: 'newadmin@travelcrm.com',
        password: 'TravelCRM2025!',
        email_confirm: true,
        user_metadata: {
          name: 'Super Admin',
          role: 'super_admin'
        }
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        return
      }

      // Create user profile
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: 'newadmin@travelcrm.com',
          name: 'Super Admin',
          role: 'super_admin',
          is_super_admin: true,
          is_active: true
        })

      if (profileError) {
        console.error('Error creating user profile:', profileError)
      } else {
        console.log('Super admin user created successfully')
      }
    } else {
      console.log('Super admin user already exists')
    }

    // Create default organization if needed
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('is_default', true)
      .single()

    if (!existingOrg) {
      const { error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: 'Default Organization',
          is_default: true,
          is_approved: true,
          is_active: true
        })

      if (orgError) {
        console.error('Error creating default organization:', orgError)
      } else {
        console.log('Default organization created')
      }
    }

  } catch (error) {
    console.error('Error initializing Supabase:', error)
  }
}

export default initializeSupabase
