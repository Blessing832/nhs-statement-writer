import Anthropic from '@anthropic-ai/sdk'
import { Client, ScrapeResult, StatementAnalysis } from './types'
import { getEnglandWalesPrompt } from './prompts/england-wales'
import { SCOTLAND_PROMPT } from './prompts/scotland'
import { EVIDENCE_BANK } from './prompts/evidence-bank'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export type PromptRegion = 'england-wales' | 'scotland' | 'civil-service' | 'generic'

export function detectRegion(url: string): PromptRegion {
  const lower = url.toLowerCase()
  if (lower.includes('apply.jobs.scot.nhs.uk') || lower.includes('jobs.scot.nhs.uk')) {
    return 'scotland'
  }
  if (
    lower.includes('jobs.nhs.uk') ||
    lower.includes('healthjobsuk.com') ||
    lower.includes('nhsjobs') ||
    lower.includes('trac.jobs')
  ) {
    return 'england-wales'
  }
  if (lower.includes('civilservicejobs.service.gov.uk') || lower.includes('civil-service-jobs')) {
    return 'civil-service'
  }
  return 'generic'
}

function buildSystemPrompt(region: PromptRegion, style: '1' | '2'): string {
  if (region === 'scotland') {
    return SCOTLAND_PROMPT + '\n\n' + EVIDENCE_BANK
  }
  if (region === 'england-wales') {
    return getEnglandWalesPrompt(style) + '\n\n' + EVIDENCE_BANK
  }
  // civil-service / generic fallback
  return `You are an expert UK job application writer with 15+ years of experience in NHS and public sector roles.
You write compelling, highly tailored supporting statements that get candidates shortlisted.

Your statements:
- Directly address each essential and desirable criterion from the person specification
- Use NHS/Civil Service language and terminology naturally
- Follow a clear, professional structure
- Are honest and based only on the client's actual experience
- Are between 800 and 1,200 words unless otherwise specified
- Never use generic phrases — every sentence is specific to this candidate and this role

${EVIDENCE_BANK}`
}

function buildUserPrompt(
  client: Client,
  jobData: ScrapeResult,
  region: PromptRegion,
  options: {
    instructions?: string
    specificQuestions?: string
    rewriteInstruction?: string
    previousStatement?: string
  }
): string {
  const isScotland = region === 'scotland'
  const isRewrite = !!(options.rewriteInstruction && options.previousStatement)

  const jobSection = `## JOB DETAILS
Title: ${jobData.jobTitle}
Organisation: ${jobData.organisation}

## JOB DESCRIPTION & PERSON SPECIFICATION
${jobData.rawText}`

  const clientSection = `## CLIENT PROFILE
Name: ${client.full_name}

Work History:
${client.work_history}

Qualifications:
${client.qualifications}

Skills:
${client.skills}

Background & Special Information (NHS experience, tools, projects, volunteer work):
${client.background}
${client.special_instructions ? `\n## MANDATORY INSTRUCTIONS FOR THIS CLIENT — FOLLOW EXACTLY, DO NOT OVERRIDE\n${client.special_instructions}` : ''}`

  const specificQSection = options.specificQuestions
    ? `\n## SPECIFIC APPLICATION QUESTIONS (answer these instead of / in addition to the standard statement)
The candidate must answer these exact questions:
${options.specificQuestions}`
    : ''

  const instructionsSection = options.instructions
    ? `\n## ADDITIONAL INSTRUCTIONS FROM ADMINISTRATOR\n${options.instructions}`
    : ''

  const rewriteSection = isRewrite
    ? `\n## REWRITE TASK
The following statement was previously generated. Rewrite it following this instruction:
"${options.rewriteInstruction}"

PREVIOUS STATEMENT:
${options.previousStatement}`
    : ''

  const outputInstruction = isRewrite
    ? `Rewrite the statement following the instruction above. Keep everything else strong.`
    : isScotland
    ? `Write all three question answers for this NHS Scotland application.`
    : `Write a strong, tailored supporting statement for this candidate.`

  return `${jobSection}

${clientSection}
${specificQSection}
${instructionsSection}
${rewriteSection}

## YOUR TASK
${outputInstruction}

Return your response as a single JSON object with EXACTLY this structure:
{
  "analysis": {
    "jobSummary": "2-3 sentence role summary",
    "essentialCriteria": ["criterion 1", "criterion 2"],
    "desirableCriteria": ["criterion 1"],
    "keyDuties": ["duty 1", "duty 2"],
    "candidateStrengths": ["strength 1", "strength 2"],
    "potentialGaps": ["gap 1"]
  },
  "statement": "the full supporting statement text — for Scotland this contains all three question answers clearly labelled",
  "duties": ["duty 1", "duty 2", "duty 3"]
}

IMPORTANT:
- "duties" must be 6–10 concise bullet points of the key duties from the job advert
- "statement" must be the complete, ready-to-submit text — nothing truncated
- Never exceed the word limits specified in the prompt instructions
- Return ONLY valid JSON — no prose before or after the JSON`
}

export async function generateStatement(
  client: Client,
  jobData: ScrapeResult,
  options: {
    instructions?: string
    style?: '1' | '2'
    specificQuestions?: string
    rewriteInstruction?: string
    previousStatement?: string
    vacancyUrl?: string
  } = {}
): Promise<{
  statement: string
  duties: string[]
  analysis: StatementAnalysis | null
  promptRegion: PromptRegion
}> {
  const region = options.vacancyUrl ? detectRegion(options.vacancyUrl) : 'generic'
  const style = options.style || '1'

  const systemPrompt = buildSystemPrompt(region, style)
  const userPrompt = buildUserPrompt(client, jobData, region, {
    instructions: options.instructions,
    specificQuestions: options.specificQuestions,
    rewriteInstruction: options.rewriteInstruction,
    previousStatement: options.previousStatement,
  })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  // Extract JSON from response (Claude may wrap it in a code block)
  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse Claude response as JSON')

  let parsed: {
    statement: string
    duties: string[]
    analysis?: StatementAnalysis
  }

  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('Invalid JSON in Claude response')
  }

  if (!parsed.statement) throw new Error('Claude response missing statement field')

  return {
    statement: parsed.statement,
    duties: Array.isArray(parsed.duties) ? parsed.duties : [],
    analysis: parsed.analysis || null,
    promptRegion: region,
  }
}
