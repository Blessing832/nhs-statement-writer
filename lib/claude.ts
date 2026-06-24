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
  // Content-based fallback for unrecognized URLs and text-paste mode
  if (rawText) {
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
  const styleNote = style === '2'
    ? '\n- Write in continuous flowing prose with NO subheadings or bold section headers anywhere'
    : '\n- Use bold subheadings. Every criterion from the person specification is its own subheading — one criterion, one subheading, one paragraph. Copy the criterion wording verbatim. No grouping, no merging, no skipping. Plan all subheadings before writing.'
  return `You are an expert UK job application writer. Write a compelling supporting statement for this NHS or public sector role.
- Address every essential criterion from the person specification
- Use NHS language and terminology
- Write 800-1,200 words
- NEVER use em dashes (—). Use a comma instead
- Never fabricate experience${styleNote}

OPENING PARAGRAPH (ONE paragraph only, maximum 80 words):
Lead sentence 1 with the previous role title — the candidate's previous role matches the vacancy, so the recruiter must immediately see "this person has done this job before". Open with "As an experienced [EXACT vacancy title]" or "[X] years as [EXACT vacancy title]". NEVER open with "I am applying for...".
Cover all four in one tight paragraph, then begin criteria immediately in paragraph 2:
1. PREVIOUS ROLE + EXPERIENCE (sentence 1): role title + years + 2-3 specific conditions/procedures from the JD
2. QUALIFICATIONS (sentence 2): one brief sentence — essential qualification from person spec + current role placement
3. WARD/DEPARTMENT over hospital name: reference the ward or department, not the hospital name
4. WHY THIS ORGANISATION: final sentence — one concrete specific from the job advert (not generic)

FIVE-SENTENCE PATTERN — use for every criterion paragraph:
1. "I meet this criterion through my role as [position], where I [scope of responsibility]."
2. "Specifically, in [clinical situation with enough detail the panel can picture it], I was responsible for [task]."
3. "I [specific action and decision], applying [relevant framework, guideline, or evidence base]."
4. "As a result, [quantified or qualitative outcome attributable to your action]." — MANDATORY
5. "On reflection, [what you learned or how you changed practice], which I will bring to this role by [specific application]."

NEVER: generic claims ("I am a strong team player"), vague outcomes ("which improved patient care"), or missing sentence 4 or 5.

EVIDENCE DENSITY RULES — every criterion paragraph:
Rule 1: No claim without a number, a name, or a measurable detail (specific figure, named tool/system, named protocol, or time marker).
Rule 2: Same density for every criterion — "team working" and "tact" must be as specific as numeracy. Every criterion is scored.
Rule 3: Pull real specifics from the candidate profile (exact system names, ward types, patient counts, equipment brands) before writing.
BANNED: "I have strong communication skills", "I am experienced in patient care", "I always document accurately", "I am good with IT systems".

FOUR CRITICAL FAILURES — check every paragraph before outputting:
1. QUALIFICATION WITHOUT SCENARIO: Never "I hold [qual] and apply its standards." Name one skill from that training, write the specific scenario where it was used, name the tool and the outcome. WRONG: "I hold the Care Certificate and apply its standards daily." RIGHT: "My Moving and Handling cert covered hoist operation, transfer belts, and slide sheets. When transferring a patient with a hip fracture (78kg) from bed to chair, I completed a manual handling risk assessment, selected a full-body sling, and used a 2-person technique — completed without incident, patient reported no pain."
2. DUTIES LISTED WITHOUT SCENARIO/WARD/FIGURE: Name the ward type, describe one specific instance, give an outcome figure. WRONG: "I carry out blood pressure, SpO2, and blood glucose monitoring." RIGHT: "On the 20-bed inpatient ward I complete observations for 6 patients every 4 hours. When a blood pressure of 88/54 fell below the 90-120 systolic threshold, I rechecked at 90/56 and escalated; the patient was reviewed within 10 minutes and recovered to 102/68 by the next round."
3. SBAR AS LABEL NOT CONTENT: Never "I used SBAR." Write the actual content. WRONG: "I escalated using SBAR format." RIGHT: "I escalated: Situation — 'SpO2 has dropped to 89% over 15 minutes.' Background — 'Admitted with chest infection 3 days ago, was 95% this morning.' Assessment — 'More breathless, RR increased to 24.' Recommendation — 'I think he needs review now.' The nurse attended within 3 minutes."
4. COMPETENCE BOUNDARY WITHOUT EXACT PROCEDURE: Name the exact procedure, where competency ended, and the supervision steps. WRONG: "When something fell outside my competency I escalated." RIGHT: "I was asked to assist with a NPWT wound dressing, outside my sign-off. I told the nurse, 'I have not been signed off on NPWT equipment.' She supervised me through 3 changes over 2 weeks, checking seal technique and canister pressure, before signing off my competency record."`
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
Answer EVERY question listed below. Do NOT stop before the final question. Do NOT skip any question.

WORD BUDGET: approximately 250 words per question (never fewer than 200, never more than 280).
Questions with multiple sub-points: address every sub-point within that same ~250-word answer.

FIVE-SENTENCE PATTERN — mandatory structure for EVERY answer — no exceptions:
Sentence 1: "I meet this criterion through my role as [position], where I [scope of responsibility]." — maps immediately to the question, never a vague opener
Sentence 2: "Specifically, in [clinical situation with enough detail the panel can picture it], I was responsible for [task]." — puts the panel inside real evidence
Sentence 3: "I [specific action and decision], applying [relevant framework, guideline, or evidence base from the JD or person spec]." — shows clinical reasoning, not just action
Sentence 4: "As a result, [quantified or qualitative outcome directly attributable to your action]." — MANDATORY, never omit, never vague
Sentence 5: "On reflection, [what you learned or how you changed practice], which I will bring to this role by [specific application in this post]." — links learning to THIS role

SCORING RULE (panel scores 0-3 per question):
- 0 = generic claim ("I have strong communication skills and work well in a team") — cannot be scored at all
- 1 = vague example, no outcome stated
- 2 = specific example, outcome named but not quantified
- 3 = all five sentences present + quantified outcome + reflection mapped to this role → THE ONLY ACCEPTABLE STANDARD

ADDITIONAL RULES:
- Evidence first: first sentence must place the reader in a specific situation, never a claim or announcement
- RESULT is MANDATORY: every answer must end with a concrete, attributable outcome — never "which improved patient care" without specifics
- NEVER use em dashes (—) — use a comma instead
- No banned words: "passionate", "hardworking", "highly motivated", "demonstrates", "utilises"

FORMAT:
Write each answer with a bold numbered heading: **Question 1: [question text]**, then the answer paragraph directly below it.
No introduction, no preamble, no closing summary outside the individual answers.
Answer EVERY question before writing "Thank you." — "Thank you." goes only after the very last answer.

QUESTIONS TO ANSWER (answer ALL of them — do not stop early):
${options.specificQuestions || ''}`
  }

  // --- statement-only: full prose statement, plain text ---
  if (outputMode === 'statement-only') {
    const hasExtraQuestions = !!(options.specificQuestions && options.applicationMode === 'statement-questions')
    const yearsStr = options.yearsHint || 'over 2'
    const formatHintLine = options.openingFormatHint
      ? `MANDATORY OPENING FORMAT: Use Format ${options.openingFormatHint}. Replace every [X] placeholder with "${yearsStr}". NEVER write "several years", "many years", or "a number of years" — always use "${yearsStr} years".\n\n`
      : ''
    const patternLine = !options.bodyPattern
      ? ''
      : options.bodyPattern === '3'
      ? `MANDATORY TRUST LEAD STRUCTURE — override all default opening and criterion patterns:

PARAGRAPH 1 — WHY THIS ROLE (120-150 words):
Open with why you are applying for THIS specific role: the candidate's career goal, what draws them to this type of work, and a brief direct statement of how their background meets the key requirements. Use exact phrases from the job advert overview/introduction. Do NOT use the standard Pattern A/B/C/D formats for this opening.

PARAGRAPH 2 — WHY THIS TRUST (120-150 words — must be specific, never generic):
Write specifically about THIS trust. This paragraph must include ALL THREE of the following:
1. One specific recent achievement, award, investment, or initiative from the TRUST INTELLIGENCE block above (if present) or from the job advert itself — name it exactly as written, with any date or figure given. If no intel is available, reference a specific named service, ward, or patient group from the advert.
2. The trust's own named values (find them in the JD or trust section; if absent, use the six national NHS values by exact name).
3. EHR SYSTEM — VERBATIM MATCH ONLY: Scan the ENTIRE job description and person spec text for these exact system names: RiO, PKB (Patient Known Best), SystmOne, EMIS, Epic, Lorenzo, Cerner, Carenotes, Adastra, Careflow, JAC, Meditech, PARIS, Clinical Portal, iClip. ONLY name a system if that exact name appears verbatim in the JD text. NEVER guess, assume, or infer which system a trust uses from its name, geography, or type. CRITICAL — TrakCare is used exclusively in NHS Scotland: NEVER name it for any England or Wales role under any circumstances. If an exact system name appears verbatim in the JD: write "I am [experienced with / eager to develop proficiency in] [exact system name], which I understand [Trust] uses across its services." If NO system name is found in the JD text: write "I am committed to quickly learning [Trust]'s electronic patient record system to contribute from the earliest opportunity."
NEVER use generic phrases such as "commitment to excellent care", "values that match my own", or "reputation for outstanding service."

CRITERION PARAGRAPHS — TWO ESSENTIAL CRITERIA PER PARAGRAPH:
Work through ALL essential criteria first, addressing exactly two per paragraph using MINI-STARR format (situation, action, result, optional reflection). After all essential criteria are covered, address desirable criteria in the same way, two per paragraph. Never combine more than two criteria in one paragraph.

OMIT the 6 Cs paragraph entirely — do not write it.
OMIT a separate Trust Values paragraph — trust values are addressed in Paragraph 2 above.
End with the mandatory criteria summary paragraph, then the closing paragraph ("Thank you.").

`
      : `MANDATORY DEPTH STYLE: Use Depth Style ${options.bodyPattern} for ALL criterion paragraphs.\n\n`
    const scotlandStyleLine = isScotland
      ? options.style === '2'
        ? `MANDATORY STRUCTURE: Flowing prose — NO subheadings anywhere in Q1. Use linking phrases between paragraphs. Do NOT insert any bold labels or section headers.\n\n`
        : `MANDATORY STRUCTURE: Every criterion from the person spec is its own subheading. One criterion = one subheading = one paragraph. Copy criterion wording verbatim. No grouping, no merging, no skipping. Plan ALL subheadings before writing.\n\n`
      : region === 'england-wales'
      ? options.style === '2'
        ? `MANDATORY STRUCTURE: Flowing prose — NO subheadings anywhere in the statement. Use only transition phrases between paragraphs. Do NOT insert any bold labels or section headers.\n\n`
        : `MANDATORY STRUCTURE: Every criterion from the person spec is its own bold subheading. One criterion = one subheading = one paragraph. Copy the criterion wording verbatim — no paraphrasing. No grouping, no merging, no skipping any criterion. Plan ALL subheadings before writing a single word.\n\n`
      : options.style === '2'
        ? `MANDATORY STRUCTURE: Flowing prose — NO subheadings or bold section labels anywhere.\n\n`
        : `MANDATORY STRUCTURE: Every criterion from the person spec is its own bold subheading. One criterion = one subheading = one paragraph. Copy criterion wording verbatim. No grouping, no merging, no skipping.\n\n`
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
- Question 1: Why are you suitable for this post? — 420 words maximum
- Question 2: Why do you want to work in NHS Scotland / for this Board? What relevant education and training do you have? — 420 words maximum
- Question 3: Is there any other relevant information that will assist us in shortlisting your application? — 340 words maximum — end with "Thank you." and stop`
  : hasExtraQuestions
  ? `HARD WORD LIMIT FOR MAIN STATEMENT: 1,400 words. Write "Thank you." to close the statement when done.

CRITICAL — MANDATORY CONTINUATION: After "Thank you.", you MUST answer EVERY additional question listed in the SPECIFIC APPLICATION QUESTIONS section above. Do NOT stop at "Thank you." if there are additional questions.

For each additional question:
- Use a bold numbered heading: **Question 1: [exact question text]**
- Answer at approximately 250 words using the FIVE-SENTENCE PATTERN
- Sentence 1: scope of responsibility → Sentence 2: specific clinical situation → Sentence 3: specific action + framework → Sentence 4: quantified outcome (MANDATORY) → Sentence 5: reflection linked to this role
- NEVER use em dashes (—), use a comma instead. No generic claims. Every answer must end with a concrete attributable outcome.`
  : `HARD WORD LIMIT: 1,400 words — write "Thank you." and STOP. Do NOT write any section after "Thank you." — no Key Duties, no summaries, nothing.`}

