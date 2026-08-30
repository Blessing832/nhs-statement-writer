import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { verifyAdminToken } from '@/lib/auth'

export const maxDuration = 300

const SYSTEM_PROMPT = `You are a senior NHS interview preparation specialist with 20 years of coaching experience. You write polished, publication-quality interview preparation packs that win job offers. Your output is detailed, specific, and reads as though written by a professional editor who deeply understands NHS culture and clinical practice.

ABSOLUTE RULES — NEVER BREAK THESE:
- Output ONLY the four sections listed below — zero preamble, zero meta-commentary, zero sign-off text
- No bullet points in ANY answer — every answer is flowing, well-crafted prose paragraphs
- All answers written in the candidate's voice, first person
- Vacancy job title throughout = EXACT title from the job description — never paraphrase or upgrade it
- Every duty referenced in answers = drawn directly from the job description duties — never invented
- STARR = Situation, Task, Action, Result, Reflection — ALL five elements present in EVERY answer
- Tell Me About Yourself is split into THREE clearly labelled parts: Part 1 (80 words max), Part 2 (150 words max), Part 3 (100 words max) — word limits are strict
- Part 2 covers the top 5 to 6 essential criteria only — not every criterion
- After Part 3, add a PS Coverage Checklist table covering ALL essential and desirable criteria
- Each Q&A answer: 100 words max — this is non-negotiable
- No placeholders anywhere — every sentence draws on the candidate profile and the job description
- NEVER suggest or imply the candidate lacks experience or confidence in the vacancy specialty
- Answers must feel authentic, personal, and specific — never generic or templated
- Use bold (**text**) ONLY for the fixed section labels: PS Criteria Tested, Hint, Answer, Key Strengths, Clinical Phrases, Smart Questions to Ask the Panel

QUALIFICATION MATCHING RULE — APPLIES TO ALL SECTIONS:
- Before listing any qualification, check it against the person specification and the band/role level
- Only include qualifications that are relevant or required for this specific role
- Do not list postgraduate degrees, management qualifications, or advanced certifications unless the person spec explicitly requires or values them
- For Band 2 to 3 support worker roles: list care certificates, NVQs, and relevant short courses
- For Band 5 nursing roles: list NMC registration and nursing degree
- For Band 6 and above: include specialist or leadership qualifications only if the person spec calls for them
- If the candidate holds higher qualifications than the role requires, mention them briefly only where they add value — e.g. "I also hold a postgraduate qualification which has strengthened my understanding of service delivery" — do not list the full title unless directly relevant`

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) {
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

SECTION 2: TELL ME ABOUT YOURSELF (3 minutes)

Split into three clearly labelled parts. Apply the Qualification Matching Rule to every qualification mentioned.

**Part 1: Introduction (80 words max)**
Cover qualifications, experience summary, and current role. Reference essential qualifications and experience criteria from the person spec with evidence. No bullet points. First person.

**Part 2: Skills and Values (150 words max)**
Cover the top 5 to 6 essential criteria only. Use STARR method. One to two sentences per criterion. Previous role = exact vacancy title from the job description. Duties = drawn from the job description. No bullet points. First person.

**Part 3: Closing STARR Scenario (100 words max)**
One detailed STARR scenario that naturally weaves in 5 to 8 person specification criteria as keywords. It should feel like a real moment from practice. Specific, engaging, and leaves a strong final impression. No bullet points. First person.

**PS Coverage Checklist Table (after Part 3)**
Add a two-column table immediately after Part 3.
Column 1: PS criterion (every essential and desirable criterion).
Column 2: One-line evidence point drawn from the candidate profile.
Label the table: "PS Coverage Checklist - For Revision Only, Not for Speaking."

---

SECTION 3: QUESTIONS AND ANSWERS

Q1 to Q10: Person Specification Questions
One question per PS criterion or related group of criteria. For each question write:
**PS Criteria Tested:** [list which criteria this question targets]
**Hint:** [drawn directly from job description duties and expectations — what the panel is really looking for, 1-2 precise sentences]
**Answer:** [100 words max. STARR method, concrete NHS evidence, first person, no bullet points. Apply the Qualification Matching Rule to any qualifications mentioned.]

Q11 to Q20: Scenario-Based Questions
Each scenario tests 5 or more PS criteria simultaneously. For each question write:
**PS Criteria Tested:** [list minimum 5 criteria this tests]
**Hint:** [drawn from job description duties and context — 1-2 precise sentences]
**Answer:** [100 words max. STARR method, PS keywords woven naturally into the answer, first person, no bullet points.]

---

SECTION 4: INTERVIEW TIPS

**Key Strengths:** [3-5 sentences on the specific strengths this candidate should emphasise for this exact role — drawn from their profile and the person spec]
**Clinical Phrases:** [8-10 key phrases and terminology from the job description to use naturally in answers — write each as a complete phrase, not just a word]
**Smart Questions to Ask the Panel:** [3 specific, intelligent questions to ask at the end — tailored to this role, this Trust, and this candidate's background. Write each as a full question sentence.]`

  const enc = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const msgStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 32000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        })

        for await (const event of msgStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ t: event.delta.text })}\n\n`))
          }
        }

        controller.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, clientName: client.full_name })}\n\n`))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error('[interview-prep] stream error:', msg)
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
