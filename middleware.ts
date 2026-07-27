import { NextRequest, NextResponse } from 'next/server'

const APP_LANDING_DOMAINS = new Set(['app.easeme.live'])

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const domain = host.split(':')[0]

  // app.easeme.live → serve the marketing landing page
  if (APP_LANDING_DOMAINS.has(domain)) {
    return NextResponse.rewrite(new URL('/landing', request.url))
  }

  // easeme.live and everything else → pass through unchanged
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
