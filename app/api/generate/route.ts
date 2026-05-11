import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
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
    applicationMode,
    bodyPattern,
    pastedPersonSpec,
  } = await req.json()

  if (!client_code || !vacancy_url || !jobData) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Merge any pasted person spec into the rawText so the AI prompt sees it
  const enrichedJobData = pastedPersonSpec?.trim()
    ? {
        ...(jobData as object),
        rawText: (jobData.rawText || '') + '\n\n=== PASTED PERSON SPECIFICATION ===\n' + pastedPersonSpec.trim(),
      }
    : jobData

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
    generated = await generateStatement(client, enrichedJobData as ScrapeResult, {
      instructions,
      style: style || '1',
      specificQuestions,
      rewriteInstruction,
      previousStatement,
      vacancyUrl: vacancy_url,
      applicationMode: applicationMode || 'full',
      bodyPattern: bodyPattern || undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (err instanceof Anthropic.APIError) {
      const body = err.error ? JSON.stringify(err.error).slice(0, 300) : 'no-body'
      console.error(`CLAUDE_ERR status=${err.status} type=${err.type} body=${body}`)
    } else {
      console.error(`CLAUDE_ERR_OTHER msg=${String(message).slice(0, 300)}`)
    }

    if (err instanceof Anthropic.APIError) {
      // Overloaded — transient, user should retry
      if (err.status === 529 || err.type === 'overloaded_error') {
        return NextResponse.json(
          { error: 'The AI service is busy right now. Please wait a moment and try again.' },
          { status: 503 }
        )
      }
      // Invalid / missing API key
      if (err.status === 401 || err.type === 'authentication_error') {
        return NextResponse.json(
          { error: 'The statement writer is temporarily unavailable (authentication). Please contact your administrator.' },
          { status: 503 }
        )
      }
      // Billing / credits exhausted — Anthropic returns 400 with billing message OR 402
      if (
        err.status === 402 ||
        err.type === 'billing_error' ||
        message.toLowerCase().includes('credit balance') ||
        message.toLowerCase().includes('billing') ||
        message.toLowerCase().includes('quota')
      ) {
        return NextResponse.json(
          { error: 'The statement writer is temporarily unavailable. If you have just added credits, please wait 1-2 minutes and try again. Otherwise contact your administrator.' },
          { status: 503 }
        )
      }
    } else if (
      message.toLowerCase().includes('credit balance') ||
      message.toLowerCase().includes('billing') ||
      message.toLowerCase().includes('quota') ||
      message.toLowerCase().includes('overloaded')
    ) {
      return NextResponse.json(
        { error: 'The statement writer is temporarily unavailable. Please wait a moment and try again.' },
        { status: 503 }
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { statement, previousRoleDuties, analysis, promptRegion } = generated

  // 3. Save to DB — try with pasted_person_spec first; fall back if column not migrated yet
  const baseRow = {
    client_id: client.id,
    vacancy_url,
    job_title: (jobData as ScrapeResult).jobTitle,
    organisation: (jobData as ScrapeResult).organisation,
    generated_statement: statement,
    key_duties: previousRoleDuties.length > 0 ? previousRoleDuties : (analysis?.keyDuties || []),
    is_rewrite: !!rewriteInstruction,
    rewrite_instruction: rewriteInstruction || null,
  }
  const { error: insertError } = await supabaseAdmin.from('statements').insert({
    ...baseRow,
    pasted_person_spec: pastedPersonSpec?.trim() || null,
  })
  if (insertError) {
    // Column doesn't exist yet — save without it so the statement is never lost
    await supabaseAdmin.from('statements').insert(baseRow)
  }

  return NextResponse.json({
    statement,
    previousRoleDuties,
    currentRoleDuties: [],
    analysis,
    promptRegion,
    jobTitle: (jobData as ScrapeResult).jobTitle,
    organisation: (jobData as ScrapeResult).organisation,
    source: (jobData as ScrapeResult).source,
  })
}
