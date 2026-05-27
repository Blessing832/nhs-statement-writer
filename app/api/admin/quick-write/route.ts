import { NextRequest, NextResponse } from 'next/server'
import { generateStatement } from '@/lib/claude'
import { scrapeJobUrl } from '@/lib/job-scraper'
import type { Client, ScrapeResult } from '@/lib/types'

export const maxDuration = 300

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
    person_spec,
    instructions,
    style,
    applicationMode,
    bodyPattern,
    specificQuestions,
    rewriteInstruction,
    previousStatement,
    cachedJobData,
  } = await req.json()

  if (!vacancy_url || !name) {
    return NextResponse.json({ error: 'Name and job URL are required' }, { status: 400 })
  }

  // Step 1: Use cached job data for rewrites, otherwise scrape
  let jobData: ScrapeResult
  if (cachedJobData) {
    jobData = cachedJobData as ScrapeResult
  } else {
    try {
      jobData = await scrapeJobUrl(vacancy_url)
    } catch (err: unknown) {
      if (!person_spec?.trim()) {
        const message = err instanceof Error ? err.message : 'Could not read job advert'
        return NextResponse.json({ error: message }, { status: 422 })
      }
      jobData = {
        rawText: '',
        jobTitle: '',
        organisation: '',
        jobDescription: '',
        personSpec: '',
        source: 'manual',
      }
    }

    // Merge pasted/uploaded person spec into rawText
    if (person_spec?.trim()) {
      jobData = {
        ...jobData,
        rawText: (jobData.rawText || '') + '\n\n=== PASTED PERSON SPECIFICATION ===\n' + person_spec.trim(),
      }
    }
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
    opening_style: '',
    scotland_q2_variation: '',
    subscription_start: new Date().toISOString(),
    subscription_end: new Date(Date.now() + 86400000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
    q_difficult_situation: '',
    q_why_trust: '',
    q_colleagues_say: '',
    q_proudest_moment: '',
    q_skills_equipment: '',
  }

  // Step 3: Generate the statement
  try {
    const generated = await generateStatement(tempClient, jobData, {
      instructions,
      style: style || '1',
      vacancyUrl: vacancy_url,
      applicationMode: applicationMode || 'full',
      bodyPattern: bodyPattern || undefined,
      specificQuestions: specificQuestions || undefined,
      rewriteInstruction: rewriteInstruction || undefined,
      previousStatement: previousStatement || undefined,
    })

    return NextResponse.json({
      statement: generated.statement,
      previousRoleDuties: generated.previousRoleDuties,
      currentRoleDuties: generated.currentRoleDuties,
      analysis: generated.analysis,
      jobTitle: jobData.jobTitle,
      organisation: jobData.organisation,
      promptRegion: generated.promptRegion,
      cachedJobData: jobData,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[quick-write] Claude error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
