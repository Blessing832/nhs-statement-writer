import { NextRequest, NextResponse } from 'next/server'
import { triggerApifyScrape } from '@/lib/vacancy-scheduler'

function isAuthorised(req: NextRequest): boolean {
  return req.headers.get('x-admin-token') === process.env.ADMIN_SECRET
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })  
  }

  const runId = await triggerApifyScrape()
  if (!runId) {
    return NextResponse.json({ error: 'Failed to trigger Apify run — check APIFY_API_TOKEN' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, runId })
}
