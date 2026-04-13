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
    return SCOTLAND_PROMPT
  }
  if (region === 'england-wales') {
    return getEnglandWalesPrompt(style)
  }
  return `You are an expert UK job application writer. Write a compelling supporting statement for this NHS or public sector role.
- Address every essential criterion from the person specification
- Use NHS language and terminology
- Write 800-1,200 words
- Never use em dashes (--). Use hyphens (-) or commas instead
- Never fabricate experience`
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

  // Truncate rawText to keep total input tokens manageable for the 60s Vercel limit.
  // NHS job adverts with PDFs can be 50,000+ chars; 18,000 chars (~4,500 tokens) captures
  // the full person spec and job description for all typical postings.
  const rawText = jobData.rawText.length > 18000
    ? jobData.rawText.slice(0, 18000) + '\n\n[Text truncated for processing — person spec and key criteria above are complete]'
    : jobData.rawText

  const jobSection = `## JOB DETAILS
Title: ${jobData.jobTitle}
Organisation: ${jobData.organisation}

## FULL JOB DESCRIPTION AND PERSON SPECIFICATION (extract ALL criteria from here)
${rawText}`

  const clientSection = `## CANDIDATE PROFILE
Full Name: ${client.full_name}

Work History:
${client.work_history}

Qualifications (include GCSE/O-level grades exactly as listed):
${client.qualifications}

Skills:
${client.skills}

Background and Additional Information:
${client.background}
${client.special_instructions ? `\n## MANDATORY CLIENT-SPECIFIC INSTRUCTIONS - OVERRIDE ALL OTHER RULES WHERE THEY CONFLICT\n${client.special_instructions}` : ''}`

  const specificQSection = options.specificQuestions
    ? `\n## SPECIFIC APPLICATION QUESTIONS - ANSWER THESE EXACTLY AS WRITTEN\n${options.specificQuestions}`
    : ''

  const instructionsSection = options.instructions
    ? `\n## ADMINISTRATOR INSTRUCTIONS\n${options.instructions}`
    : ''

  const rewriteSection = isRewrite
    ? `\n## REWRITE INSTRUCTION\nRewrite the statement below following this instruction exactly: "${options.rewriteInstruction}"\n\nPREVIOUS STATEMENT:\n${options.previousStatement}`
    : ''

  const outputInstruction = isRewrite
    ? 'Rewrite the statement following the instruction. Keep all strong content. Improve what was asked.'
    : isScotland
    ? 'Write all three question answers for this NHS Scotland application following the three-question format in your instructions.'
    : 'Write the supporting statement for this candidate following the format and rules in your instructions.'

  return `${jobSection}

${clientSection}
${specificQSection}
${instructionsSection}
${rewriteSection}

## TASK
${outputInstruction}

Return ONLY a single valid JSON object - no text before or after:
{
  "analysis": {
    "jobSummary": "1-2 sentence role summary",
    "enhancedPreviousTitle": "Senior or Lead + exact vacancy title",
    "essentialCriteria": ["every essential criterion from the person spec"],
    "desirableCriteria": ["desirable criteria if any"],
    "candidateStrengths": ["3 specific ways this candidate matches this role"],
    "potentialGaps": ["essential criteria where evidence is thin"],
    "meetsAllEssential": true
  },
  "statement": "the complete statement text with **bold** around key achievements",
  "previousRoleDuties": ["exactly ${isScotland ? '5' : '8'} past-tense duties from candidate's previous role"]
}

CRITICAL:
- No em dashes anywhere
- statement must be complete, never truncated
- previousRoleDuties must have exactly ${isScotland ? '5' : '8'} items
- Never use the word Trust in duties
- essentialCriteria must list EVERY criterion from the person spec`
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
  previousRoleDuties: string[]
  currentRoleDuties: string[]
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

  // Scotland 3-question: ~1900 tokens output target; England: ~2200 tokens.
  // Hard cap prevents the 60s Vercel timeout (Sonnet outputs ~65 tok/s).
  const maxTokens = region === 'scotland' ? 2200 : 2600

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  // Strip em dashes from output as a safety net
  const cleanedText = content.text.replace(/\u2014/g, '-').replace(/--/g, '-')

  // Extract JSON
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse Claude response as JSON')

  let parsed: {
    statement: string
    previousRoleDuties?: string[]
    analysis?: StatementAnalysis & { meetsAllEssential?: boolean }
  }

  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('Invalid JSON in Claude response')
  }

  if (!parsed.statement) throw new Error('Claude response missing statement field')

  const statement = parsed.statement.replace(/\u2014/g, '-').replace(/--/g, '-')

  return {
    statement,
    previousRoleDuties: Array.isArray(parsed.previousRoleDuties) ? parsed.previousRoleDuties : [],
    currentRoleDuties: [],
    analysis: parsed.analysis || null,
    promptRegion: region,
  }
}
