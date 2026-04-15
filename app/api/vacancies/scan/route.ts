import { NextRequest, NextResponse } from 'next/server'
import { runScan } from '@/lib/vacancy/scanner'

export const maxDuration = 60

// Simple admin secret check — reuse existing admin auth pattern
function isAuthorised(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-token')
  return secret === process.env.ADMIN_SECRET
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const result = await runScan()
    return NextResponse.json({
      success: true,
      new_vacancies: result.newVacancies,
      new_matches: result.newMatches,
    })
  } catch (err) {
    console.error('[POST /api/vacancies/scan]', err)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
