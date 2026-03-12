import { createClient } from '@supabase/supabase-js'

// Get URL and keys with fallback to empty strings
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function supabaseNotConfiguredError() {
  return new Error(
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (and SUPABASE_SERVICE_ROLE_KEY for admin routes).'
  )
}

function createQueryStub() {
  const result = async () => ({ data: null, error: supabaseNotConfiguredError() })
  const chain = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    like: () => chain,
    ilike: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
    single: result,
    maybeSingle: result,
    insert: () => chain,
    update: () => chain,
    upsert: () => chain,
    delete: () => chain,
  }
  return chain
}

function createSupabaseStub() {
  return {
    auth: {
      async getSession() {
        return { data: { session: null }, error: supabaseNotConfiguredError() }
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } }, error: null }
      },
      async signInWithPassword() {
        return { data: { user: null, session: null }, error: supabaseNotConfiguredError() }
      },
      async signOut() {
        return { error: null }
      },
    },
    from() {
      return createQueryStub()
    },
  }
}

// Client-side Supabase client (browser)
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : createSupabaseStub()

// Server-side Supabase client with service role (for API routes)
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : null

// Helper to generate UUID
export function generateId() {
  return crypto.randomUUID()
}

export default supabase
