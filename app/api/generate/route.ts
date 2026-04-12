import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateStatement } from '@/lib/claude'
import { ScrapeResult } from '@/lib/types'

export const maxDuration = 60

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL!
const SCRAPER_SECRET = process.env.SCRAPER_SECRET!

export async function POST(req: NextRequest) {
  try {
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

    // 1. Look up the client
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('client_code', client_code.toUpperCase())
      .eq('is_active', true)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Invalid or inactive client code' }, { status: 401 })
    }

    // 2. Check subscription is still valid
    const now = new Date()
    const subEnd = new Date(client.subscription_end)
    if (now > subEnd) {
      return NextResponse.json({ error: 'Your subscription has expired. Please contact the administrator.' }, { status: 403 })
    }

    // 3. Call scraper directly (bypass internal API hop to save time)
    const scrapeRes = await fetch(`${SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scraper-secret': SCRAPER_SECRET,
      },
      body: JSON.stringify({ url: vacancy_url }),
      signal: AbortSignal.timeout(50000), // 50s timeout
    })

    if (!scrapeRes.ok) {
      const scrapeErr = await scrapeRes.json().catch(() => ({ error: 'Failed to read job advert' }))
      return NextResponse.json({ error: `Could not read job advert: ${scrapeErr.error}` }, { status: 422 })
    }

    const jobData: ScrapeResult = await scrapeRes.json()

    if (!jobData.rawText || jobData.rawText.length < 100) {
      return NextResponse.json({ error: 'Could not extract enough information from the job advert. Please check the URL.' }, { status: 422 })
    }

    // 4. Generate statement with Claude
    const { statement, duties, analysis, promptRegion } = await generateStatement(client, jobData, {
      instructions,
      style: style || '1',
      specificQuestions,
      rewriteInstruction,
      previousStatement,
      vacancyUrl: vacancy_url,
    })

    // 5. Save to database (only for new generations, not rewrites)
    if (!rewriteInstruction) {
      await supabaseAdmin.from('statements').insert({
        client_id: client.id,
        vacancy_url,
        job_title: jobData.jobTitle,
        organisation: jobData.organisation,
        generated_statement: statement,
        key_duties: duties,
      })
    }

    return NextResponse.json({
      statement,
      duties,
      analysis,
      promptRegion,
      jobTitle: jobData.jobTitle,
      organisation: jobData.organisation,
      source: jobData.source,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Generate error:', message)

    // Give applicants a clean message for billing/credit issues
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
}
