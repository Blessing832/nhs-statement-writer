import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { adminSecretConfigured, createAdminToken } from '@/lib/auth'

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES = 8
const failures = new Map<string, { count: number; first: number }>()

function clientIp(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
}

export async function POST(req: NextRequest) {
  if (!adminSecretConfigured()) {
    console.error('ADMIN_LOGIN_DISABLED: ADMIN_SECRET is missing or shorter than 12 characters')
    return NextResponse.json({ error: 'Admin login is not configured' }, { status: 503 })
  }

  const ip = clientIp(req)
  const now = Date.now()
  const entry = failures.get(ip)
  if (entry && now - entry.first < WINDOW_MS && entry.count >= MAX_FAILURES) {
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
  }

  let password = ''
  try {
    const body = await req.json()
    password = typeof body?.password === 'string' ? body.password : ''
  } catch { /* fall through to invalid */ }

  const expected = Buffer.from(process.env.ADMIN_SECRET as string)
  const given = Buffer.from(password)
  const ok = given.length === expected.length && timingSafeEqual(given, expected)

  if (ok) {
    failures.delete(ip)
    return NextResponse.json({ token: createAdminToken() })
  }

  const fresh = entry && now - entry.first < WINDOW_MS
  failures.set(ip, { count: fresh ? entry.count + 1 : 1, first: fresh ? entry.first : now })
  return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
}
