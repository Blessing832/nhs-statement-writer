import { NextRequest, NextResponse } from 'next/server'
import { createAdminToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password === process.env.ADMIN_SECRET) {
    return NextResponse.json({ token: createAdminToken() })
  }
  return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
}
