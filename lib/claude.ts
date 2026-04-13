import Anthropic from '@anthropic-ai/sdk'
import { Client, ScrapeResult, StatementAnalysis } from './types'
import { getEnglandWalesPrompt } from './prompts/england-wales'
import { SCOTLAND_PROMPT } from './prompts/scotland'

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
  if (region === 'scotland') return SCOTLAND_PROMPT
  if (region === 'england-wales') return getEnglandWalesPrompt(style)
  return `You are an expert UK job application writer. Write a compelling supporting statement for this NHS or public sector role.
- Address every essential criterion from the person specification
- Use NHS language and terminology
- Write 800-1,200 words
- Never use em dashes. Use hyphens or commas instead
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
    outputMode?: 'statement-only' | 'analysis-only' | 'full'
  }
): string {
  const isScotland = region === 'scotland'
  const isRewrite = !!(options.rewriteInstruction && options.previousStatement)
  const outputMode = options.outputMode ?? 'full'
  const dutiesCount = isScotland ? '6' : '8'

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

  // --- analysis-only ---
  if (outputMode === 'analysis-only') {
    if (isScotland) {
      return `${jobSection}

${clientSection}

## TASK
Extract every essential and desirable criterion from the person specification. Write ${dutiesCount} past-tense key duties based on the candidate's previous role and the job description keywords.

Return ONLY a single valid JSON object - no text before or after:
{
  "essentialCriteria": ["every essential criterion from the person spec"],
  "desirableCriteria": ["desirable criteria if any"],
  "previousRoleDuties": ["exactly ${dutiesCount} past-tense duties using job description keywords"]
}

CRITICAL:
- essentialCriteria must list EVERY criterion from the person spec
- previousRoleDuties must have exactly ${dutiesCount} items
- Never use the word Trust in duties`
    }

    // England/Wales: full analysis fields
    return `${jobSection}

${clientSection}

## TASK
Analyze this job and candidate. Extract every essential and desirable criterion from the person spec. Identify candidate strengths, gaps, and the enhanced previous title. Write ${dutiesCount} past-tense key duties from the candidate's previous role using job description keywords.

Return ONLY a single valid JSON object - no text before or after:
{
  "enhancedPreviousTitle": "Senior or Lead + exact vacancy title",
  "jobSummary": "1-2 sentence role summary",
  "essentialCriteria": ["every essential criterion from the person spec"],
  "desirableCriteria": ["desirable criteria if any"],
  "candidateStrengths": ["3 specific ways this candidate matches this role"],
  "potentialGaps": ["essential criteria where evidence is thin"],
  "meetsAllEssential": true,
  "previousRoleDuties": ["exactly ${dutiesCount} past-tense duties using job description keywords"]
}

CRITICAL:
- essentialCriteria must list EVERY criterion from the person spec
- previousRoleDuties must have exactly ${dutiesCount} items
- Never use the word Trust in duties`
  }

  const specificQSection = options.specificQuestions
    ? `\n## SPECIFIC APPLICATION QUESTIONS - ANSWER THESE EXACTLY AS WRITTEN\n${options.specificQuestions}`
    : ''
  const instructionsSection = options.instructions
    ? `\n## ADMINISTRATOR INSTRUCTIONS\n${options.instructions}`
    : ''
  const rewriteSection = isRewrite
    ? `\n## REWRITE INSTRUCTION\nRewrite the statement below following this instruction exactly: "${options.rewriteInstruction}"\n\nPREVIOUS STATEMENT:\n${options.previousStatement}`
    : ''

  // --- statement-only: plain text, no JSON (avoids newline-escaping failures in long text) ---
  if (outputMode === 'statement-only') {
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

Output the statement as plain text only. Do NOT wrap in JSON. Do NOT add any preamble, explanation, or closing remarks. Start directly with the first word of the statement.

${isScotland
  ? `The statement is THREE QUESTIONS ONLY — no Key Duties section, no additional sections.

HARD WORD LIMITS — stop each question at its limit and move immediately to the next:
- Question 1: 420 words maximum
- Question 2: 420 words maximum
- Question 3: 220 words maximum — end with "Thank you." and stop`
  : `HARD WORD LIMIT: 1,450 words maximum — end with "Thank you." and stop`}

CRITICAL:
- No em dashes anywhere
- Do not bold or highlight any words`
  }

  // --- full mode: generic/civil-service single call ---
  return `${jobSection}

${clientSection}
${specificQSection}
${instructionsSection}
${rewriteSection}

## TASK
Write the supporting statement for this candidate following the format and rules in your instructions.

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
  "statement": "the complete statement text, plain text only",
  "previousRoleDuties": ["exactly ${dutiesCount} past-tense duties from candidate's previous role"]
}

