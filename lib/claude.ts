import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { Client, ScrapeResult, StatementAnalysis } from './types'
import { getEnglandWalesPrompt } from './prompts/england-wales'
import { getScotlandPrompt } from './prompts/scotland'
import { getScotlandQ2Variation } from './scotland-q2-variations'
import { fetchTrustIntel, formatTrustIntel } from './trust-intel'
import { supabaseAdmin } from './supabase'

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

const ESSENTIAL_CRITERIA_OVERRIDE = `

## CRITICAL OVERRIDE — ESSENTIAL CRITERIA GAPS — READ THIS LAST, FOLLOW IT ALWAYS
You MUST write the full supporting statement regardless of any gap between the candidate's profile and the person specification. Do NOT refuse to write. Do NOT recommend the candidate reconsider applying. Do NOT flag missing criteria as a reason to withhold the statement. Your role is to write the strongest honest statement possible with the evidence available — the employer's shortlisting panel makes hiring decisions, not you.

When an essential criterion cannot be met (for example, a driving licence the candidate does not hold):
- Write the full statement as normal across all paragraphs
- In the Compliance paragraph (Category 12), address the criterion using ONLY what the candidate profile states — do not add claims the profile does not support (e.g. do not write "I am actively working toward obtaining one" unless the profile explicitly says so)
- A plain honest sentence is correct: "I do not currently hold a full UK driving licence." If the profile provides additional context (e.g. "is learning to drive", "plans to obtain one"), include that — otherwise stop at the honest statement of fact
- Never fabricate a licence or claim the candidate holds something they do not
- Never omit the compliance criterion — address it, honestly, in one direct sentence drawn strictly from the profile

This override applies to every gap — driving licence, qualification, years of experience, or any other essential criterion. Write the statement. Handle the gap in Compliance. Stop.

## CRITICAL — NON-UK LOCATIONS BANNED FROM EVERY STATEMENT
NEVER name any country, city, region, or geographic location outside the United Kingdom anywhere in the statement — not in the opening paragraph, not in criterion paragraphs, not in any context. This includes country names (Nigeria, Ghana, Philippines, India, USA, etc.), city names (Lagos, Accra, Manila, Delhi, etc.), and any region or continent reference.

If the candidate's profile includes experience from overseas, describe it generically using size and type only:
- WRONG: "At Lagos University Teaching Hospital in Nigeria, I worked on a busy 40-bed ward..."
- RIGHT: "At a 400-bed tertiary teaching hospital, I worked on a busy 40-bed ward..."
- WRONG: "My experience in Ghana prepared me..."
- RIGHT: "My previous hospital experience prepared me..."

Use: "a large tertiary hospital", "a busy district hospital", "a 500-bed multi-specialty hospital", "a community health centre" — never the country, city, or institution name of a non-UK employer.
UK locations (England, Wales, Scotland, Northern Ireland, and named UK cities and regions) are allowed where relevant.`

