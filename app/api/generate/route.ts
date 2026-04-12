import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateStatement } from '@/lib/claude'
import { ScrapeResult } from '@/lib/types'

export const maxDuration = 60

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL!
const SCRAPER_SECRET = process.env.SCRAPER_SECRET!

export async function POST(req: NextRequest) {
  const {
    client_code,
    vacancy_url,
    instructions,
    style,
    specificQuestions,
    rewriteInstruction,
    previousStatement,
  } = await req.json()

  if (!client_code || !vacancy_url) {
    return NextResponse.json({ error: 'Client code and vacancy URL are required' }, { status: 400 })
  }

  // 1. Look up client
  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('client_code', client_code.toUpperCase())
    .eq('is_active', true)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Invalid or inactive client code' }, { status: 401 })
  }

  const now = new Date()
  const subEnd = new Date(client.subscription_end)
  if (now > subEnd) {
    return NextResponse.json(
      { error: 'Your subscription has expired. Please contact the administrator.' },
      { status: 403 }
    )
  }

  // 2. Scrape
  let scrapeRes: Response
  try {
    scrapeRes = await fetch(`${SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scraper-secret': SCRAPER_SECRET,
      },
      body: JSON.stringify({ url: vacancy_url }),
      signal: AbortSignal.timeout(45000),
    })
  } catch {
    return NextResponse.json(
      { error: 'The job advert page took too long to load. Please try again in a moment.' },
      { status: 504 }
    )
  }

  if (!scrapeRes.ok) {
    const scrapeErr = await scrapeRes.json().catch(() => ({ error: 'Failed to read job advert' }))
    return NextResponse.json(
      { error: `Could not read the job advert page. Please check the URL is correct and try again. (${scrapeErr.error})` },
      { status: 502 }
    )
  }

  const jobData: ScrapeResult = await scrapeRes.json()

  if (!jobData.rawText || jobData.rawText.length < 100) {
    return NextResponse.json(
      { error: 'Could not extract enough information from the job advert. Please check the URL.' },
      { status: 422 }
    )
  }

  // 3. Generate
  let generated: Awaited<ReturnType<typeof generateStatement>>
  try {
    generated = await generateStatement(client, jobData, {
      instructions,
      style: style || '1',
      specificQuestions,
      rewriteInstruction,
      previousStatement,
      vacancyUrl: vacancy_url,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Claude error:', message)

    if (
      message.toLowerCase().includes('credit') ||
      message.toLowerCase().includes('billing') ||
      message.toLowerCase().includes('balance') ||
      message.toLowerCase().includes('quota') ||
      message.toLowerCase().includes('overloaded')
    ) {
      return NextResponse.json(
        { error: 'The statement writer is temporarily unavailable. Please contact your administrator.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { statement, previousRoleDuties, currentRoleDuties, analysis, promptRegion } = generated

  // 4. Save to DB
  await supabaseAdmin.from('statements').insert({
    client_id: client.id,
    vacancy_url,
    job_title: jobData.jobTitle,
    organisation: jobData.organisation,
    generated_statement: statement,
    key_duties: currentRoleDuties.length > 0 ? currentRoleDuties : (analysis?.keyDuties || []),
    is_rewrite: !!rewriteInstruction,
    rewrite_instruction: rewriteInstruction || null,
  })

  // 5. Return result
  return NextResponse.json({
    statement,
    previousRoleDuties,
    currentRoleDuties,
    analysis,
    promptRegion,
    jobTitle: jobData.jobTitle,
    organisation: jobData.organisation,
    source: jobData.source,
  })
}
