/**
 * Supabase SQL Helper
 * Execute raw SQL commands directly in Supabase database using pg connection
 */

import { supabaseAdmin } from './supabase'

/**
 * Execute raw SQL query using Supabase admin client
 * This uses PostgreSQL's query execution through Supabase
 * @param {string} sql - The SQL query to execute
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function executeSQL(sql) {
  try {
    // Split multiple statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    
    const results = []
    
    for (const statement of statements) {
      console.log(`Executing SQL: ${statement.substring(0, 100)}...`)
      
      // Use Supabase's .rpc() if available, otherwise use direct query
      try {
        const { data, error } = await supabaseAdmin.rpc('exec_sql', {
          query: statement
        })
        
        if (error) throw error
        results.push(data)
      } catch (rpcError) {
        // If RPC fails, it means the function doesn't exist
        // We'll handle this differently
        console.log('RPC method not available, using alternative approach')
        throw new Error('Direct SQL execution requires manual setup. See migration instructions.')
      }
    }
    
    return { success: true, data: results }
  } catch (error) {
    console.error('SQL execution error:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Add a column to a table using Supabase client
 * This works by checking the schema first, then using a workaround
 * @param {string} tableName - Name of the table
 * @param {string} columnName - Name of the column to add
 * @param {string} columnType - PostgreSQL column type
 * @param {string} defaultValue - Default value (optional)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function addColumnSafe(tableName, columnName, columnType, defaultValue = null) {
  try {
    // First, try to query the table to see if column exists
    const { data: testData, error: testError } = await supabaseAdmin
      .from(tableName)
      .select(columnName)
      .limit(1)
    
    if (!testError) {
      console.log(`Column ${columnName} already exists in ${tableName}`)
      return { success: true, message: 'Column already exists' }
    }
    
    // Column doesn't exist, need to add it
    // Since we can't directly alter schema, return instructions
    return {
      success: false,
      error: 'Cannot directly alter schema. Manual SQL required.',
      sql: `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnType}${defaultValue ? ` DEFAULT ${defaultValue}` : ''};`
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Check if a column exists by attempting to select it
 * @param {string} tableName - Name of the table
 * @param {string} columnName - Name of the column
 * @returns {Promise<boolean>}
 */
export async function columnExists(tableName, columnName) {
  try {
    const { error } = await supabaseAdmin
      .from(tableName)
      .select(columnName)
      .limit(1)
    
    return !error
  } catch (error) {
    return false
  }
}

/**
 * Generate SQL migration script
 * @param {string} migrationName - Name of migration
 * @param {Object[]} changes - Array of change objects
 * @returns {string} - SQL script
 */
export function generateMigrationSQL(migrationName, changes) {
  let sql = `-- Migration: ${migrationName}\n-- Generated: ${new Date().toISOString()}\n\n`
  
  for (const change of changes) {
    switch (change.type) {
      case 'add_column':
        sql += `ALTER TABLE ${change.table} ADD COLUMN IF NOT EXISTS ${change.column} ${change.dataType}`
        if (change.default) sql += ` DEFAULT ${change.default}`
        sql += ';\n'
        break
        
      case 'create_index':
        const indexType = change.indexType ? `USING ${change.indexType}` : ''
        sql += `CREATE INDEX IF NOT EXISTS ${change.indexName} ON ${change.table} ${indexType}(${change.column});\n`
        break
        
      case 'update':
        sql += `UPDATE ${change.table} SET ${change.set} WHERE ${change.where};\n`
        break
        
      case 'raw':
        sql += `${change.sql}\n`
        break
    }
  }
  
  return sql
}

/**
 * Execute migration by generating SQL and attempting to run it
 * If direct execution fails, returns the SQL for manual execution
 * @param {string} migrationName - Name of migration
 * @param {Object[]} changes - Array of change objects
 * @returns {Promise<{success: boolean, sql?: string, error?: string}>}
 */
export async function runMigration(migrationName, changes) {
  const sql = generateMigrationSQL(migrationName, changes)
  console.log(`Generated migration SQL:\n${sql}`)
  
  const result = await executeSQL(sql)
  
  if (!result.success) {
    return {
      success: false,
      sql: sql,
      error: result.error,
      message: 'Migration SQL generated. Manual execution required in Supabase dashboard.'
    }
  }
  
  return {
    success: true,
    message: `Migration '${migrationName}' completed successfully`
  }
}

