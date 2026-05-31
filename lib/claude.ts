import Anthropic from '@anthropic-ai/sdk'
import { Client, ScrapeResult, StatementAnalysis } from './types'
import { getEnglandWalesPrompt } from './prompts/england-wales'
import { getScotlandPrompt } from './prompts/scotland'
import { getScotlandQ2Variation } from './scotland-q2-variations'
import { fetchTrustIntel, formatTrustIntel } from './trust-intel'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isOverloaded =
        err instanceof Anthropic.APIError &&
        (err.status === 529 || err.type === 'overloaded_error')
      if (isOverloaded && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error('unreachable')
}

export type PromptRegion = 'england-wales' | 'scotland' | 'civil-service' | 'generic'
export type ApplicationMode = 'full' | 'questions-only' | 'statement-questions'

export function detectRegion(url: string, rawText?: string): PromptRegion {
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
  // For text-paste mode, auto-detect region from content
  if (lower === 'text-paste' && rawText) {
    const t = rawText.toLowerCase()
    if (
      t.includes('nhs scotland') ||
      t.includes('nhs board') ||
      t.includes('why do you want to work in nhs scotland') ||
      t.includes('apply.jobs.scot.nhs.uk')
    ) {
      return 'scotland'
    }
    if (t.includes('nhs') || t.includes('foundation trust') || t.includes('nhs trust')) {
      return 'england-wales'
    }
  }
  return 'generic'
}

function buildSystemPrompt(region: PromptRegion, style: '1' | '2'): string {
  if (region === 'scotland') return getScotlandPrompt(style)
  if (region === 'england-wales') return getEnglandWalesPrompt(style)
  return `You are an expert UK job application writer. Write a compelling supporting statement for this NHS or public sector role.
- Address every essential criterion from the person specification
- Use NHS language and terminology
- Write 800-1,200 words
- Never use em dashes. Use hyphens or commas instead
- Never fabricate experience`
}

