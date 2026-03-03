'use client'

export default function DebugPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Debug Environment Variables</h1>
      <p><strong>NEXT_PUBLIC_SUPABASE_URL:</strong> {url || 'UNDEFINED'}</p>
      <p><strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong> {key ? `${key.substring(0, 20)}...` : 'UNDEFINED'}</p>
      <hr />
      <p>URL Type: {typeof url}</p>
      <p>KEY Type: {typeof key}</p>
    </div>
  )
}
