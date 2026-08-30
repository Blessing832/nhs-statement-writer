import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function hmacSign(payload: string): string {
  const secret = process.env.ADMIN_SECRET ?? ''
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function createAdminToken(): string {
  const ts = Date.now()
  const payload = `admin:${ts}`
  const sig = hmacSign(payload)
  // encode as base64 so it's a single opaque string safe for localStorage
  return Buffer.from(`${payload}.${sig}`).toString('base64')
}

export function verifyAdminToken(req: NextRequest): boolean {
  const raw = req.headers.get('x-admin-token')
  if (!raw) return false
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8')
    const lastDot = decoded.lastIndexOf('.')
    if (lastDot === -1) return false
    const payload = decoded.slice(0, lastDot)
    const sig = decoded.slice(lastDot + 1)
    // constant-time comparison via re-signing
    const expected = hmacSign(payload)
    if (sig.length !== expected.length) return false
    let diff = 0
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
    if (diff !== 0) return false
    // check expiry
    const ts = parseInt(payload.split(':')[1] ?? '0', 10)
    return Date.now() - ts < TOKEN_TTL_MS
  } catch {
    return false
  }
}
