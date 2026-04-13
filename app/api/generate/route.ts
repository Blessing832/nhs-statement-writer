import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateStatement } from '@/lib/claude'
import { ScrapeResult } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const {
    client_code,
    vacancy_url,
    jobData,
    instructions,
    style,
    specificQuestions,
    rewriteInstruction,
    previousStatement,
  } = await req.json()

  if (!client_code || !vacancy_url || !jobData) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

  // 2. Generate (job data already scraped by client in step 1)
  let generated: Awaited<ReturnType<typeof generateStatement>>
  try {
    generated = await generateStatement(client, jobData as ScrapeResult, {
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

  // 3. Save to DB
  await supabaseAdmin.from('statements').insert({
    client_id: client.id,
    vacancy_url,
    job_title: (jobData as ScrapeResult).jobTitle,
    organisation: (jobData as ScrapeResult).organisation,
    generated_statement: statement,
    key_duties: currentRoleDuties.length > 0 ? currentRoleDuties : (analysis?.keyDuties || []),
    is_rewrite: !!rewriteInstruction,
    rewrite_instruction: rewriteInstruction || null,
  })

  return NextResponse.json({
    statement,
    previousRoleDuties,
    currentRoleDuties,
    analysis,
    promptRegion,
    jobTitle: (jobData as ScrapeResult).jobTitle,
    organisation: (jobData as ScrapeResult).organisation,
    source: (jobData as ScrapeResult).source,
  })
}
