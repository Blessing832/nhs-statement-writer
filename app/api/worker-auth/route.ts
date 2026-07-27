import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'worker-session'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
}

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!process.env.WORKER_PASSWORD || !process.env.WORKER_TOKEN) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
  }

  if (password !== process.env.WORKER_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, process.env.WORKER_TOKEN, COOKIE_OPTIONS)
  return res
}

export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 })
  return res
}
