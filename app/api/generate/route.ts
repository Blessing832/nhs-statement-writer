import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateStatement } from '@/lib/claude'
import { ScrapeResult } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const { client_code, vacancy_url, instructions } = await req.json()

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

    // 3. Scrape the job vacancy
    const scrapeRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: vacancy_url }),
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
    const { statement, duties } = await generateStatement(client, jobData, instructions)

    // 5. Save to database
    await supabaseAdmin.from('statements').insert({
      client_id: client.id,
      vacancy_url,
      job_title: jobData.jobTitle,
      organisation: jobData.organisation,
      generated_statement: statement,
      key_duties: duties,
    })

    return NextResponse.json({
      statement,
      duties,
      jobTitle: jobData.jobTitle,
      organisation: jobData.organisation,
      source: jobData.source,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Generate error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
