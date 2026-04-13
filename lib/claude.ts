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
    outputMode?: 'full' | 'statement-only' | 'analysis-only'
  }
): string {
  const isScotland = region === 'scotland'
  const isRewrite = !!(options.rewriteInstruction && options.previousStatement)
  const outputMode = options.outputMode ?? 'full'

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

  const dutiesCount = isScotland ? '6' : '8'

  // --- analysis-only: extract person spec criteria + write duties ---
  if (outputMode === 'analysis-only') {
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

  const specificQSection = options.specificQuestions
    ? `\n## SPECIFIC APPLICATION QUESTIONS - ANSWER THESE EXACTLY AS WRITTEN\n${options.specificQuestions}`
    : ''

  const instructionsSection = options.instructions
    ? `\n## ADMINISTRATOR INSTRUCTIONS\n${options.instructions}`
    : ''

  const rewriteSection = isRewrite
    ? `\n## REWRITE INSTRUCTION\nRewrite the statement below following this instruction exactly: "${options.rewriteInstruction}"\n\nPREVIOUS STATEMENT:\n${options.previousStatement}`
    : ''

  // --- statement-only: plain text output (no JSON — avoids newline-escaping failures) ---
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

HARD WORD LIMITS — stop each question at its limit and move to the next:
${isScotland ? `- Question 1: 420 words maximum
- Question 2: 420 words maximum
- Question 3: 220 words maximum — end with "Thank you." and stop` : `- Statement: 1,450 words maximum`}

CRITICAL:
- No em dashes anywhere
- All three questions must be present and complete
- Do not bold or highlight any words`
  }

  // --- full mode: single call with all fields (England/Wales and generic) ---
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
  "statement": "the complete statement text, plain text only, no bold or special formatting",
  "previousRoleDuties": ["exactly ${dutiesCount} past-tense duties from candidate's previous role"]
}

CRITICAL:
- No em dashes anywhere
- statement must be complete, never truncated
- previousRoleDuties must have exactly ${dutiesCount} items
- Never use the word Trust in duties
- essentialCriteria must list EVERY criterion from the person spec`
}

// Scotland: two parallel Claude calls to stay within Vercel's 60s limit.
// Call A (statement-only): ~1600 tokens output, ~25s generation
// Call B (analysis+duties):  ~500 tokens output,  ~8s generation
// Promise.all wall time: max(25, 8) + overhead ≈ 35s — well within 60s
async function generateScotlandParallel(
  client: Client,
  jobData: ScrapeResult,
  options: {
    instructions?: string
    specificQuestions?: string
    rewriteInstruction?: string
    previousStatement?: string
  },
  style: '1' | '2'
): Promise<{
  statement: string
  previousRoleDuties: string[]
  currentRoleDuties: string[]
  analysis: StatementAnalysis | null
  promptRegion: PromptRegion
}> {
  const region: PromptRegion = 'scotland'
  const systemPrompt = buildSystemPrompt(region, style)

  const statementUserPrompt = buildUserPrompt(client, jobData, region, {
    instructions: options.instructions,
    specificQuestions: options.specificQuestions,
    rewriteInstruction: options.rewriteInstruction,
    previousStatement: options.previousStatement,
    outputMode: 'statement-only',
  })

  const analysisUserPrompt = buildUserPrompt(client, jobData, region, {
    outputMode: 'analysis-only',
  })

  const [statementMsg, analysisMsg] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      // Q1(420w)+Q2(420w)+Q3(220w) = 1060 words ≈ 1413 tokens + headers/formatting ≈ 1500 tokens
      // 1700 cap: forces conciseness while giving Q3 room; at 65 tok/s = ~26s generation
      max_tokens: 1700,
      system: systemPrompt,
      messages: [{ role: 'user', content: statementUserPrompt }],
    }),
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      // analysis JSON (7 fields) + 6 duties ≈ 400-600 tokens; 700 cap is safe
      max_tokens: 700,
      system: 'You are an expert NHS job application analyst. Extract information accurately from the job posting and candidate profile.',
      messages: [{ role: 'user', content: analysisUserPrompt }],
    }),
  ])

  // Statement call returns plain text — no JSON parsing needed
  const statementContent = statementMsg.content[0]
  if (statementContent.type !== 'text') throw new Error('Unexpected response type from Claude')
  const statement = statementContent.text.trim().replace(/\u2014/g, '-').replace(/--/g, '-').replace(/\*\*/g, '')
  if (!statement) throw new Error('Claude returned an empty statement')

  // Parse person spec + duties (non-critical — degrade gracefully if it fails)
  let analysis: StatementAnalysis | null = null
  let previousRoleDuties: string[] = []
  const analysisContent = analysisMsg.content[0]
  if (analysisContent.type === 'text') {
    const cleanedAnalysisText = analysisContent.text.replace(/\u2014/g, '-').replace(/--/g, '-')
    const analysisJsonMatch = cleanedAnalysisText.match(/\{[\s\S]*\}/)
    if (analysisJsonMatch) {
      try {
        const analysisParsed: {
          essentialCriteria?: string[]
          desirableCriteria?: string[]
          previousRoleDuties?: string[]
        } = JSON.parse(analysisJsonMatch[0])
        previousRoleDuties = Array.isArray(analysisParsed.previousRoleDuties) ? analysisParsed.previousRoleDuties : []
        if (Array.isArray(analysisParsed.essentialCriteria) && analysisParsed.essentialCriteria.length > 0) {
          analysis = {
            jobSummary: '',
            essentialCriteria: analysisParsed.essentialCriteria,
            desirableCriteria: analysisParsed.desirableCriteria || [],
            candidateStrengths: [],
            potentialGaps: [],
            keyDuties: [],
          }
        }
      } catch { /* non-critical */ }
    }
  }

  return {
    statement,
    previousRoleDuties,
    currentRoleDuties: [],
    analysis,
    promptRegion: region,
  }
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

  // Scotland uses parallel calls to stay within Vercel's 60s serverless limit
  if (region === 'scotland') {
    return generateScotlandParallel(client, jobData, {
      instructions: options.instructions,
      specificQuestions: options.specificQuestions,
      rewriteInstruction: options.rewriteInstruction,
      previousStatement: options.previousStatement,
    }, style)
  }

  // England/Wales and generic: single call
  const systemPrompt = buildSystemPrompt(region, style)
  const userPrompt = buildUserPrompt(client, jobData, region, {
    instructions: options.instructions,
    specificQuestions: options.specificQuestions,
    rewriteInstruction: options.rewriteInstruction,
    previousStatement: options.previousStatement,
    outputMode: 'full',
  })

  // max_tokens must be high enough that JSON is never truncated.
  // England natural output ~2200 tokens (~34s at 65 tok/s) — well under 60s.
  // 3000 cap gives a safe buffer without risking truncation.
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
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

  const statement = parsed.statement.replace(/\u2014/g, '-').replace(/--/g, '-').replace(/\*\*/g, '')

  return {
    statement,
    previousRoleDuties: Array.isArray(parsed.previousRoleDuties) ? parsed.previousRoleDuties : [],
    currentRoleDuties: [],
    analysis: parsed.analysis || null,
    promptRegion: region,
  }
}
