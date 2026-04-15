import Anthropic from '@anthropic-ai/sdk'
import { Client, ScrapeResult, StatementAnalysis } from './types'
import { getEnglandWalesPrompt } from './prompts/england-wales'
import { SCOTLAND_PROMPT } from './prompts/scotland'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export type PromptRegion = 'england-wales' | 'scotland' | 'civil-service' | 'generic'
export type ApplicationMode = 'full' | 'questions-only' | 'statement-questions'

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

// Smart truncation: take first 12,000 chars (JD) + last 6,000 chars (PS is usually at the bottom).
// Total = 18,000 chars = same token budget, but now captures person spec tables at the end of PDF documents.
function buildRawText(rawText: string): string {
  if (rawText.length <= 18000) return rawText
  const start = rawText.slice(0, 12000)
  const end = rawText.slice(-6000)
  return (
    start +
    '\n\n[...middle of document omitted — continuing from near end of document where person specification appears...]\n\n' +
    end
  )
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
    outputMode?: 'statement-only' | 'questions-only' | 'analysis-only' | 'full'
    applicationMode?: ApplicationMode
  }
): string {
  const isScotland = region === 'scotland'
  const isRewrite = !!(options.rewriteInstruction && options.previousStatement)
  const outputMode = options.outputMode ?? 'full'
  const dutiesCount = isScotland ? '6' : '8'
  const rawText = buildRawText(jobData.rawText)

  const jobSection = `## JOB DETAILS
Title: ${jobData.jobTitle}
Organisation: ${jobData.organisation}

## FULL JOB DESCRIPTION AND PERSON SPECIFICATION
IMPORTANT: The person specification may appear at the END of this document — read the entire text carefully.
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

  // --- analysis-only: extract criteria + duties ---
  if (outputMode === 'analysis-only') {
    if (isScotland) {
      return `${jobSection}

${clientSection}

## TASK
Extract every essential and desirable criterion from the person specification. The person spec may be in a table at the END of the document — check thoroughly. Write ${dutiesCount} past-tense key duties based on the candidate's previous role and the job description keywords.

Return ONLY a single valid JSON object - no text before or after:
{
  "essentialCriteria": ["every essential criterion from the person spec"],
  "desirableCriteria": ["desirable criteria if any"],
  "previousRoleDuties": ["exactly ${dutiesCount} past-tense duties using job description keywords"]
}

CRITICAL:
- essentialCriteria must list EVERY criterion from the person spec — check ALL of the document including the end
- previousRoleDuties must have exactly ${dutiesCount} items
- Never use the word Trust in duties`
    }

    return `${jobSection}

${clientSection}

## TASK
Extract every essential and desirable criterion from the person specification. The person spec may be in a table at the END of the document — read ALL of the text carefully. Identify the Trust's named values from the job description. Write ${dutiesCount} past-tense key duties from the candidate's previous role.

Return ONLY a single valid JSON object - no text before or after:
{
  "enhancedPreviousTitle": "Senior or Lead + exact vacancy title",
  "jobSummary": "1-2 sentence role summary",
  "essentialCriteria": ["every essential criterion from the person spec"],
  "desirableCriteria": ["desirable criteria if any"],
  "potentialGaps": ["essential criteria where candidate evidence is thin"],
  "meetsAllEssential": true,
  "previousRoleDuties": ["exactly ${dutiesCount} past-tense duties using job description keywords"]
}

CRITICAL:
- essentialCriteria must list EVERY criterion — check ALL of the document including the end
- previousRoleDuties must have exactly ${dutiesCount} items
- Never use the word Trust in duties`
  }

  const specificQSection = options.specificQuestions
    ? `\n## SPECIFIC APPLICATION QUESTIONS\n${options.specificQuestions}`
    : ''
  const instructionsSection = options.instructions
    ? `\n## ADMINISTRATOR INSTRUCTIONS\n${options.instructions}`
    : ''
  const rewriteSection = isRewrite
    ? `\n## REWRITE INSTRUCTION\nRewrite the statement below following this instruction exactly: "${options.rewriteInstruction}"\n\nPREVIOUS STATEMENT:\n${options.previousStatement}`
    : ''

  // --- questions-only: answer each specific question with STAR evidence ---
  if (outputMode === 'questions-only') {
    return `${jobSection}

${clientSection}
${instructionsSection}

## TASK
Answer each of the following specific application questions. Do NOT write a full prose statement. Answer each question directly with specific STAR evidence.

For each question:
- Write 200-250 words per answer
- Use MINI-STAR: specific situation, specific actions (naming tools/systems/roles from the JD), quantified result
- Use ONLY evidence from the candidate profile above
- Reference the Trust's values and terminology from the job description where relevant
- No em dashes anywhere

Format — write the question heading exactly as given, then the answer directly below:

[Question heading exactly as written]
[200-250 word STAR answer]

[Next question heading]
[200-250 word answer]

End the final answer with "Thank you."
Do NOT add any introduction, summary, or text outside the answers.

QUESTIONS TO ANSWER:
${options.specificQuestions || ''}`
  }

  // --- statement-only: full prose statement, plain text ---
  if (outputMode === 'statement-only') {
    const hasExtraQuestions = !!(options.specificQuestions && options.applicationMode === 'statement-questions')
    const outputInstruction = isRewrite
      ? 'Rewrite the statement following the instruction. Keep all strong content. Improve what was asked.'
      : isScotland
      ? 'Write all three question answers for this NHS Scotland application following the three-question format in your instructions.'
      : hasExtraQuestions
      ? 'Write the full supporting statement following your instructions, then write a separate answer for each specific question below (200-250 words each, STAR evidence).'
      : 'Write the supporting statement for this candidate following the format and rules in your instructions.'

    return `${jobSection}

${clientSection}
${specificQSection}
${instructionsSection}
${rewriteSection}

## TASK
${outputInstruction}

Output as plain text only. Do NOT wrap in JSON. Do NOT add any preamble. Start directly with the first word.

${isScotland
  ? `The statement is THREE QUESTIONS ONLY — no Key Duties section.

HARD WORD LIMITS:
- Question 1: 420 words maximum
- Question 2: 420 words maximum
- Question 3: 220 words maximum — end with "Thank you." and stop`
  : `HARD WORD LIMIT: 1,450 words for the main statement — end with "Thank you."
${hasExtraQuestions ? 'After "Thank you.", write each specific question answer (200-250 words each) with the question as a heading.' : ''}`}

CRITICAL:
- No em dashes anywhere
- Do not bold or highlight any words
- Person specification: address EVERY essential criterion — they may appear at the end of the attached document`
  }

  // --- full mode: generic/civil-service single call ---
  return `${jobSection}

${clientSection}
${specificQSection}
${instructionsSection}
${rewriteSection}

## TASK
Write the supporting statement for this candidate.

Return ONLY a single valid JSON object:
{
  "analysis": {
    "jobSummary": "1-2 sentence role summary",
    "enhancedPreviousTitle": "Senior or Lead + exact vacancy title",
    "essentialCriteria": ["every essential criterion from the person spec"],
    "desirableCriteria": ["desirable criteria if any"],
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
// Call A — statement (plain text): no JSON escaping issues, reliable output
// Call B — analysis + duties (small flat JSON): fast, non-critical
// Promise.all wall time:
//   Scotland: max(1700/65≈26s, 700/65≈11s) + ~12s overhead ≈ 38s ✓
//   England:  max(2300/65≈35s, 900/65≈14s) + ~12s overhead ≈ 47s ✓
//   Questions-only: max(2000/65≈31s, 700-900/65≈11-14s) + ~12s ≈ 43s ✓
async function generateParallel(
  client: Client,
  jobData: ScrapeResult,
  options: {
    instructions?: string
    specificQuestions?: string
    rewriteInstruction?: string
    previousStatement?: string
    applicationMode?: ApplicationMode
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
  const appMode = options.applicationMode ?? 'full'
  const systemPrompt = buildSystemPrompt(region, style)

  // Determine statement output mode
  const statementOutputMode =
    appMode === 'questions-only' ? 'questions-only' : 'statement-only'

  const statementUserPrompt = buildUserPrompt(client, jobData, region, {
    ...options,
    outputMode: statementOutputMode,
  })

  const analysisUserPrompt = buildUserPrompt(client, jobData, region, {
    outputMode: 'analysis-only',
  })

  // max_tokens for statement call:
  //   Scotland: 1060w target → cap 1700 (26s)
  //   England full: 1450w target → cap 2300 (35s)
  //   Questions-only: ~6 questions × 225w ≈ 1350w → cap 2000 (31s)
  let statementMaxTokens: number
  if (appMode === 'questions-only') {
    statementMaxTokens = 2000
  } else if (isScotland) {
    statementMaxTokens = 1700
  } else {
    statementMaxTokens = 2300
  }

  const [statementMsg, analysisMsg] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: statementMaxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: statementUserPrompt }],
    }),
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: isScotland ? 700 : 900,
      system: 'You are an expert NHS job application analyst. Extract information accurately from the job posting and candidate profile. The person specification may appear at the END of the document — read all of it.',
      messages: [{ role: 'user', content: analysisUserPrompt }],
    }),
  ])

  // Statement: plain text, use directly
  const statementContent = statementMsg.content[0]
  if (statementContent.type !== 'text') throw new Error('Unexpected response type from Claude')
  const statement = statementContent.text
    .trim()
    .replace(/\u2014/g, '-')
    .replace(/--/g, '-')
    .replace(/\*\*/g, '')
  if (!statement) throw new Error('Claude returned an empty statement')

  // Analysis: small JSON, non-critical
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
            candidateStrengths: [],
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
    applicationMode?: ApplicationMode
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
    applicationMode: options.applicationMode ?? 'full',
  }

  if (region === 'scotland' || region === 'england-wales') {
    return generateParallel(client, jobData, callOptions, region, style)
  }

  // Generic / civil-service: single call
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
