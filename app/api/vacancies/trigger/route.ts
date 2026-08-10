import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// POST /api/vacancies/trigger — manually fire one Apify scraper run (admin only)
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-token')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const token = process.env.APIFY_API_TOKEN
  if (!token) return NextResponse.json({ error: 'APIFY_API_TOKEN not set' }, { status: 500 })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const body = {
    startUrls: [
      { url: `https://www.jobs.nhs.uk/candidate/search/results?payBand=BAND_3%2CBAND_4&workingPattern=full-time&contractType=Permanent&staffGroup=NURSING_AND_MIDWIFERY_REGD&searchFormType=sortBy&sort=publicationDateDesc&language=en&publishedFrom=${today}` },
      { url: `https://www.jobs.nhs.uk/candidate/search/results?payBand=BAND_3%2CBAND_4&workingPattern=full-time&contractType=Permanent&staffGroup=ALLIED_HEALTH_PROF&searchFormType=sortBy&sort=publicationDateDesc&language=en&publishedFrom=${today}` },
    ],
    maxItems: 50,
  }

  const res = await fetch(
    `https://api.apify.com/v2/acts/kinaesthetic_millionaire~nhs-uk-jobs-scraper/runs?token=${token}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  const data = await res.json() as { data?: { id: string; status: string } }
  return NextResponse.json({ runId: data.data?.id, status: data.data?.status })
}
