import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Migration endpoint using Supabase client directly
 * No Python backend dependency required
 */
export async function POST(request) {
  try {
    console.log('=== Starting Multiple Roles Migration ===')
    
    // Migration SQL statements
    const migrationStatements = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['sales'];",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_org_admin BOOLEAN DEFAULT FALSE;",
      "CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN(roles);",
      "UPDATE users SET roles = CASE WHEN role IS NOT NULL AND role != '' THEN ARRAY[role]::TEXT[] ELSE ARRAY['sales']::TEXT[] END WHERE (roles IS NULL OR array_length(roles, 1) IS NULL);",
      "UPDATE users SET roles = ARRAY['admin', 'manager', 'sales', 'operations']::TEXT[] WHERE is_super_admin = TRUE;",
      "UPDATE users SET is_org_admin = COALESCE(is_org_admin, FALSE) WHERE is_org_admin IS NULL;"
    ]
    
    console.log('Executing schema migration via Supabase...')
    
    // Execute each statement via Supabase RPC
    let executed = 0
    let skippedStmts = 0
    const stmtErrors = []
    
    for (const stmt of migrationStatements) {
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: stmt })
        if (error) {
          if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
            skippedStmts++
          } else {
            stmtErrors.push(error.message)
          }
        } else {
          executed++
        }
      } catch (e) {
        // RPC might not exist, but data migration can still work
        console.log('RPC exec_sql not available, skipping schema migration')
        break
      }
    }
    
    console.log(`Schema migration: ${executed} executed, ${skippedStmts} skipped`)
    
    // Now migrate user data
    console.log('Migrating user data...')
    const { data: allUsers, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
    
    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`)
    }

    console.log(`Found ${allUsers?.length || 0} users`)
    
    let migrated = 0
    let skipped = 0
    let errors = 0
    
    for (const user of allUsers || []) {
      try {
        let newRoles = user.roles || []
        let needsUpdate = false
        
        if (!newRoles || newRoles.length === 0) {
          newRoles = user.role ? [user.role] : ['sales']
          needsUpdate = true
        }
        
        if (user.is_super_admin && newRoles.length < 4) {
          newRoles = ['admin', 'manager', 'sales', 'operations']
          needsUpdate = true
        }
        
        if (user.is_org_admin === null || user.is_org_admin === undefined) {
          needsUpdate = true
        }
        
        if (needsUpdate) {
          const { error } = await supabaseAdmin
            .from('users')
            .update({
              roles: newRoles,
              is_org_admin: user.is_org_admin === null ? false : user.is_org_admin
            })
            .eq('id', user.id)
          
          error ? errors++ : migrated++
        } else {
          skipped++
        }
      } catch (e) {
        errors++
      }
    }
    
    console.log(`Data migration: ${migrated} migrated, ${skipped} skipped`)
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed!',
      details: {
        schema: {
          total: migrationStatements.length,
          executed,
          skipped: skippedStmts
        },
        data: {
          total: allUsers?.length || 0,
          migrated,
          skipped,
          errors
        }
      }
    })
    
  } catch (error) {
    console.error('Migration Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
