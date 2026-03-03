import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Execute SQL directly using Supabase admin client
 * This replaces the need for Python backend SQL execution
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { sql, statements } = body

    // Check if we have a service role key
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Supabase admin client not configured. Check SUPABASE_SERVICE_ROLE_KEY.',
        needsManualExecution: true
      }, { status: 500 })
    }

    // Handle migration (multiple statements)
    if (statements && Array.isArray(statements)) {
      console.log(`Running migration with ${statements.length} statements...`)
      
      const results = []
      const errors = []
      let skipped = 0

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]
        if (!stmt.trim()) continue

        try {
          console.log(`[${i + 1}/${statements.length}] Executing: ${stmt.substring(0, 60)}...`)
          
          // Use RPC function if available, otherwise try direct execution
          const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql: stmt })
          
          if (error) {
            // Check if it's a "column already exists" type error (OK to skip)
            if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
              console.log(`  ⚠ Skipped (already exists)`)
              skipped++
              results.push(`Statement ${i + 1}: Skipped (already exists)`)
            } else {
              console.error(`  ✗ Error:`, error.message)
              errors.push(`Statement ${i + 1}: ${error.message}`)
            }
          } else {
            console.log(`  ✓ Success`)
            results.push(`Statement ${i + 1}: OK`)
          }
        } catch (stmtError) {
          console.error(`  ✗ Exception:`, stmtError.message)
          errors.push(`Statement ${i + 1}: ${stmtError.message}`)
        }
      }

      return NextResponse.json({
        success: errors.length === 0,
        total: statements.length,
        executed: results.length,
        skipped,
        failed: errors.length,
        results,
        errors
      })
    }

    // Handle single SQL statement
    if (sql) {
      console.log(`Executing SQL: ${sql.substring(0, 80)}...`)
      
      const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql })
      
      if (error) {
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        data
      })
    }

    return NextResponse.json({
      success: false,
      error: 'No SQL provided. Send either "sql" or "statements" in request body.'
    }, { status: 400 })

  } catch (error) {
    console.error('SQL execution error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Next.js SQL Execution API',
    hasAdminClient: !!supabaseAdmin
  })
}
