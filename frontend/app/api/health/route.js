import { NextResponse } from 'next/server'
import { handleCORS } from '@/lib/api-helpers'

export async function GET() {
  return handleCORS(NextResponse.json({ 
    status: "healthy", 
    service: "Travel CRM Frontend API",
    timestamp: new Date().toISOString()
  }))
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}