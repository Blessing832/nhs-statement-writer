import { NextRequest, NextResponse } from 'next/server'

// Hostname routing is handled in next.config.ts rewrites
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
