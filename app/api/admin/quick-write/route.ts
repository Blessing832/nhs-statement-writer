import { NextRequest, NextResponse } from 'next/server'
import { generateStatement } from '@/lib/claude'
import type { Client, ScrapeResult } from '@/lib/types'

export const maxDuration = 60

function isAuthorised(req: NextRequest): boolean {
  return req.headers.get('x-admin-token') === process.env.ADMIN_SECRET
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const {
    name,
    work_history,
    qualifications,
    skills,
    background,
    vacancy_url,
    instructions,
    style,
  } = await req.json()

  if (!vacancy_url || !name) {
    return NextResponse.json({ error: 'Name and job URL are required' }, { status: 400 })
  }

  // Step 1: Scrape the job URL using the scraper service
  const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL
  const SCRAPER_SECRET = process.env.SCRAPER_SECRET

  if (!SCRAPER_URL || !SCRAPER_SECRET) {
    return NextResponse.json({ error: 'Scraper service not configured' }, { status: 503 })
  }

  let jobData: ScrapeResult
  try {
    const scrapeRes = await fetch(`${SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scraper-secret': SCRAPER_SECRET,
      },
      body: JSON.stringify({ url: vacancy_url }),
      signal: AbortSignal.timeout(45000),
    })

    if (!scrapeRes.ok) {
      const err = await scrapeRes.json().catch(() => ({ error: 'Could not read job advert' }))
      return NextResponse.json(
        { error: err.error || 'Could not read job advert. Check the URL and try again.' },
        { status: scrapeRes.status }
      )
    }

    jobData = await scrapeRes.json()

    if (!jobData.rawText || jobData.rawText.length < 100) {
      return NextResponse.json(
        { error: 'Could not extract enough text from the job advert. Check the URL.' },
        { status: 422 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Job advert page took too long to load. Check the URL and try again.' },
      { status: 504 }
    )
  }

  // Step 2: Build a temporary client object from the pasted info
  const tempClient: Client = {
    id: 'one-time',
    client_code: 'ONETIME',
    full_name: name,
    work_history: work_history || '',
    qualifications: qualifications || '',
    skills: skills || '',
    background: background || '',
    special_instructions: '',
    subscription_start: new Date().toISOString(),
    subscription_end: new Date(Date.now() + 86400000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
  }

  // Step 3: Generate the statement
  try {
    const generated = await generateStatement(tempClient, jobData, {
      instructions,
      style: style || '1',
      vacancyUrl: vacancy_url,
      applicationMode: 'full',
    })

    return NextResponse.json({
      statement: generated.statement,
      analysis: generated.analysis,
      jobTitle: jobData.jobTitle,
      organisation: jobData.organisation,
      promptRegion: generated.promptRegion,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[quick-write] Claude error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
