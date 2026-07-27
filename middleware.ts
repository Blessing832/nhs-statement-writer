import { NextRequest, NextResponse } from 'next/server'

const LANDING_DOMAINS = new Set(['easeme.live', 'www.easeme.live'])

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const domain = host.split(':')[0] // strip port for local dev
  const { pathname } = request.nextUrl

  // Landing domain — rewrite every request to the marketing page
  if (LANDING_DOMAINS.has(domain)) {
    return NextResponse.rewrite(new URL('/landing', request.url))
  }

  // App domain — require worker session cookie
  // Skip for: the login page itself, the auth API, and when WORKER_TOKEN is unset (local dev)
  const workerToken = process.env.WORKER_TOKEN
  const isPublic =
    pathname === '/worker-login' ||
    pathname.startsWith('/api/worker-auth')

  if (workerToken && !isPublic) {
    const session = request.cookies.get('worker-session')
    if (session?.value !== workerToken) {
      const loginUrl = new URL('/worker-login', request.url)
      if (pathname !== '/') loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
