import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { verifyAdminToken } from '@/lib/auth'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { full_name, work_history, qualifications, skills, background } = await req.json()

  if (!full_name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const prompt = `You are helping an NHS job application service set up unique writing instructions for each candidate.

## CANDIDATE PROFILE
Name: ${full_name}

Work History:
${work_history || 'Not provided'}

Qualifications:
${qualifications || 'Not provided'}

Skills:
${skills || 'Not provided'}

Background / Notes:
${background || 'Not provided'}

---

Write a concise set of special instructions (150-200 words) that will make this candidate's NHS supporting statements sound unique and authentic to them specifically. These instructions will be injected into every statement generated for this person.

Cover:
1. TONE — e.g. "warm and reflective", "direct and clinical", "confident and action-led", "formal and evidence-heavy"
2. KEY FACTS TO ALWAYS MENTION — specific workplaces, qualifications, registrations, achievements, systems they've used that are unique to them
3. WRITING EMPHASIS — what experiences or strengths to lead with based on their background
4. ANY RESTRICTIONS — word limits, formatting rules, things to avoid or always include
5. WHAT MAKES THEM STAND OUT — one or two things that differentiate this candidate from a generic NHS applicant

Write the instructions in second-person imperative ("Always mention...", "Lead with...", "Emphasise...").
Be specific to this person — do not write generic advice that could apply to anyone.
Output only the instructions themselves — no preamble, no explanation.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = message.content[0]
    if (block.type !== 'text') return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })

    return NextResponse.json({ draft: block.text.trim() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
