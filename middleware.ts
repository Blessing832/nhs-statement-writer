import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Railway forwards the original hostname via x-forwarded-host;
  // fall back to host header for local dev
  const forwarded = request.headers.get('x-forwarded-host') ?? ''
  const host = request.headers.get('host') ?? ''
  const domain = (forwarded || host).split(':')[0].toLowerCase()

  if (domain === 'app.easeme.live') {
    return NextResponse.rewrite(new URL('/landing', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
