import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

function isAuthorised(req: NextRequest): boolean {
  return req.headers.get('x-admin-token') === process.env.ADMIN_SECRET
}

const SYSTEM_PROMPT = `You are an expert NHS interview preparation coach. Generate comprehensive, candidate-specific interview preparation materials following the exact structure and rules below.

ABSOLUTE RULES:
- Output ONLY the four sections listed below — no preamble, no commentary, no meta-text
- No bullet points in any answer — all answers written in flowing prose paragraphs
- All answers written in the candidate's voice, first person
- Previous role throughout = EXACT vacancy job title from the job description (not enhanced, not modified)
- Duties referenced in answers = drawn directly from the job description duties, never invented
- STARR = Situation, Task, Action, Result, Reflection
- Tell Me About Yourself must cover ALL person spec criteria, essential AND desirable — not partial coverage
- Tell Me About Yourself ends with one full STARR scenario naturally weaving in 5-8 PS criteria as keywords
- Each individual Q&A answer: 100 words maximum
- No placeholders anywhere — every detail drawn from candidate profile and job description
- NEVER state or imply the candidate lacks experience in the vacancy specialty`

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { client_code, jd_and_ps } = await req.json()

  if (!client_code || !jd_and_ps) {
    return NextResponse.json(
      { error: 'Client code and job description / person specification are required' },
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

## JOB DESCRIPTION AND PERSON SPECIFICATION
${jd_and_ps}

---

Generate the complete interview preparation document with EXACTLY these four sections. Follow every rule below precisely.

---

SECTION 1: PERSON SPECIFICATION (FULL LIST)

List every criterion under these exact headers (do not skip any criteria):
Essential Qualifications and Knowledge:
Essential Experience:
Essential Skills and Attributes:
Desirable:
Other Requirements:

---

SECTION 2: TELL ME ABOUT YOURSELF (5 minutes)

This answer covers ALL person spec criteria — essential and desirable. Write in continuous prose, no bullet points, first person, STARR method throughout.

Part 1 - Introduction
Cover qualifications, experience summary, and current role. Reference essential qualifications and experience criteria from the person spec with specific evidence from the candidate profile.

Part 2 - Skills and Values
Work through ALL remaining essential AND desirable criteria with specific examples from the candidate profile. Every single criterion must appear — no partial coverage. Previous role = exact vacancy title from the job description. All duties = drawn from the job description duties.

Part 3 - Closing STARR Scenario
One detailed Situation/Task/Action/Result/Reflection that naturally weaves in 5-8 person spec criteria as keywords within the answer. Specific, engaging, and memorable. Should feel like a real moment from practice that brings everything together and leaves the panel with a strong final impression. Write in prose, no bullet points.

---

SECTION 3: QUESTIONS AND ANSWERS

Q1 to Q10: Person Specification Questions
One question per PS criterion or related group of criteria. For each question write:
PS Criteria Tested: [list which criteria this question targets]
Hint: [drawn directly from job description duties and expectations — what to focus on]
Answer: [100 words max, STARR method, concrete evidence from candidate profile, first person, no bullet points, flowing prose]

Q11 to Q20: Scenario-Based Questions
Each scenario tests 5 or more PS criteria simultaneously. For each question write:
PS Criteria Tested: [list minimum 5 criteria this tests]
Hint: [drawn from job description duties and context]
Answer: [100 words max, STARR method, PS keywords woven naturally into the answer, first person, no bullet points, flowing prose]

---

SECTION 4: INTERVIEW TIPS

Key Strengths: [specific strengths to emphasise based on this candidate's profile and this role — 3-5 sentences]
Clinical Phrases: [key phrases and terminology to use naturally in answers, drawn from the job description — list 6-8 phrases]
Smart Questions to Ask the Panel: [3 specific, intelligent questions relevant to this role and trust — write each as a full question sentence]`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
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
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[interview-prep] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
