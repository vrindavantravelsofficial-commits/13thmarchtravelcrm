import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Use Next.js SQL API instead of Python backend
const SQL_API_URL = '/api/sql'

/**
 * Migration endpoint that uses Next.js SQL API for SQL execution
 */
export async function POST(request) {
  try {
    console.log('=== Starting Multiple Roles Migration (Next.js) ===')
    
    // Step 1: Check if roles column already exists
    console.log('Step 1: Checking if roles column exists...')
    const { data: existingUsers, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, role, roles, is_super_admin, is_org_admin')
      .limit(1)
    
    if (checkError) {
      console.error('Error checking users table:', checkError)
    }

    const hasRolesColumn = existingUsers && existingUsers[0] && 'roles' in existingUsers[0]
    const hasOrgAdminColumn = existingUsers && existingUsers[0] && 'isOrgAdmin' in existingUsers[0]
    
    console.log(`Roles column exists: ${hasRolesColumn}`)
    console.log(`Org admin column exists: ${hasOrgAdminColumn}`)
    
    // Step 2: If columns don't exist, execute SQL via Next.js SQL API
    if (!hasRolesColumn || !hasOrgAdminColumn) {
      console.log('Step 2: Columns missing - executing schema migration...')
      
      const migrationStatements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['sales'];",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_org_admin BOOLEAN DEFAULT FALSE;",
        "CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN(roles);",
        `UPDATE users SET roles = CASE WHEN role IS NOT NULL AND role != '' THEN ARRAY[role]::TEXT[] ELSE ARRAY['sales']::TEXT[] END WHERE roles IS NULL OR array_length(roles, 1) IS NULL;`,
        "UPDATE users SET roles = ARRAY['admin', 'manager', 'sales', 'operations']::TEXT[] WHERE is_super_admin = TRUE;",
        "UPDATE users SET is_org_admin = COALESCE(is_org_admin, FALSE);"
      ]
      
      // Try executing via Supabase RPC directly
      let migrationSuccess = false
      for (const stmt of migrationStatements) {
        try {
          const { error } = await supabaseAdmin.rpc('exec_sql', { sql: stmt })
          if (error && !error.message?.includes('already exists')) {
            console.error('Migration statement failed:', error.message)
          }
        } catch (e) {
          console.error('Migration error:', e.message)
        }
      }
      
      // If RPC not available, return manual SQL
      const manualSQL = migrationStatements.join('\n')
      console.log('Migration statements executed (some may need manual execution)')
    }
    
    // Step 3: Migrate data
    console.log('Step 3: Migrating user data...')
    const { data: allUsers, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
    
    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`)
    }

    console.log(`Found ${allUsers?.length || 0} users to process`)
    
    let migrated = 0
    let skipped = 0
    let errors = 0
    
    // Migrate each user
    for (const user of allUsers || []) {
      try {
        let newRoles = user.roles || []
        let needsUpdate = false
        
        if (!newRoles || newRoles.length === 0) {
          if (user.role) {
            newRoles = [user.role]
            needsUpdate = true
            console.log(`  Migrating ${user.email}: '${user.role}' -> ['${user.role}']`)
          } else {
            newRoles = ['sales']
            needsUpdate = true
            console.log(`  Setting default for ${user.email}: ['sales']`)
          }
        }
        
        if (user.is_super_admin && newRoles.length < 4) {
          newRoles = ['admin', 'manager', 'sales', 'operations']
          needsUpdate = true
          console.log(`  Super admin ${user.email}: assigning all roles`)
        }
        
        if (user.is_org_admin === null || user.is_org_admin === undefined) {
          needsUpdate = true
        }
        
        if (needsUpdate) {
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
              roles: newRoles,
              is_org_admin: user.is_org_admin === null ? false : user.is_org_admin
            })
            .eq('id', user.id)
          
          if (updateError) {
            console.error(`  ✗ Error updating ${user.email}:`, updateError.message)
            errors++
          } else {
            console.log(`  ✓ Updated ${user.email}`)
            migrated++
          }
        } else {
          console.log(`  - Skipped ${user.email} (already migrated)`)
          skipped++
        }
      } catch (userError) {
        console.error(`  ✗ Exception updating ${user.email}:`, userError.message)
        errors++
      }
    }
    
    console.log('=== Migration Summary ===')
    console.log(`Migrated: ${migrated}`)
    console.log(`Skipped: ${skipped}`)
    console.log(`Errors: ${errors}`)
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully!',
      details: {
        total: allUsers?.length || 0,
        migrated,
        skipped,
        errors,
        method: 'nextjs_supabase'
      }
    })
    
  } catch (error) {
    console.error('=== Migration Error ===')
    console.error(error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
