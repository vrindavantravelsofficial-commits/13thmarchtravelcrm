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

    console.log('Starting database setup...')

    // Create tables using SQL
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'agent',
        is_super_admin BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        organization_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      // Organizations table
      `CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        website TEXT,
        is_approved BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      // Queries table
      `CREATE TABLE IF NOT EXISTS queries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query_id TEXT UNIQUE,
        customer_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        destination TEXT,
        start_date DATE,
        end_date DATE,
        pax INTEGER DEFAULT 1,
        adults INTEGER DEFAULT 1,
        children INTEGER DEFAULT 0,
        status TEXT DEFAULT 'new',
        source TEXT DEFAULT 'direct',
        budget NUMERIC,
        notes TEXT,
        follow_up_date DATE,
        assigned_to UUID,
        organization_id UUID,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      // Packages table
      `CREATE TABLE IF NOT EXISTS packages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        destination TEXT NOT NULL,
        duration INTEGER NOT NULL,
        price NUMERIC NOT NULL,
        description TEXT,
        inclusions TEXT[],
        exclusions TEXT[],
        is_active BOOLEAN DEFAULT TRUE,
        organization_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      // Hotels table
      `CREATE TABLE IF NOT EXISTS hotels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        category TEXT,
        price_per_night NUMERIC,
        amenities TEXT[],
        contact_phone TEXT,
        contact_email TEXT,
        address TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        organization_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      // Routes table
      `CREATE TABLE IF NOT EXISTS routes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        from_location TEXT NOT NULL,
        to_location TEXT NOT NULL,
        distance INTEGER,
        duration TEXT,
        description TEXT,
        organization_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      // Activities table
      `CREATE TABLE IF NOT EXISTS activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        category TEXT,
        duration TEXT,
        price NUMERIC,
        description TEXT,
        organization_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      // Transports table
      `CREATE TABLE IF NOT EXISTS transports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        capacity INTEGER,
        price_per_day NUMERIC,
        contact_phone TEXT,
        contact_email TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        organization_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      // Itineraries table
      `CREATE TABLE IF NOT EXISTS itineraries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query_id UUID,
        title TEXT NOT NULL,
        days JSONB,
        total_cost NUMERIC,
        status TEXT DEFAULT 'draft',
        organization_id UUID,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      // Payments table
      `CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query_id UUID,
        amount NUMERIC NOT NULL,
        type TEXT NOT NULL,
        method TEXT,
        reference_number TEXT,
        date DATE,
        notes TEXT,
        organization_id UUID,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      // Lead Sources table
      `CREATE TABLE IF NOT EXISTS lead_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        organization_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`,
      
      // Follow-ups table
      `CREATE TABLE IF NOT EXISTS follow_ups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query_id UUID,
        notes TEXT NOT NULL,
        follow_up_date DATE,
        status TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`,
    ]

    // Skip table creation - tables should be created manually in Supabase dashboard
    // The tables are defined in /app/frontend/supabase_schema.sql
    console.log('Skipping table creation (tables should exist), creating admin user...')

    // Create super admin auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'newadmin@travelcrm.com',
      password: 'TravelCRM2025!',
      email_confirm: true,
      user_metadata: {
        name: 'Super Admin',
        role: 'super_admin'
      }
    })

    if (authError && !authError.message.includes('already registered')) {
      console.error('Auth user creation error:', authError)
      throw authError
    }

    const userId = authData?.user?.id

    // Check if user profile exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
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
        throw profileError
      }
      console.log('Super admin profile created')
    }

    // Create default organization
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
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
        console.error('Organization creation error:', orgError)
      } else {
        console.log('Default organization created')
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database setup completed successfully',
      userId: userId
    })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to setup database',
        details: error.toString()
      },
      { status: 500 }
    )
  }
}