CRITICAL:
- NEVER use em dashes (—) — use a comma instead
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
- NEVER use em dashes (—) — use a comma instead
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
  //   Scotland: 1060w target → cap 2200
  //   England full: 1570w target → cap 2600
  //   Questions-only: 250w per question, min 7 questions → min 6000, scale up
  //   Statement+questions: statement base + 2 question budget minimum
  //
  // Question count: detect multiple question formats
  const questionCount = options.specificQuestions
    ? Math.max(
        (options.specificQuestions.match(/^\d+\./gm) || []).length,          // "1. Question"
        (options.specificQuestions.match(/^\d+\)/gm) || []).length,          // "1) Question"
        (options.specificQuestions.match(/^Question\s+\d+/gim) || []).length, // "Question 1:"
        (options.specificQuestions.match(/^Q\d+[:.]/gim) || []).length,      // "Q1. Question"
      )
    : 0
  // ~500 tokens per question: 250 words * ~1.3 tokens/word + ~120 for bold heading
  const tokensPerQuestion = 500

  let statementMaxTokens: number
  if (appMode === 'questions-only') {
    // Always budget for at least 7 questions; scale higher if more detected
    const effectiveCount = Math.max(questionCount, 7)
    statementMaxTokens = Math.min(8000, Math.max(6000, effectiveCount * tokensPerQuestion + 1000))
  } else if (appMode === 'statement-questions') {
    const statementBase = isScotland ? 2200 : 2800
    // Budget for at least 2 extra questions
    const effectiveCount = Math.max(questionCount, 2)
    statementMaxTokens = Math.min(8000, statementBase + effectiveCount * tokensPerQuestion)
  } else if (isScotland) {
    statementMaxTokens = 2200
  } else {
    statementMaxTokens = 2600
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
    .replace(/ \u2014 /g, ', ')
    .replace(/\u2014/g, ', ')
    .replace(/ -- /g, ', ')
    .replace(/--/g, ', ')
    .replace(/\*\*/g, '')
    // Strip any "Story:", "Scenario:", "Story 1:", "Scenario 2:" labels the model may add
    .replace(/^(Story|Scenario)\s*\d*\s*:\s*/gim, '')
  if (!statement) throw new Error('Claude returned an empty statement')

  // Enforce word count limit on the MAIN STATEMENT only.
  // Questions-only mode: no limit enforced — the prompt controls per-question word counts.
  // Statement+questions mode: only trim the statement portion before "Thank you.";
  //   preserve the extra question answers that follow it.
  const wordLimit = isScotland ? 1160 : 1400
  if (appMode !== 'questions-only' && statement.split(/\s+/).length > wordLimit) {
    // For statement-questions, split at "Thank you." to preserve question answers
    const CLOSING = 'Thank you.'
    const closingIdx = statement.indexOf(CLOSING)
    const statementPart = closingIdx >= 0
      ? statement.slice(0, closingIdx + CLOSING.length)
      : statement
    const questionsTail = closingIdx >= 0
      ? statement.slice(closingIdx + CLOSING.length)
      : ''

    const paragraphs = statementPart.split(/\n\n+/)
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
    let truncated = kept.join('\n\n')
    if (!truncated.trimEnd().endsWith(CLOSING)) truncated += '\n\n' + CLOSING
    statement = truncated + questionsTail
  }

  // Analysis: small JSON, non-critical — failure just means no criteria list shown
  let analysis: StatementAnalysis | null = null
  let previousRoleDuties: string[] = []
  const analysisMsg = analysisResult.status === 'fulfilled' ? analysisResult.value : null
  const analysisContent = analysisMsg?.content[0]
  if (analysisContent?.type === 'text') {
    const cleanedAnalysis = analysisContent.text.replace(/ \u2014 /g, ', ').replace(/\u2014/g, ', ').replace(/ -- /g, ', ').replace(/--/g, ', ')
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

  const cleanedText = content.text.replace(/ \u2014 /g, ', ').replace(/\u2014/g, ', ').replace(/ -- /g, ', ').replace(/--/g, ', ')
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
    statement: parsed.statement.replace(/ \u2014 /g, ', ').replace(/\u2014/g, ', ').replace(/ -- /g, ', ').replace(/--/g, ', ').replace(/\*\*/g, ''),
    previousRoleDuties: Array.isArray(parsed.previousRoleDuties) ? parsed.previousRoleDuties : [],
    currentRoleDuties: [],
    analysis: parsed.analysis || null,
    promptRegion: region,
  }
}