// Smart truncation: take first 8,000 chars (JD intro + duties) + last 16,000 chars
// (person spec JDPS table is almost always at the END of NHS documents).
// Total = 24,000 chars — extra chars go to the end to capture full JDPS tables.
function buildRawText(rawText: string): string {
  if (rawText.length <= 24000) return rawText
  const start = rawText.slice(0, 8000)
  const end = rawText.slice(-16000)
  return (
    start +
    '\n\n[...middle section omitted to fit context; continuing from near end of document where the JDPS person specification table typically appears...]\n\n' +
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
    openingFormatHint?: string
    yearsHint?: string
    bodyPattern?: string
    style?: '1' | '2'
    trustIntelText?: string
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
${rawText}${options.trustIntelText ? '\n\n' + options.trustIntelText : ''}`

  const intakeAnswers = [
    client.q_difficult_situation ? `Difficult situation handled: ${client.q_difficult_situation}` : '',
    client.q_why_trust ? `Why this trust/organisation: ${client.q_why_trust}` : '',
    client.q_colleagues_say ? `What colleagues say: ${client.q_colleagues_say}` : '',
    client.q_proudest_moment ? `Proudest professional moment: ${client.q_proudest_moment}` : '',
    client.q_skills_equipment ? `Specialist skills and equipment: ${client.q_skills_equipment}` : '',
  ].filter(Boolean).join('\n\n')

  const clientSection = `## CANDIDATE PROFILE
Full Name: ${client.full_name ?? ''}

Work History:
${client.work_history ?? ''}

Qualifications (include GCSE/O-level grades exactly as listed):
${client.qualifications ?? ''}

Skills:
${client.skills ?? ''}

Background and Additional Information:
${client.background ?? ''}
${intakeAnswers ? `\n## CANDIDATE PERSONAL STORIES — USE THESE FOR AUTHENTIC DETAIL\nThe candidate has answered these questions in their own words. Draw on them to add specific, genuine detail to the statement — especially for evidence-based paragraphs, the "why this trust" section, and any question about personal qualities or working under pressure. Do NOT quote them verbatim; weave the content naturally into the statement.\n\n${intakeAnswers}` : ''}${client.special_instructions ? `\n## CANDIDATE PERSONALISATION — APPLY ALONGSIDE ALL OTHER RULES\nThese instructions give this specific candidate a unique voice and focus. Follow them to personalise tone, emphasis, and content. They do NOT override the writing rules above — they add individual character on top of them.\n${client.special_instructions}` : ''}${client.opening_style ? `\n\n## OPENING SENTENCE STYLE — MANDATORY\nUse this exact structure for the opening sentence/paragraph of the statement. Fill in the placeholders from the job advert and candidate profile. Do not deviate from this pattern.\n${client.opening_style}` : ''}${(() => { const v = isScotland && client.scotland_q2_variation ? getScotlandQ2Variation(client.scotland_q2_variation) : null; return v ? `\n\n## Q2 NHS SCOTLAND PRESET — MANDATORY\nThe paragraph below is pre-approved for this candidate's Q2 "why NHS Scotland" section. Follow these rules exactly:\n1. Use this text as the first paragraph of Question 2 — it replaces the NHS Scotland values paragraph entirely\n2. Lightly personalise it: replace generic phrases such as "my previous role", "current role", "previous healthcare role" with this candidate's actual job title and workplace from their profile. Replace "current role" references with their actual current role. Keep all key phrases, sentences, and the overall message intact.\n3. After this paragraph, write approximately 100 words on why this candidate specifically wants to work for NHS [Board] — name the Board, reference its specific services, geography, or strategic priorities from the job advert\n4. Then use the remaining Q2 word budget to address person specification criteria\n5. Total Q2 must not exceed 420 words\n\nPRESET TEXT (personalise as instructed above):\n${v.text}` : '' })()}`

  // --- analysis-only: extract criteria + duties ---
  if (outputMode === 'analysis-only') {
    if (isScotland) {
      return `${jobSection}

${clientSection}

## TASK
Extract EVERY essential and desirable criterion from the person specification.

NHS JDPS PERSON SPEC FORMAT WARNING:
The person spec is usually a TWO-COLUMN TABLE (Essential | Desirable). When extracted as plain text, the two columns INTERLEAVE — you will see essential and desirable items mixed together line by line. Read every line and classify it. The JDPS typically covers ALL of these sections — extract criteria from every section:
1. Education / Qualifications
2. Experience
3. Special Aptitude and Abilities / Computing / Admin skills
4. Disposition / Personal qualities
5. Physical Requirements / Abilities
6. Particular Requirements of the Post / Compliance

MINIMUM EXPECTATION: NHS JDPS documents contain 20-40 essential criteria. If you find fewer than 15, you have missed sections — re-read the ENTIRE document. Do not stop after finding 5-10 criteria.

Return ONLY a single valid JSON object - no text before or after:
{
  "previousRoleDuties": ["exactly ${dutiesCount} duties — see rules below"],
  "essentialCriteria": ["every essential criterion from the person spec — expect 20-40 items"],
  "desirableCriteria": ["desirable criteria if any"]
}

DUTIES RULES — read every rule before writing a single duty:
Every duty must be a PURE TASK SENTENCE. Even though you can see employer names and organisation names in the candidate profile above, you MUST NOT include any of them in the duties list. Not at the start, not at the end, not in a sub-clause.

WRONG — contains organisation or location reference (never do this):
"Supported service users in care planning within the Sirona Care and Health CIC NHS setting."
"Maintained records using Care Vision at ACE Healthcare Ltd."
"Delivered patient care across the Bristol Royal Infirmary inpatient wards."

CORRECT — pure task, zero organisation or location reference:
"Supported service users and carers to participate in care planning discussions, ensuring their views informed day-to-day service delivery."
"Maintained accurate involvement records and documentation using electronic care record systems."
"Delivered personal care to patients, maintaining dignity and privacy at all times."

RULES:
- Start every duty with a past tense verb: Assisted, Supported, Delivered, Monitored, Documented, Escalated, Participated, Undertook, Maintained, Coordinated, Gathered, Promoted, Performed...
- Mirror the EXACT task vocabulary and keywords from the vacancy job description
- Each duty: one sentence, 20-35 words, no location or employer reference anywhere
- NEVER write the word "NHS" in any duty — not "NHS standards", not "NHS Trust", not "NHS guidelines", not "NHS Care Certificate", not "NHS Direct", nothing
- NEVER name any employer, hospital, Board, company, care home, department, ward, or geographic location — this includes Southmead Hospital, Bristol Royal Infirmary, and every other named hospital worldwide
- NEVER name any UK-specific healthcare software or EHR system: SystmOne, Lorenzo, Datix, EMIS, RiO, PARIS, TrakCare, CERNER, PAS, Electronic Prescribing System by brand name — write "electronic patient record system", "clinical information system", or "medication management system" instead
- NEVER reference NHS pay bands (Band 3, Band 5, Band 7, etc.) or UK job grades
- NEVER name specific UK training programmes or certificates (Oliver McGowan Training, NHS Care Certificate, Safeguarding Level 2, etc.) — describe the skill generically instead
- Previous role duties ONLY — do not describe the current role`
    }

    return `${jobSection}

${clientSection}

## TASK
Extract EVERY essential and desirable criterion from the person specification. Identify the Trust's named values from the job description.

NHS JDPS PERSON SPEC FORMAT WARNING:
The person spec is usually a TWO-COLUMN TABLE (Essential | Desirable). When extracted as plain text, the two columns INTERLEAVE — you will see essential and desirable items mixed together line by line. Read every line and classify it. The JDPS typically covers ALL of these sections — extract criteria from every section:
1. Education / Qualifications
2. Experience
3. Special Aptitude and Abilities / Computing / Admin skills
4. Disposition / Personal qualities
5. Physical Requirements / Abilities
6. Particular Requirements of the Post / Compliance

MINIMUM EXPECTATION: NHS JDPS documents contain 20-40 essential criteria. If you find fewer than 15, you have missed sections — re-read the ENTIRE document.

Return ONLY a single valid JSON object - no text before or after:
{
  "previousRoleDuties": ["exactly ${dutiesCount} duties — see rules below"],
  "enhancedPreviousTitle": "Senior or Lead + exact vacancy title",
  "jobSummary": "1-2 sentence role summary",
  "essentialCriteria": ["every essential criterion from the person spec — expect 20-40 items"],
  "desirableCriteria": ["desirable criteria if any"],
  "meetsAllEssential": true
}

DUTIES RULES — read every rule before writing a single duty:
Every duty must be a PURE TASK SENTENCE. Even though you can see employer names and organisation names in the candidate profile above, you MUST NOT include any of them in the duties list. Not at the start, not at the end, not in a sub-clause.

WRONG — contains organisation or location reference (never do this):
"Supported service users in care planning within the Sirona Care and Health CIC NHS setting."
"Maintained records using Care Vision at ACE Healthcare Ltd."
"Delivered patient care across the Bristol Royal Infirmary inpatient wards."

CORRECT — pure task, zero organisation or location reference:
"Supported service users and carers to participate in care planning discussions, ensuring their views informed day-to-day service delivery."
"Maintained accurate involvement records and documentation using electronic care record systems."
"Delivered personal care to patients, maintaining dignity and privacy at all times."

RULES:
- Start every duty with a past tense verb: Assisted, Supported, Delivered, Monitored, Documented, Escalated, Participated, Undertook, Maintained, Coordinated, Gathered, Promoted, Performed...
- Mirror the EXACT task vocabulary and keywords from the vacancy job description
- Each duty: one sentence, 20-35 words, no location or employer reference anywhere
- NEVER write the word "NHS" in any duty — not "NHS standards", not "NHS Trust", not "NHS guidelines", not "NHS Care Certificate", not "NHS Direct", nothing
- NEVER name any employer, hospital, Board, company, care home, department, ward, or geographic location — this includes Southmead Hospital, Bristol Royal Infirmary, and every other named hospital worldwide
- NEVER name any UK-specific healthcare software or EHR system: SystmOne, Lorenzo, Datix, EMIS, RiO, PARIS, TrakCare, CERNER, PAS, Electronic Prescribing System by brand name — write "electronic patient record system", "clinical information system", or "medication management system" instead
- NEVER reference NHS pay bands (Band 3, Band 5, Band 7, etc.) or UK job grades
- NEVER name specific UK training programmes or certificates (Oliver McGowan Training, NHS Care Certificate, Safeguarding Level 2, etc.) — describe the skill generically instead
- Previous role duties ONLY — do not describe the current role
- essentialCriteria must list EVERY criterion from all sections of the JDPS table`
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
Answer each application question below with full MINI-STARR evidence. Do NOT write a general prose statement.

WORD BUDGET: approximately 300 words per question.
Questions with multiple sub-points: address every sub-point within that same ~300-word answer.

WRITING RULES — apply exactly as in a full statement:
- MINI-STARR format: Situation (specific scene at a named workplace) → Action (specific steps, tools/systems/forms from the JD, named professional roles from the JD) → Result (concrete outcome — name what improved, increased, reduced, or was enabled) → Reflection (optional, 1 sentence)
- SITUATION: must be a real scene — never restate the question or describe the criterion. WRONG: "Communication is central to my role." RIGHT: "On the medical ward at [workplace], I supported a patient with dysphasia by..."
- RESULT is MANDATORY: every answer must end with a concrete outcome. WRONG: "I communicated effectively with the team." RIGHT: "...enabling the patient to give informed consent within one session and reducing her pre-procedure anxiety visibly."
- All banned words apply: no "passionate", "hardworking", "highly motivated", "demonstrates", "utilises" — see ABSOLUTE RULES
- Evidence first: the first sentence must place the reader in a specific situation, never a claim or announcement
- No topic-announcement openers: WRONG: "Communication was central to my work." RIGHT: "At [workplace], I adapted my approach for..."
- No em dashes anywhere

FORMAT:
Write each answer with a bold numbered heading: **Question 1: [question text]**, then the answer paragraph below it. Repeat for every question.
No introduction, no preamble, no summary outside the answers.
End the final answer with "Thank you."

QUESTIONS TO ANSWER:
${options.specificQuestions || ''}`
  }

  // --- statement-only: full prose statement, plain text ---
  if (outputMode === 'statement-only') {
    const hasExtraQuestions = !!(options.specificQuestions && options.applicationMode === 'statement-questions')
    const yearsStr = options.yearsHint || 'over 2'
    const formatHintLine = options.openingFormatHint
      ? `MANDATORY OPENING FORMAT: Use Format ${options.openingFormatHint}. Replace every [X] placeholder with "${yearsStr}". NEVER write "several years", "many years", or "a number of years" — always use "${yearsStr} years".\n\n`
      : ''
    const patternLine = options.bodyPattern
      ? `MANDATORY DEPTH STYLE: Use Depth Style ${options.bodyPattern} for ALL criterion paragraphs.\n\n`
      : ''
    const scotlandStyleLine = isScotland
      ? options.style === '2'
        ? `MANDATORY STRUCTURE: Flowing prose — NO subheadings anywhere in Q1. Use linking phrases between paragraphs. Do NOT insert any bold labels or section headers.\n\n`
        : `MANDATORY STRUCTURE: Use subheadings to group criteria. Every group of criterion paragraphs must have a subheading using exact person spec keywords.\n\n`
      : ''
    const outputInstruction = isRewrite
      ? 'Rewrite the statement following the instruction. Keep all strong content. Improve what was asked.'
      : isScotland
      ? `Write the standard NHS Scotland three-question response using ONLY the three fixed questions defined in your instructions.
CRITICAL: The advert text may contain its own application questions — you must COMPLETELY IGNORE any questions found in the advert. Do NOT answer them. Do NOT reference them. Use ONLY these three standard questions:
- Question 1: Why are you suitable for this post?
- Question 2: Why do you want to work in NHS Scotland / for this Board? What relevant education and training do you have?
- Question 3: Is there any other relevant information you wish to tell us?
These three questions ARE the entire output structure. Nothing else.`
      : hasExtraQuestions
      ? 'Write the full supporting statement following your instructions, then write a separate answer for each specific question below (200-250 words each, STAR evidence). For each question answer, use a bold numbered heading — **Question 1: [question text]** — then the answer paragraph below it.'
      : 'Write the supporting statement for this candidate following the format and rules in your instructions. Do NOT create or answer any additional questions beyond the standard supporting statement format — even if the advert text contains application questions.'

    return `${jobSection}

${clientSection}
${specificQSection}
${instructionsSection}
${rewriteSection}

## TASK
${formatHintLine}${patternLine}${scotlandStyleLine}${outputInstruction}

Output as plain text only. Do NOT wrap in JSON. Do NOT add any preamble. Start directly with the first word.

${isScotland
  ? `MANDATORY: Output ONLY the three standard questions listed above. No other sections.

HARD WORD LIMITS:
- Question 1: Why are you suitable for this post? — 480 words maximum
- Question 2: Why do you want to work in NHS Scotland / for this Board? What relevant education and training do you have? — 480 words maximum
- Question 3: Is there any other relevant information that will assist us in shortlisting your application? — 200 words maximum — end with "Thank you." and stop`
  : `HARD WORD LIMIT: 1,450 words for the main statement — end with "Thank you." and STOP
Do NOT write any section after "Thank you." — no Key Duties, no summaries, nothing.
${hasExtraQuestions ? 'After "Thank you.", write each specific question answer (approximately 300 words each — full MINI-STARR evidence, same rules as statement paragraphs, concrete outcome mandatory) with the question as a heading. Questions with multiple sub-points: address every sub-point within that same ~300-word answer.' : ''}`}

CRITICAL:
- No em dashes anywhere
- Do not bold or highlight any words
- Do NOT write a Key Duties section — the statement ends at "Thank you."
- Address EVERY essential criterion with specific STAR evidence — expect 20-40 criteria from the JDPS, not just the bullet list in the job advert
- The JDPS table has criteria across Education, Experience, Special Aptitudes, Disposition, Physical Requirements, and Particular Requirements — address ALL sections
- Criteria that appear potentially weak MUST still be addressed confidently with specific evidence from the candidate's history`
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
  "previousRoleDuties": ["exactly ${dutiesCount} duties — see rules below"]
}

DUTIES RULES — read every rule before writing a single duty:
Every duty must be a PURE TASK SENTENCE. Even though you can see employer names and organisation names in the candidate profile above, you MUST NOT include any of them in the duties list. Not at the start, not at the end, not in a sub-clause.

WRONG — contains organisation or location reference (never do this):
"Supported service users in care planning within the Sirona Care and Health CIC NHS setting."
"Maintained records using Care Vision at ACE Healthcare Ltd."
"Delivered patient care across the Bristol Royal Infirmary inpatient wards."

CORRECT — pure task, zero organisation or location reference:
"Supported service users and carers to participate in care planning discussions, ensuring their views informed day-to-day service delivery."
"Maintained accurate involvement records and documentation using electronic care record systems."
"Delivered personal care to patients, maintaining dignity and privacy at all times."

RULES:
- Start every duty with a past tense verb: Assisted, Supported, Delivered, Monitored, Documented, Escalated, Participated, Undertook, Maintained, Coordinated, Gathered, Promoted, Performed...
- Mirror the EXACT task vocabulary and keywords from the vacancy job description
- Each duty: one sentence, 20-35 words, no location or employer reference anywhere
- NEVER write the word "NHS" in any duty — not "NHS standards", not "NHS Trust", not "NHS guidelines", not "NHS Care Certificate", not "NHS Direct", nothing
- NEVER name any employer, hospital, Board, company, care home, department, ward, or geographic location — this includes Southmead Hospital, Bristol Royal Infirmary, and every other named hospital worldwide
- NEVER name any UK-specific healthcare software or EHR system: SystmOne, Lorenzo, Datix, EMIS, RiO, PARIS, TrakCare, CERNER, PAS, Electronic Prescribing System by brand name — write "electronic patient record system", "clinical information system", or "medication management system" instead
- NEVER reference NHS pay bands (Band 3, Band 5, Band 7, etc.) or UK job grades
- NEVER name specific UK training programmes or certificates (Oliver McGowan Training, NHS Care Certificate, Safeguarding Level 2, etc.) — describe the skill generically instead
- Previous role duties ONLY — do not describe the current role

CRITICAL:
- No em dashes anywhere
- statement must be complete, never truncated
- essentialCriteria must list EVERY criterion from the person spec`
}

// Score the statement against extracted criteria using the Easeme scale.
// Runs AFTER statement + analysis complete since it needs both.
// Parallel two-call approach for Scotland and England:
// Call A — statement (plain text): no JSON escaping issues, reliable output
// Call B — analysis + duties (small flat JSON): fast, non-critical
// Call C — scoring (sequential, after A+B, uses Haiku): ~5-8s extra
// Promise.all wall time:
//   Scotland: max(1700/65≈26s, 700/65≈11s) + scoring ~5s + ~12s overhead ≈ 43s ✓
//   England:  max(2300/65≈35s, 900/65≈14s) + scoring ~5s + ~12s overhead ≈ 52s ✓
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
    bodyPattern?: string
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

  // Pick opening format randomly so the intro never defaults to the same structure
  const formatPool = ['A', 'B', 'C', 'D', 'E']
  const openingFormatHint = formatPool[Math.floor(Math.random() * formatPool.length)]

  // Random years: avoids "several years" — use a specific number
  const yearsPool = ['over 2', 'over 3']
  const yearsHint = yearsPool[Math.floor(Math.random() * yearsPool.length)]

  // Use user-selected depth style, or pick randomly if not specified
  const depthStylePool = ['1', '2', '3']
  const bodyPattern = options.bodyPattern || depthStylePool[Math.floor(Math.random() * depthStylePool.length)]

  // Fetch real recent news about the Trust/Board so the "why here" answer
  // references specific achievements rather than generic praise.
  // Runs with a hard timeout — statement generation continues even if it fails.
  let trustIntelText: string | undefined
  if (jobData.organisation) {
    const intel = await fetchTrustIntel(jobData.organisation).catch(() => null)
    if (intel) trustIntelText = formatTrustIntel(intel)
  }

  // Determine statement output mode
  const statementOutputMode =
    appMode === 'questions-only' ? 'questions-only' : 'statement-only'

  const statementUserPrompt = buildUserPrompt(client, jobData, region, {
    ...options,
    outputMode: statementOutputMode,
    openingFormatHint,
    yearsHint,
    bodyPattern,
    style,
    trustIntelText,
  })

  const analysisUserPrompt = buildUserPrompt(client, jobData, region, {
    outputMode: 'analysis-only',
  })

  // max_tokens for statement call:
  //   Scotland: 1060w target → cap 2000 (26s)
  //   England full: 1450w target → cap 2300 (35s)
  //   Questions-only: ~300w per question → scale with count, min 2500, max 5000
  //   Statement+questions: statement base + question budget
  const questionCount = options.specificQuestions
    ? (options.specificQuestions.match(/^\d+\./gm) || []).length
    : 0
  const tokensPerQuestion = 430 // ~300 words × 1.43 tokens/word, rounded up

  let statementMaxTokens: number
  if (appMode === 'questions-only') {
    statementMaxTokens = Math.min(5000, Math.max(2500, questionCount * tokensPerQuestion + 300))
  } else if (appMode === 'statement-questions') {
    const statementBase = isScotland ? 2000 : 2300
    statementMaxTokens = Math.min(5000, statementBase + Math.max(0, questionCount * tokensPerQuestion))
  } else if (isScotland) {
    statementMaxTokens = 2000
  } else {
    statementMaxTokens = 2300
  }

  const [statementResult, analysisResult] = await Promise.allSettled([
    withRetry(() =>
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: statementMaxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: statementUserPrompt }],
      })
    ),
    anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'You are an expert NHS job application analyst. Extract information accurately from the job posting and candidate profile. The person specification may appear at the END of the document — read all of it.',
      messages: [{ role: 'user', content: analysisUserPrompt }],
    }),
  ])

  // Statement is critical — rethrow if it failed
  if (statementResult.status === 'rejected') throw statementResult.reason
  const statementMsg = statementResult.value

  // Statement: plain text, use directly
  const statementContent = statementMsg.content[0]
  if (statementContent.type !== 'text') throw new Error('Unexpected response type from Claude')
  let statement = statementContent.text
    .trim()
    .replace(/\u2014/g, '-')
    .replace(/--/g, '-')
    .replace(/\*\*/g, '')
    // Strip any "Story:", "Scenario:", "Story 1:", "Scenario 2:" labels the model may add
    .replace(/^(Story|Scenario)\s*\d*\s*:\s*/gim, '')
  if (!statement) throw new Error('Claude returned an empty statement')

  // Enforce word count limit while preserving paragraph structure
  const wordLimit = isScotland ? 1160 : 1450
  if (statement.split(/\s+/).length > wordLimit) {
    const paragraphs = statement.split(/\n\n+/)
    let totalWords = 0
    const kept: string[] = []
    for (const para of paragraphs) {
      const paraWordCount = para.trim().split(/\s+/).filter(Boolean).length
      if (totalWords + paraWordCount <= wordLimit) {
        kept.push(para)
        totalWords += paraWordCount
      } else {
        // Fit remaining budget: trim to last sentence
        const remaining = wordLimit - totalWords
        if (remaining > 15) {
          const paraWords = para.trim().split(/\s+/)
          const partial = paraWords.slice(0, remaining).join(' ')
          const lastPeriod = partial.lastIndexOf('.')
          if (lastPeriod > partial.length * 0.6) kept.push(partial.slice(0, lastPeriod + 1))
        }
        break
      }
    }
    statement = kept.join('\n\n')
    if (!statement.trimEnd().endsWith('Thank you.')) statement += '\n\nThank you.'
  }

  // Analysis: small JSON, non-critical — failure just means no criteria list shown
  let analysis: StatementAnalysis | null = null
  let previousRoleDuties: string[] = []
  const analysisMsg = analysisResult.status === 'fulfilled' ? analysisResult.value : null
  const analysisContent = analysisMsg?.content[0]
  if (analysisContent?.type === 'text') {
    const cleanedAnalysis = analysisContent.text.replace(/\u2014/g, '-').replace(/--/g, '-')
    const jsonMatch = cleanedAnalysis.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const p: {
          enhancedPreviousTitle?: string
          jobSummary?: string
          essentialCriteria?: string[]
          desirableCriteria?: string[]
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
            potentialGaps: [],
            keyDuties: [],
            meetsAllEssential: p.meetsAllEssential,
          }
        }
      } catch { /* non-critical */ }
    }
  }

  // Cost logging — sonnet-4-6: $3/M input, $15/M output
  const PRICE_IN = 3 / 1_000_000
  const PRICE_OUT = 15 / 1_000_000
  const stIn = statementMsg.usage.input_tokens
  const stOut = statementMsg.usage.output_tokens
  const anIn = analysisMsg?.usage?.input_tokens ?? 0
  const anOut = analysisMsg?.usage?.output_tokens ?? 0
  const totalIn = stIn + anIn
  const totalOut = stOut + anOut
  const costUsd = (totalIn * PRICE_IN + totalOut * PRICE_OUT).toFixed(4)
  console.log(
    `COST region=${region} stmt_in=${stIn} stmt_out=${stOut} anal_in=${anIn} anal_out=${anOut} total_in=${totalIn} total_out=${totalOut} usd=$${costUsd}`
  )

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
    bodyPattern?: string
  } = {}
): Promise<{
  statement: string
  previousRoleDuties: string[]
  currentRoleDuties: string[]
  analysis: StatementAnalysis | null
  promptRegion: PromptRegion
}> {
  const region = options.vacancyUrl ? detectRegion(options.vacancyUrl, jobData.rawText) : 'generic'
  const style = options.style || '1'
  const callOptions = {
    instructions: options.instructions,
    specificQuestions: options.specificQuestions,
    rewriteInstruction: options.rewriteInstruction,
    previousStatement: options.previousStatement,
    applicationMode: options.applicationMode ?? 'full',
    bodyPattern: options.bodyPattern,
  }

  if (region === 'scotland' || region === 'england-wales') {
    return generateParallel(client, jobData, callOptions, region, style)
  }

  // Generic / civil-service: single call
  const systemPrompt = buildSystemPrompt(region, style)
  const genericIntel = await fetchTrustIntel(jobData.organisation ?? '').catch(() => null)
  const genericIntelText = genericIntel ? formatTrustIntel(genericIntel) : undefined
  const userPrompt = buildUserPrompt(client, jobData, region, { ...callOptions, outputMode: 'full', trustIntelText: genericIntelText })

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