async function buildSystemPrompt(region: PromptRegion, style: '1' | '2'): Promise<string> {
  // Check for admin-customized prompt stored in Supabase — overrides code defaults
  // Generic / civil-service also try the england-wales custom prompt so unrecognized UK job boards
  // benefit from the same EaseMe prompt rather than the bare generic fallback.
  const supabaseRegion = (region === 'scotland') ? 'scotland'
    : (region === 'england-wales' || region === 'generic' || region === 'civil-service') ? 'england-wales'
    : null
  if (supabaseRegion) {
    try {
      const { data } = await supabaseAdmin.from('prompts').select('content').eq('region', supabaseRegion).maybeSingle()
      if (data?.content) return data.content + ESSENTIAL_CRITERIA_OVERRIDE
    } catch {
      // Table may not exist yet — fall through to code defaults
    }
  }
  if (region === 'scotland') return getScotlandPrompt(style) + ESSENTIAL_CRITERIA_OVERRIDE
  if (region === 'england-wales') {
    // Try V2.9 master prompt file before falling back to code default
    try {
      const v2Prompt = fs.readFileSync(path.join(process.cwd(), 'nhs_supporting_statement_master_prompt_v2_9.md'), 'utf-8')
      if (v2Prompt.trim()) return v2Prompt + ESSENTIAL_CRITERIA_OVERRIDE
    } catch { /* file not present — fall through */ }
    return getEnglandWalesPrompt(style) + ESSENTIAL_CRITERIA_OVERRIDE
  }
  const styleNote = style === '2'
    ? '\n- Write in continuous flowing prose with NO subheadings or bold section headers anywhere'
    : '\n- Use bold subheadings. Group 3-4 related criteria per subheading. The subheading must name every criterion it covers using person spec wording. Every criterion in the subheading must be explicitly evidenced in the paragraph. Every criterion from the person spec must be assigned to exactly one section — no criterion may be skipped. Plan all subheadings and confirm 100% coverage before writing.'
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
    extractedCriteria?: { essential: string[]; desirable: string[] }
  }
): string {
  const isScotland = region === 'scotland'
  const isRewrite = !!(options.rewriteInstruction && options.previousStatement)
  const outputMode = options.outputMode ?? 'full'
  const dutiesCount = '7'
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

DUTIES RULES — produce exactly 7 highly specific, outcome-focused bullet points from the candidate's most recent/relevant previous role. Write in past tense. Retain real employer and NHS Trust names where they appear in the candidate profile — do not anonymise.

Each duty must:
- Begin with a strong past tense action verb (Delivered, Led, Coordinated, Implemented, Managed, Monitored, Escalated, Improved, Developed, Supported, Streamlined, etc.)
- Exceed 25 words — be specific, evidence-based and outcome-focused
- Clearly outline: the situation or context, the specific action taken, collaboration involved, governance or quality considerations where relevant, and measurable impact on patient care, service delivery, compliance, or organisational performance
- Mirror the exact task vocabulary and key phrases from the vacancy job description and person specification
- Demonstrate continuity with the target role — quality improvement, patient-centred delivery, MDT collaboration, safeguarding awareness, and quantifiable outcomes where credible

WRONG — too short, generic, no outcome:
"Supported service users in care planning."
"Maintained records using electronic systems."

CORRECT — specific, detailed, outcome-focused, past tense:
"Coordinated multidisciplinary care planning meetings for a caseload of 20+ patients with complex mental health needs, ensuring treatment plans were reviewed, updated, and communicated to all stakeholders within agreed governance timescales, contributing to a measurable reduction in unplanned admissions."
"Identified a recurring gap in medication administration documentation during a ward audit and escalated findings to the ward manager, resulting in a revised protocol adopted across the unit and a 30% improvement in compliance at the next internal review."

ADDITIONAL RULES:
- NEVER write the word "NHS" as a standalone description (e.g. not "NHS standards" generically — instead name the specific standard or framework)
- NEVER name UK-specific healthcare software by brand (SystmOne, Lorenzo, EMIS, RiO, TrakCare, Cerner, PARIS, Datix) — write "electronic patient record system", "clinical information system", or "medication management system"
- NEVER reference NHS pay bands (Band 3, Band 5, etc.)
- NEVER name specific UK training certificates as credentials (Oliver McGowan, NHS Care Certificate) — describe the competency demonstrated instead
- Previous role duties ONLY — do not describe the current or target role`
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

DUTIES RULES — produce exactly 7 highly specific, outcome-focused bullet points from the candidate's most recent/relevant previous role. Write in past tense. Retain real employer and NHS Trust names where they appear in the candidate profile — do not anonymise.

Each duty must:
- Begin with a strong past tense action verb (Delivered, Led, Coordinated, Implemented, Managed, Monitored, Escalated, Improved, Developed, Supported, Streamlined, etc.)
- Exceed 25 words — be specific, evidence-based and outcome-focused
- Clearly outline: the situation or context, the specific action taken, collaboration involved, governance or quality considerations where relevant, and measurable impact on patient care, service delivery, compliance, or organisational performance
- Mirror the exact task vocabulary and key phrases from the vacancy job description and person specification
- Demonstrate continuity with the target role — quality improvement, patient-centred delivery, MDT collaboration, safeguarding awareness, and quantifiable outcomes where credible

WRONG — too short, generic, no outcome:
"Supported service users in care planning."
"Maintained records using electronic systems."

CORRECT — specific, detailed, outcome-focused, past tense:
"Coordinated multidisciplinary care planning meetings for a caseload of 20+ patients with complex mental health needs, ensuring treatment plans were reviewed, updated, and communicated to all stakeholders within agreed governance timescales, contributing to a measurable reduction in unplanned admissions."
"Identified a recurring gap in medication administration documentation during a ward audit and escalated findings to the ward manager, resulting in a revised protocol adopted across the unit and a 30% improvement in compliance at the next internal review."

ADDITIONAL RULES:
- NEVER write the word "NHS" as a standalone description (e.g. not "NHS standards" generically — instead name the specific standard or framework)
- NEVER name UK-specific healthcare software by brand (SystmOne, Lorenzo, EMIS, RiO, TrakCare, Cerner, PARIS, Datix) — write "electronic patient record system", "clinical information system", or "medication management system"
- NEVER reference NHS pay bands (Band 3, Band 5, etc.)
- NEVER name specific UK training certificates as credentials (Oliver McGowan, NHS Care Certificate) — describe the competency demonstrated instead
- Previous role duties ONLY — do not describe the current or target role
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
Write each answer with a bold numbered heading: **Question 1: [question text]**, then the answer split across 2–3 short paragraphs (never one single block):
- Paragraph 1 (Sentences 1–2): context and specific situation
- Paragraph 2 (Sentences 3–4): action, reasoning, and outcome
- Paragraph 3 (Sentence 5 + any reflection): learning and how it applies to this role
Leave a blank line between paragraphs within each answer. Leave a blank line between each question answer.
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
      ? `MANDATORY OPENING TEMPLATE: Use Opening Template ${options.openingFormatHint} from the OPENING TEMPLATES section — the exact numbered sentence listed there. Replace every [X] placeholder with "${yearsStr}". NEVER write "several years", "many years", or "a number of years" — always use "${yearsStr} years".\n\n`
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
        : `MANDATORY STRUCTURE: Use the ATTRIBUTE SECTION headings from the person specification table as bold subheadings — e.g. **Education/Qualification/Training**, **Experience**, **Knowledge and Skills**, **Other** — using whatever category names actually appear in the document. Under each bold heading, address ALL criteria listed in that section using 2-3 paragraphs of STAR evidence. Every criterion from the person spec must be addressed under its correct section — no criterion may be skipped. Confirm 100% coverage before writing.\n\n`
      : region === 'england-wales'
      ? options.style === '2'
        ? `MANDATORY STRUCTURE: Flowing prose — NO subheadings anywhere in the statement. Use only transition phrases between paragraphs. Do NOT insert any bold labels or section headers.\n\n`
        : `MANDATORY STRUCTURE: Use the ATTRIBUTE SECTION headings from the person specification table as bold subheadings — e.g. **Education/Qualification/Training**, **Experience**, **Knowledge and Skills**, **Other** — using whatever category names actually appear in the document. Under each bold heading, address ALL criteria listed in that section in 2-3 paragraphs of STAR evidence. Every criterion from the person spec must be addressed under its correct section — no criterion may be skipped. Plan all section headings and confirm 100% coverage before writing a single word.\n\n`
      : options.style === '2'
        ? `MANDATORY STRUCTURE: Flowing prose — NO subheadings or bold section labels anywhere.\n\n`
        : `MANDATORY STRUCTURE: Use the ATTRIBUTE SECTION headings from the person specification table as bold subheadings — e.g. **Education/Qualification/Training**, **Experience**, **Knowledge and Skills**, **Other**. Under each heading, address ALL criteria in that section using 2-3 paragraphs of STAR evidence. No criterion may be skipped.\n\n`
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
      ? 'Write the full supporting statement following your instructions, then write a separate answer for each specific question below (200-250 words each, STAR evidence). For each question answer, use a bold numbered heading — **Question 1: [question text]** — then split the answer into 2–3 short paragraphs (never one single block): situation/context first, then action and outcome, then reflection. Leave a blank line between paragraphs.'
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

HARD WORD LIMITS (NHS Scotland form caps — do NOT exceed):
- Question 1: Why are you suitable for this post? — 400 words maximum (form cap 450 — stay well under)
- Question 2: Why do you want to work in NHS Scotland / for this Board? What relevant education and training do you have? — 400 words maximum (form cap 450 — stay well under)
- Question 3: Is there any other relevant information? — 190 words maximum (form cap 200 — no criteria summary, two paragraphs only: 6 C's + closing) — end with "Thank you." and stop`
  : hasExtraQuestions
  ? `HARD WORD LIMIT FOR MAIN STATEMENT: 1,400 words. Write "Thank you." to close the statement when done.

CRITICAL — MANDATORY CONTINUATION: After "Thank you.", you MUST answer EVERY additional question listed in the SPECIFIC APPLICATION QUESTIONS section above. Do NOT stop at "Thank you." if there are additional questions.

For each additional question:
- Use a bold numbered heading: **Question 1: [exact question text]**
- Answer at approximately 250 words using the FIVE-SENTENCE PATTERN
- Sentence 1: scope of responsibility → Sentence 2: specific clinical situation → Sentence 3: specific action + framework → Sentence 4: quantified outcome (MANDATORY) → Sentence 5: reflection linked to this role
- NEVER use em dashes (—), use a comma instead. No generic claims. Every answer must end with a concrete attributable outcome.`
  : `HARD WORD LIMIT: 1,400 words — write "Thank you." and STOP. Do NOT write any section after "Thank you." — no Key Duties, no summaries, nothing.`}

