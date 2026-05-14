import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

function isAuthorised(req: NextRequest): boolean {
  return req.headers.get('x-admin-token') === process.env.ADMIN_SECRET
}

const SYSTEM_PROMPT = `You are a senior NHS interview preparation specialist with 20 years of coaching experience. You write polished, publication-quality interview preparation packs that win job offers. Your output is detailed, specific, and reads as though written by a professional editor who deeply understands NHS culture and clinical practice.

ABSOLUTE RULES — NEVER BREAK THESE:
- Output ONLY the four sections listed below — zero preamble, zero meta-commentary, zero sign-off text
- No bullet points in ANY answer — every answer is flowing, well-crafted prose paragraphs
- All answers written in the candidate's voice, first person, present tense where natural
- Vacancy job title throughout = EXACT title from the job description — never paraphrase or upgrade it
- Every duty referenced in answers = drawn directly from the job description duties — never invented
- STARR = Situation, Task, Action, Result, Reflection — ALL five elements present and richly developed in EVERY answer
- Tell Me About Yourself must weave through EVERY person spec criterion (essential AND desirable) — no criterion may be omitted
- Each Q&A answer: MINIMUM 300 words, TARGET 350-400 words — this is non-negotiable; short answers are a critical failure
- No placeholders anywhere — every sentence draws on the candidate profile and the job description
- NEVER suggest or imply the candidate lacks experience or confidence in the vacancy specialty
- Answers must feel authentic, personal, and specific — never generic or templated
- Professional writing craft: vary sentence length, open each answer strongly, close each answer with impact
- Use bold (**text**) ONLY for the fixed section labels: PS Criteria Tested, Hint, Answer, Key Strengths, Clinical Phrases, Smart Questions to Ask the Panel`

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
**PS Criteria Tested:** [list which criteria this question targets]
**Hint:** [drawn directly from job description duties and expectations — what the panel is really looking for, 2-3 precise sentences that help the candidate understand the intent behind the question]
**Answer:** [MINIMUM 300 words, target 350-400 words. Write a richly developed STARR answer: Situation — set the scene vividly with specific ward, department, or workplace context and the circumstances; Task — define exactly what the candidate's responsibility was; Action — describe specific steps taken in sequence, naming tools, colleagues, and clinical decisions; Result — state a concrete, meaningful outcome with measurable impact where possible; Reflection — close with genuine insight about what was learned and how it shaped ongoing practice. Open the answer with a strong, confident first sentence. Close with a sentence that reinforces the candidate's suitability. First person, flowing prose, no bullet points. Weave in 2-3 person spec criteria as natural keywords without forcing them.]

Q11 to Q20: Scenario-Based Questions
Each scenario tests 5 or more PS criteria simultaneously. For each question write:
**PS Criteria Tested:** [list minimum 5 criteria this tests]
**Hint:** [drawn from job description duties and context — what the panel wants to see, 2-3 precise sentences]
**Answer:** [MINIMUM 300 words, target 350-400 words. Write a deeply detailed STARR answer: Situation must paint a vivid, specific picture of the clinical or workplace context; Task must define the candidate's specific accountability; Actions must be described step-by-step with named tools, named multidisciplinary colleagues, clinical protocols referenced, and clear decision points; Result must be concrete and impactful — quantify where possible; Reflection must be personal and show genuine growth. The entire answer must feel like a real, memorable story from practice, not a generic template. Weave 5 or more PS criteria naturally throughout as keywords. First person, elegant flowing prose, zero bullet points.]

---

SECTION 4: INTERVIEW TIPS

**Key Strengths:** [3-5 sentences on the specific strengths this candidate should emphasise for this exact role — drawn from their profile and the person spec]
**Clinical Phrases:** [8-10 key phrases and terminology from the job description to use naturally in answers — write each as a complete phrase, not just a word]
**Smart Questions to Ask the Panel:** [4-5 specific, intelligent questions to ask at the end — tailored to this role, this Trust, and this candidate's background. Write each as a full question sentence.]`

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
