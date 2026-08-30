import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { generateStatement, analyzeJobPosting, detectRegion } from '@/lib/claude'
import { ScrapeResult, CoverageReport } from '@/lib/types'
import { runScotlandPipeline } from '@/lib/statement-pipeline'
import { runNHSV2Pipeline } from '@/lib/nhs-v2-pipeline'
import { applyReplacements } from '@/lib/bannedWords'

// ── Banned-word replacement map — cached in-process for 5 minutes ─────────────
let bwCache: { map: Map<string, string>; expiresAt: number } | null = null

async function getReplacementMap(): Promise<Map<string, string>> {
  if (bwCache && bwCache.expiresAt > Date.now()) return bwCache.map
  const { data } = await supabaseAdmin
    .from('banned_words')
    .select('word, replacement')
    .eq('enabled', true)
  const map = new Map<string, string>()
  for (const row of data ?? []) map.set(row.word, row.replacement)
  bwCache = { map, expiresAt: Date.now() + 5 * 60 * 1000 }
  return map
}

export const maxDuration = 300

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
    openingTemplate,
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

  // 1b. Check statement limit
  if (client.statement_limit != null) {
    const { count } = await supabaseAdmin
      .from('statements')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id)
    if ((count ?? 0) >= client.statement_limit) {
      await supabaseAdmin.from('clients').update({ is_active: false }).eq('id', client.id)
      return NextResponse.json(
        { error: 'You have reached your statement limit. Please contact your administrator.' },
        { status: 403 }
      )
    }
  }

  // 1c. URL duplicate checks — only for real job URLs, not rewrites, not text-paste
  const isRealUrl = vacancy_url && vacancy_url.startsWith('http')
  if (isRealUrl && !rewriteInstruction) {
    // Rule 1: Same applicant cannot generate from the same URL more than once
    const { count: priorCount } = await supabaseAdmin
      .from('statements')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .eq('vacancy_url', vacancy_url)

    if ((priorCount ?? 0) >= 1) {
      // Return the existing statement so the user gets their result without a new API call
      const { data: existing } = await supabaseAdmin
        .from('statements')
        .select('generated_statement, job_title, organisation')
        .eq('client_id', client.id)
        .eq('vacancy_url', vacancy_url)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (existing) {
        // Run a quick analysis so the PS coverage panel and highlights still work
        const cachedAnalysis = await analyzeJobPosting(client, enrichedJobData as ScrapeResult, vacancy_url).catch(() => null)
        return NextResponse.json({
          statement: existing.generated_statement,
          previousRoleDuties: [],
          currentRoleDuties: [],
          analysis: cachedAnalysis,
          promptRegion: detectRegion(vacancy_url, (enrichedJobData as ScrapeResult).rawText),
          jobTitle: existing.job_title,
          organisation: existing.organisation,
          source: 'cached',
          cached: true,
        })
      }
      return NextResponse.json(
        { error: 'A statement for this job link has already been generated for your account. Each job link can only be used once per applicant. If you need changes, use the edit/rewrite option on your existing statement.' },
        { status: 429 }
      )
    }

    // Rule 2: A single URL can be used by at most 5 different applicants
    const { data: urlRows } = await supabaseAdmin
      .from('statements')
      .select('client_id')
      .eq('vacancy_url', vacancy_url)

    const distinctClients = new Set((urlRows ?? []).map((r: { client_id: string }) => r.client_id))
    if (distinctClients.size >= 5) {
      return NextResponse.json(
        { error: 'This job link has reached the maximum number of applicants (5). Please contact your administrator.' },
        { status: 429 }
      )
    }
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
      openingTemplate: openingTemplate || undefined,
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

  let { statement, previousRoleDuties, analysis, promptRegion } = generated

  // 2b. Verification pipeline — England/Wales and Scotland full statements only
  let coverageReport: CoverageReport | null = null
  const pipelineRegion = promptRegion === 'england-wales' ? 'england-wales'
    : promptRegion === 'scotland' ? 'scotland'
    : null
  if (
    pipelineRegion &&
    applicationMode !== 'questions-only' &&
    analysis &&
    (analysis.essentialCriteria?.length ?? 0) > 0 &&
    !rewriteInstruction
  ) {
    try {
      const pipeline = pipelineRegion === 'scotland'
        ? await runScotlandPipeline(statement, analysis, client)
        : await runNHSV2Pipeline(statement, analysis, client)
      coverageReport = pipeline
      if (pipeline.patchedStatement) {
        statement = pipeline.patchedStatement
      }
      const u = pipeline.tokenUsage
      console.log(
        `PIPELINE[${pipelineRegion}] total tokens: audit_in=${u.auditInputTokens} audit_out=${u.auditOutputTokens}` +
        ` patch_in=${u.patchInputTokens} patch_out=${u.patchOutputTokens}` +
        ` patched=${pipeline.patched} all_pass=${pipeline.allPass}`
      )
    } catch (err) {
      console.error('PIPELINE_ERR (non-fatal, continuing with original statement):', err)
    }
  }

  // 2c. Deterministic banned-word replacement — final pass after pipeline
  try {
    const replacementMap = await getReplacementMap()
    const before = statement
    statement = applyReplacements(statement, replacementMap)
    if (statement !== before) {
      console.log('BANNED_WORD_REPLACER: applied replacements')
    }
  } catch (err) {
    console.error('BANNED_WORD_REPLACER_ERR (non-fatal):', err)
  }

  // 3. Save to DB — try with pasted_person_spec first; fall back ONLY on schema errors
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
  // Only fall back if the error is a missing column (code 42703) — never fall back on
  // transient/network errors, which could cause a duplicate row if the first insert succeeded
  const isSchemaMismatch = insertError && (
    insertError.code === '42703' ||
    insertError.message?.toLowerCase().includes('column') ||
    insertError.message?.toLowerCase().includes('does not exist')
  )
  if (isSchemaMismatch) {
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
    coverageReport,
  })
}