CRITICAL:
- No em dashes anywhere
- statement must be complete, never truncated
- previousRoleDuties must have exactly ${dutiesCount} items
- Never use the word Trust in duties
- essentialCriteria must list EVERY criterion from the person spec`
}

// Parallel two-call approach for Scotland and England:
// Call A — statement (plain text): no JSON escaping issues, definite timing
// Call B — analysis + duties (small JSON): fast, non-critical
// Promise.all wall time = max(statement_time, analysis_time) + overhead
//   Scotland: max(1700/65≈26s, 700/65≈11s) + ~12s overhead ≈ 38s ✓
//   England:  max(2300/65≈35s, 900/65≈14s) + ~12s overhead ≈ 47s ✓
async function generateParallel(
  client: Client,
  jobData: ScrapeResult,
  options: {
    instructions?: string
    specificQuestions?: string
    rewriteInstruction?: string
    previousStatement?: string
  },
  region: 'scotland' | 'england-wales',
  style: '1' | '2'
): Promise<{
  statement: string
  previousRoleDuties: string[]
  currentRoleDuties: string[]
  analysis: StatementAnalysis | null
  promptRegion: PromptRegion
}> {
  const isScotland = region === 'scotland'
  const systemPrompt = buildSystemPrompt(region, style)

  const statementUserPrompt = buildUserPrompt(client, jobData, region, {
    ...options,
    outputMode: 'statement-only',
  })

  const analysisUserPrompt = buildUserPrompt(client, jobData, region, {
    outputMode: 'analysis-only',
  })

  const [statementMsg, analysisMsg] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      // Scotland: 1060 target words ≈ 1413 tokens → cap 1700 (26s)
      // England:  1450 target words ≈ 1933 tokens → cap 2300 (35s)
      max_tokens: isScotland ? 1700 : 2300,
      system: systemPrompt,
      messages: [{ role: 'user', content: statementUserPrompt }],
    }),
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      // Scotland: essentialCriteria + 6 duties ≈ 500 tokens → cap 700
      // England:  7 analysis fields + 8 duties  ≈ 700 tokens → cap 900
      max_tokens: isScotland ? 700 : 900,
      system: 'You are an expert NHS job application analyst. Extract information accurately from the job posting and candidate profile.',
      messages: [{ role: 'user', content: analysisUserPrompt }],
    }),
  ])

  // Statement: use raw text directly — no JSON parsing
  const statementContent = statementMsg.content[0]
  if (statementContent.type !== 'text') throw new Error('Unexpected response type from Claude')
  const statement = statementContent.text
    .trim()
    .replace(/\u2014/g, '-')
    .replace(/--/g, '-')
    .replace(/\*\*/g, '')
  if (!statement) throw new Error('Claude returned an empty statement')

  // Analysis: small JSON, non-critical — degrade gracefully if it fails
  let analysis: StatementAnalysis | null = null
  let previousRoleDuties: string[] = []
  const analysisContent = analysisMsg.content[0]
  if (analysisContent.type === 'text') {
    const cleanedAnalysis = analysisContent.text.replace(/\u2014/g, '-').replace(/--/g, '-')
    const jsonMatch = cleanedAnalysis.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const p: {
          enhancedPreviousTitle?: string
          jobSummary?: string
          essentialCriteria?: string[]
          desirableCriteria?: string[]
          candidateStrengths?: string[]
          potentialGaps?: string[]
          meetsAllEssential?: boolean
          previousRoleDuties?: string[]
        } = JSON.parse(jsonMatch[0])

        previousRoleDuties = Array.isArray(p.previousRoleDuties) ? p.previousRoleDuties : []

        if (Array.isArray(p.essentialCriteria) && p.essentialCriteria.length > 0) {
          analysis = {
            jobSummary: p.jobSummary || '',
            enhancedPreviousTitle: p.enhancedPreviousTitle,
            essentialCriteria: p.essentialCriteria,
            desirableCriteria: p.desirableCriteria || [],
            candidateStrengths: p.candidateStrengths || [],
            potentialGaps: p.potentialGaps || [],
            keyDuties: [],
            meetsAllEssential: p.meetsAllEssential,
          }
        }
      } catch { /* non-critical */ }
    }
  }

  return { statement, previousRoleDuties, currentRoleDuties: [], analysis, promptRegion: region }
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
  const callOptions = {
    instructions: options.instructions,
    specificQuestions: options.specificQuestions,
    rewriteInstruction: options.rewriteInstruction,
    previousStatement: options.previousStatement,
  }

  // Scotland and England both use parallel calls — reliable timing, no JSON escaping issues
  if (region === 'scotland' || region === 'england-wales') {
    return generateParallel(client, jobData, callOptions, region, style)
  }

  // Generic / civil-service: single call (rarely used, no strict timing requirements)
  const systemPrompt = buildSystemPrompt(region, style)
  const userPrompt = buildUserPrompt(client, jobData, region, { ...callOptions, outputMode: 'full' })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  const cleanedText = content.text.replace(/\u2014/g, '-').replace(/--/g, '-')
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

  return {
    statement: parsed.statement.replace(/\u2014/g, '-').replace(/--/g, '-').replace(/\*\*/g, ''),
    previousRoleDuties: Array.isArray(parsed.previousRoleDuties) ? parsed.previousRoleDuties : [],
    currentRoleDuties: [],
    analysis: parsed.analysis || null,
    promptRegion: region,
  }
}
