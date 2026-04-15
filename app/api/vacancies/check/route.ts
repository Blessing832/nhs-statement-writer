import { NextRequest, NextResponse } from 'next/server'
import { recheckOpenVacancies } from '@/lib/vacancy/scanner'

export const maxDuration = 60

function isAuthorised(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-token')
  return secret === process.env.ADMIN_SECRET
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const closedCount = await recheckOpenVacancies()
    return NextResponse.json({ success: true, closed_count: closedCount })
  } catch (err) {
    console.error('[POST /api/vacancies/check]', err)
    return NextResponse.json({ error: 'Check failed' }, { status: 500 })
  }
}
