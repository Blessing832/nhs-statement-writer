import { verifyAdminToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { triggerApifyScrapeDetailed } from '@/lib/vacancy-scheduler'


export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })  
  }

  const result = await triggerApifyScrapeDetailed()
  if (!result.runId) {
    return NextResponse.json({ error: result.error ?? 'Failed to trigger the Apify run' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, runId: result.runId })
}
