import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

function isAuthorised(req: NextRequest): boolean {
  return req.headers.get('x-admin-token') === process.env.ADMIN_SECRET
}

const SYSTEM_PROMPT = `You are an expert NHS interview preparation coach. Generate comprehensive, candidate-specific interview preparation materials.

ABSOLUTE RULES:
- No bullet points in any answer — all answers must be written in flowing prose paragraphs
- All answers written in the candidate's voice, first person
- Previous role throughout = EXACT vacancy job title from the job description
- Duties referenced in answers = drawn directly from the job description, never invented
- STARR = Situation, Task, Action, Result, Reflection
- Tell Me About Yourself must cover ALL person spec criteria, essential and desirable — not partial coverage
- Tell Me About Yourself ends with one STARR scenario hitting 5-8 PS criteria simultaneously
- Each individual Q&A answer: 100 words maximum
- No placeholders anywhere — every detail drawn from candidate profile and job description
- NEVER state or imply the candidate lacks experience in the vacancy specialty`

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { client_code, job_advert, job_description, person_spec } = await req.json()

  if (!client_code || !job_description || !person_spec) {
    return NextResponse.json(
      { error: 'Client code, job description, and person specification are required' },
      { status: 400 }
    )
  }

  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('client_code', client_code.trim().toUpperCase())
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found — check the code and try again' }, { status: 404 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const userPrompt = `## CANDIDATE PROFILE
Name: ${client.full_name}
Work History:
${client.work_history || 'Not provided'}

Qualifications:
${client.qualifications || 'Not provided'}

Skills:
${client.skills || 'Not provided'}

Background / Personal Statement Notes:
${client.background || 'Not provided'}

Special Instructions:
${client.special_instructions || 'None'}

---

## JOB ADVERT
${job_advert?.trim() || 'Not provided — use job description for context'}

---

## JOB DESCRIPTION
${job_description}

---

## PERSON SPECIFICATION
${person_spec}

---

Generate the complete interview preparation document with exactly these four sections:

SECTION 1: PERSON SPECIFICATION (FULL LIST)
List every criterion under: Essential Qualifications and Knowledge / Essential Experience / Essential Skills and Attributes / Desirable / Other Requirements

SECTION 2: TELL ME ABOUT YOURSELF (5 minutes)
Part 1 — Introduction: qualifications, experience summary, current role. Reference essential qualifications and experience criteria with evidence from the candidate profile.
Part 2 — Skills and Values: work through ALL remaining essential AND desirable criteria with specific examples. Every single criterion must appear. Previous role = exact vacancy title. Duties = from job description.
Part 3 — Closing STARR Scenario: one detailed Situation/Task/Action/Result/Reflection that naturally weaves in 5-8 person spec criteria as keywords. Specific, engaging, and memorable.

SECTION 3: QUESTIONS AND ANSWERS

Q1-Q10: Person Specification Questions
For each question state: (a) which PS criteria it tests, (b) a hint from the job description duties, (c) answer in 100 words max using STARR, first person, no bullet points.

Q11-Q20: Scenario-Based Questions
Each scenario tests 5 or more PS criteria simultaneously. For each state: (a) PS criteria tested (min 5), (b) hint from job description, (c) STARR answer in 100 words max, PS keywords woven naturally, no bullet points.

SECTION 4: INTERVIEW TIPS
- Key strengths to emphasise (specific to this candidate's profile)
- Clinical phrases to use naturally (drawn from the job description)
- Three smart questions to ask the panel (specific to this role and trust)`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const block = message.content[0]
    if (block.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 })
    }

    return NextResponse.json({
      content: block.text,
      clientName: client.full_name,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[interview-prep] Claude error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