CRITICAL — STATEMENT WRITING STANDARDS:
- NEVER use em dashes (—) — use a comma instead
- Do not bold or highlight any words (except Style 1 section headings)
- Do NOT write a Key Duties section — the statement ends at "Thank you."
- Retain real employer and NHS Trust names where they appear naturally in examples — do not anonymise
- Address EVERY essential criterion with specific STAR evidence — expect 20-40 criteria from the JDPS, not just the bullet list in the job advert
- The JDPS table has criteria across Education, Experience, Special Aptitudes, Disposition, Physical Requirements, and Particular Requirements — address ALL sections
- Criteria that appear potentially weak MUST still be addressed confidently with specific evidence from the candidate's history

STAR EVIDENCE STANDARDS — apply to every criterion paragraph:
- SITUATION: Set the scene with specific context (role, setting, patient group, caseload size, challenge faced)
- TASK: State what you were personally responsible for
- ACTION (most important — must be detailed): Explain the exact steps taken, decisions made, methods or frameworks applied, how you collaborated with colleagues or MDT members, how you managed risks, governance considerations, or quality processes
- RESULT: State a measurable, credible outcome — impact on patient care, service delivery, operational performance, compliance, quality improvement, or stakeholder outcomes

CONTENT REQUIREMENTS:
- Integrate relevant governance frameworks, safeguarding awareness, MDT collaboration, service improvement methodologies, and digital/EHR systems where applicable and genuine
- Embed NHS values (compassion, respect, commitment, accountability, collaboration, quality) through practical examples — never as generic claims
- Demonstrate continuity of professional development and progression across roles
- Write in professional British English — clear, authentic, evidence-based, and tailored to this specific role and Trust
- Conclude with a short paragraph reinforcing suitability, service ethos, and commitment to continuous professional development${options.extractedCriteria && (options.extractedCriteria.essential.length > 0 || options.extractedCriteria.desirable.length > 0) ? `

## EXTRACTED PERSON SPECIFICATION — MANDATORY CHECKLIST
Every criterion below MUST appear in the statement with STAR evidence. Do NOT skip any.

ESSENTIAL (address every one — no exceptions):
${options.extractedCriteria.essential.map((c, i) => `${i + 1}. ${c}`).join('\n')}${options.extractedCriteria.desirable.length > 0 ? `

DESIRABLE (address as many as possible):
${options.extractedCriteria.desirable.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : ''}` : ''}`
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

DUTIES RULES — produce exactly 7 highly specific, outcome-focused bullet points from the candidate's most recent/relevant previous role. Write in past tense. Retain real employer and NHS Trust names where they appear in the candidate profile — do not anonymise.

Each duty must:
- Begin with a strong past tense action verb (Delivered, Led, Coordinated, Implemented, Managed, Monitored, Escalated, Improved, Developed, Supported, Streamlined, etc.)
- Exceed 25 words — be specific, evidence-based and outcome-focused
- Clearly outline: the situation or context, the specific action taken, collaboration involved, governance or quality considerations where relevant, and measurable impact on patient care, service delivery, compliance, or organisational performance
- Mirror the exact task vocabulary and key phrases from the vacancy job description and person specification
- Demonstrate continuity with the target role — quality improvement, patient-centred delivery, MDT collaboration, safeguarding awareness, and quantifiable outcomes where credible

WRONG — too short, generic, no outcome:
"Supported service users in care planning."
"Maintained records using electronic systems."

CORRECT — specific, detailed, outcome-focused, past tense:
"Coordinated multidisciplinary care planning meetings for a caseload of 20+ patients with complex mental health needs, ensuring treatment plans were reviewed, updated, and communicated to all stakeholders within agreed governance timescales, contributing to a measurable reduction in unplanned admissions."
"Identified a recurring gap in medication administration documentation during a ward audit and escalated findings to the ward manager, resulting in a revised protocol adopted across the unit and a 30% improvement in compliance at the next internal review."

ADDITIONAL RULES:
- NEVER write the word "NHS" as a standalone description (e.g. not "NHS standards" generically — instead name the specific standard or framework)
- NEVER name UK-specific healthcare software by brand (SystmOne, Lorenzo, EMIS, RiO, TrakCare, Cerner, PARIS, Datix) — write "electronic patient record system", "clinical information system", or "medication management system"
- NEVER reference NHS pay bands (Band 3, Band 5, etc.)
- NEVER name specific UK training certificates as credentials (Oliver McGowan, NHS Care Certificate) — describe the competency demonstrated instead
- Previous role duties ONLY — do not describe the current or target role

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
    openingTemplate?: '1' | '2' | '3' | '4' | '5'
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

  // Use user-selected opening template (1-5) or pick one randomly
  const formatPool = ['1', '2', '3', '4', '5']
  const openingFormatHint = options.openingTemplate || formatPool[Math.floor(Math.random() * formatPool.length)]

  // Random years: avoids "several years" — use a specific number
  const yearsPool = ['over 2', 'over 3']
  const yearsHint = yearsPool[Math.floor(Math.random() * yearsPool.length)]

  // Use user-selected depth style, or pick randomly if not specified
  const depthStylePool = ['1', '2', '3']
  const bodyPattern = options.bodyPattern || depthStylePool[Math.floor(Math.random() * depthStylePool.length)]

  // Fetch system prompt and trust intel in parallel — neither depends on the other
  const [systemPrompt, intelResult] = await Promise.all([
    buildSystemPrompt(region, style),
    jobData.organisation ? fetchTrustIntel(jobData.organisation).catch(() => null) : Promise.resolve(null),
  ])
  const trustIntelText = intelResult ? formatTrustIntel(intelResult) : undefined

  // Determine statement output mode
  const statementOutputMode =
    appMode === 'questions-only' ? 'questions-only' : 'statement-only'

  // Fast Haiku pre-pass: extract the person spec criteria list so the statement
  // call receives an explicit checklist rather than relying on self-identification.
  // Runs on Haiku (~3s) and completes before the main Sonnet calls.
  let extractedCriteria: { essential: string[]; desirable: string[] } | undefined
  if (appMode !== 'questions-only') {
    try {
      const rawText = jobData.rawText.length <= 24000 ? jobData.rawText : jobData.rawText.slice(0, 8000) + jobData.rawText.slice(-16000)
      const preExtractMsg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: 'You are an NHS job application analyst. Extract ONLY the person specification criteria from the job posting. Return a JSON object with two arrays: "essential" and "desirable". Each item is a plain string. Include ALL criteria from every section (Education, Experience, Skills, Aptitudes, Disposition, Physical, Particular Requirements, etc.). Do not include job duties, responsibilities, or descriptions. Return only valid JSON, no markdown.',
        messages: [{ role: 'user', content: `Extract all person specification criteria from this job posting:\n\n${rawText}` }],
      })
      const preText = preExtractMsg.content[0].type === 'text' ? preExtractMsg.content[0].text.trim() : ''
      const clean = preText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
      const parsed = JSON.parse(clean)
      if (Array.isArray(parsed.essential) && parsed.essential.length > 0) {
        extractedCriteria = {
          essential: parsed.essential.filter((c: unknown) => typeof c === 'string'),
          desirable: Array.isArray(parsed.desirable) ? parsed.desirable.filter((c: unknown) => typeof c === 'string') : [],
        }
        console.log(`PRE_EXTRACT essential=${extractedCriteria.essential.length} desirable=${extractedCriteria.desirable.length}`)
      }
    } catch (err) {
      console.warn('PRE_EXTRACT failed (non-fatal, continuing without explicit checklist):', err)
    }
  }

  const statementUserPrompt = buildUserPrompt(client, jobData, region, {
    ...options,
    outputMode: statementOutputMode,
    openingFormatHint,
    yearsHint,
    bodyPattern,
    style,
    trustIntelText,
    extractedCriteria,
  })

  const analysisUserPrompt = buildUserPrompt(client, jobData, region, {
    outputMode: 'analysis-only',
  })

  // max_tokens sized to actual output — overprovision causes Claude to fill the budget
  // 1,400-word statement ≈ 1,900 tokens; 1,100-word Scotland ≈ 1,500 tokens
  // 250-word question answer ≈ 380 tokens each
  const questionCount = options.specificQuestions
    ? Math.max(
        (options.specificQuestions.match(/^\d+\./gm) || []).length,
        (options.specificQuestions.match(/^\d+\)/gm) || []).length,
        (options.specificQuestions.match(/^Question\s+\d+/gim) || []).length,
        (options.specificQuestions.match(/^Q\d+[:.]/gim) || []).length,
      )
    : 0
  const tokensPerQuestion = 420  // 250w × 1.3 tok/w + heading

  let statementMaxTokens: number
  if (appMode === 'questions-only') {
    const effectiveCount = Math.max(questionCount, 3)
    statementMaxTokens = Math.min(5000, Math.max(2000, effectiveCount * tokensPerQuestion + 400))
  } else if (appMode === 'statement-questions') {
    const statementBase = isScotland ? 1800 : 2200
    const effectiveCount = Math.max(questionCount, 2)
    statementMaxTokens = Math.min(5000, statementBase + effectiveCount * tokensPerQuestion)
  } else if (isScotland) {
    statementMaxTokens = 2200  // 1,100w × 1.3 + buffer
  } else {
    statementMaxTokens = 2800  // 1,400w × 1.3 + buffer
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
  const stopReason = statementMsg.stop_reason
  const rawTail = (statementMsg.content[0]?.type === 'text' ? statementMsg.content[0].text : '').slice(-200).replace(/\n/g, '\\n')
  console.log(`GEN stop_reason=${stopReason} output_tokens=${statementMsg.usage.output_tokens}/${statementMaxTokens} region=${region} mode=${appMode}`)
  console.log(`GEN tail200: "${rawTail}"`)
  if (stopReason === 'max_tokens') {
    console.warn(`GEN TRUNCATED: hit max_tokens ceiling of ${statementMaxTokens} — statement will be incomplete`)
  }

  // Statement: plain text, use directly
  const statementContent = statementMsg.content[0]
  if (statementContent.type !== 'text') throw new Error('Unexpected response type from Claude')
  let statement = statementContent.text
    .trim()
    .replace(/ — /g, ', ')
    .replace(/—/g, ', ')
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
  const wordLimit = isScotland ? 1100 : 1400
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
    // Remove trailing orphan headings (heading kept but its content paragraph didn't fit)
    while (kept.length > 0 && /^\*\*[^*]+\*\*$/.test(kept[kept.length - 1].trim())) {
      kept.pop()
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
    const cleanedAnalysis = analysisContent.text.replace(/ — /g, ', ').replace(/—/g, ', ').replace(/ -- /g, ', ').replace(/--/g, ', ')
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

// Lightweight analysis-only call — used when serving a cached statement so the PS panel still works
export async function analyzeJobPosting(
  client: Client,
  jobData: ScrapeResult,
  vacancyUrl: string,
): Promise<StatementAnalysis | null> {
  const region = detectRegion(vacancyUrl, jobData.rawText)
  const prompt = buildUserPrompt(client, jobData, region, { outputMode: 'analysis-only' })
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'You are an expert NHS job application analyst. Extract information accurately from the job posting and candidate profile. The person specification may appear at the END of the document — read all of it.',
      messages: [{ role: 'user', content: prompt }],
    })
    const content = msg.content[0]
    if (content?.type !== 'text') return null
    const cleaned = content.text
      .replace(/ — /g, ', ')
      .replace(/—/g, ', ')
      .replace(/ -- /g, ', ')
      .replace(/--/g, ', ')
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const p: {
      enhancedPreviousTitle?: string
      jobSummary?: string
      essentialCriteria?: string[]
      desirableCriteria?: string[]
    } = JSON.parse(jsonMatch[0])
    if (!Array.isArray(p.essentialCriteria) || p.essentialCriteria.length === 0) return null
    return {
      jobSummary: p.jobSummary || '',
      enhancedPreviousTitle: p.enhancedPreviousTitle,
      essentialCriteria: p.essentialCriteria,
      desirableCriteria: p.desirableCriteria || [],
      candidateStrengths: [],
      potentialGaps: [],
      keyDuties: [],
    }
  } catch {
    return null
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
    applicationMode?: ApplicationMode
    bodyPattern?: string
    openingTemplate?: '1' | '2' | '3' | '4' | '5'
    regionOverride?: 'england-wales' | 'scotland'
  } = {}
): Promise<{
  statement: string
  previousRoleDuties: string[]
  currentRoleDuties: string[]
  analysis: StatementAnalysis | null
  promptRegion: PromptRegion
}> {
  const region: PromptRegion = options.regionOverride || (options.vacancyUrl ? detectRegion(options.vacancyUrl, jobData.rawText) : 'generic')
  const style = options.style || '1'
  const callOptions = {
    instructions: options.instructions,
    specificQuestions: options.specificQuestions,
    rewriteInstruction: options.rewriteInstruction,
    previousStatement: options.previousStatement,
    applicationMode: options.applicationMode ?? 'full',
    bodyPattern: options.bodyPattern,
    openingTemplate: options.openingTemplate,
  }

  if (region === 'scotland' || region === 'england-wales') {
    return generateParallel(client, jobData, callOptions, region, style)
  }

  // Generic / civil-service: single call
  const [systemPrompt, genericIntel] = await Promise.all([
    buildSystemPrompt(region, style),
    jobData.organisation ? fetchTrustIntel(jobData.organisation).catch(() => null) : Promise.resolve(null),
  ])
  const genericIntelText = genericIntel ? formatTrustIntel(genericIntel) : undefined
  const genericOutputMode = callOptions.applicationMode === 'questions-only' ? 'questions-only' : 'statement-only'
  const userPrompt = buildUserPrompt(client, jobData, region, { ...callOptions, outputMode: genericOutputMode, trustIntelText: genericIntelText })

  const genericMaxTokens = callOptions.applicationMode === 'questions-only' ? 4000 : 2800
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: genericMaxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  const cleanedText = content.text.replace(/ — /g, ', ').replace(/—/g, ', ').replace(/ -- /g, ', ').replace(/--/g, ', ')

  // Try to extract JSON: code fence first, then bare object match
  let rawJson: string | null = null
  const fenceMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    rawJson = fenceMatch[1].trim()
  } else {
    const objMatch = cleanedText.match(/\{[\s\S]*\}/)
    rawJson = objMatch ? objMatch[0] : null
  }
  if (!rawJson) throw new Error('Could not parse Claude response as JSON')

  let parsed: {
    statement: string
    previousRoleDuties?: string[]
    analysis?: StatementAnalysis & { meetsAllEssential?: boolean }
  }
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    // Last resort: strip any trailing non-JSON characters after the final }
    const trimmed = rawJson.slice(0, rawJson.lastIndexOf('}') + 1)
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      console.error('Invalid JSON from Claude (first 500 chars):', rawJson.slice(0, 500))
      throw new Error('Invalid JSON in Claude response')
    }
  }

  if (!parsed.statement) throw new Error('Claude response missing statement field')

  return {
    statement: parsed.statement.replace(/ — /g, ', ').replace(/—/g, ', ').replace(/ -- /g, ', ').replace(/--/g, ', ').replace(/\*\*/g, ''),
    previousRoleDuties: Array.isArray(parsed.previousRoleDuties) ? parsed.previousRoleDuties : [],
    currentRoleDuties: [],
    analysis: parsed.analysis || null,
    promptRegion: region,
  }
}
