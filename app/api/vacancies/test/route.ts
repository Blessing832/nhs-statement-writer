import { NextResponse } from 'next/server'

export async function GET() {
  const ACTOR_ID = 'kinaesthetic_millionaire~nhs-uk-jobs-scraper'
  const APIFY_BASE = 'https://api.apify.com/v2'
  const token = process.env.APIFY_API_TOKEN
  const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://easeme.live'}/api/vacancies/ingest`

  if (!token) {
    return NextResponse.json({ error: 'APIFY_API_TOKEN not set in environment' }, { status: 500 })
  }

  // Trigger a real run and return the raw Apify response for inspection
  const webhooksParam = Buffer.from(
    JSON.stringify([{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl }])
  ).toString('base64url')

  const actorInput = {
    startUrls: [{ url: 'https://www.jobs.nhs.uk/candidate/search' }],
    maxItems: 10,
  }

  let apifyResponse: unknown = null
  let apifyStatus: number | null = null
  let triggerError: string | null = null

  try {
    const res = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent(ACTOR_ID)}/runs?token=${token}&webhooks=${webhooksParam}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput),
      }
    )
    apifyStatus = res.status
    apifyResponse = await res.json()
  } catch (err) {
    triggerError = String(err)
  }

  return NextResponse.json({
    webhookUrl,
    actorId: ACTOR_ID,
    tokenPrefix: token.slice(0, 8) + '...',
    apifyStatus,
    apifyResponse,
    triggerError,
  })
}
