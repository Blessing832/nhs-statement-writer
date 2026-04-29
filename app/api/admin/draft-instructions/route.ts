import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { verifyAdminToken } from '@/lib/auth'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { full_name, work_history, qualifications, skills, background } = await req.json()

  if (!full_name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const prompt = `You are helping an NHS job application service set up unique personalisation instructions for each candidate. These instructions ensure every candidate's statements have a distinct voice, tone, and focus — they do NOT override core writing rules, they ADD personal colour on top of them.

## CANDIDATE PROFILE
Name: ${full_name}

Work History:
${work_history || 'Not provided'}

Qualifications:
${qualifications || 'Not provided'}

Skills / Trainings:
${skills || 'Not provided'}

Background / Notes:
${background || 'Not provided'}

---

Write personalisation instructions (180-220 words) that will make this candidate's NHS supporting statements sound uniquely like them. Cover ALL five areas below:

1. TONE — one clear phrase describing their writing voice (e.g. "warm and reflective", "direct and clinical", "confident and action-led", "formal and precise"). This should feel true to their background.

2. KEY FACTS TO ALWAYS WEAVE IN — specific workplaces, named qualifications, registrations, certifications, IT systems, awards, or achievements unique to this person. Name them exactly as they appear in the profile.

3. VOLUNTEER / LIFE SKILLS — look at their training history, background, and any non-clinical activities. Identify 1-3 volunteer experiences, community roles, life skills, or personal development activities that can be referenced naturally in statements to add human depth (e.g. "references First Aid volunteering at church", "mentions mentoring junior colleagues informally", "references caring for a family member as a life experience that shaped their compassion").

4. WRITING EMPHASIS — which aspect of their background to lead with and what to give most paragraph space to. Be specific about which role or experience is their strongest evidence base.

5. DIFFERENTIATOR — one sentence on what genuinely sets this candidate apart from other applicants with similar backgrounds.

Write in second-person imperative ("Always mention...", "Lead with...", "Reference...").
Be specific — nothing here should apply to any other candidate.
Output only the instructions — no preamble, no headings, no explanation.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
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
