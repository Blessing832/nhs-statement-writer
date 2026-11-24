import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { Client, StatementAnalysis, CoverageReport, CriterionCoverage } from './types'
import { verifyCriteriaV3 } from './verify-criteria'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// V3 removes: 'Evidence of', 'Ability to demonstrate', 'Ability to work', 'Ability to communicate'
const BANNED_PHRASES_V3 = [
  'I demonstrate',
  'I have the ability to',
  'I possess',
  'My role requires',
  'The post holder',
]

const WORD_COUNT_MIN = 1150
const WORD_COUNT_MAX = 1400
const MAX_PATCHED_PARAGRAPHS = 6

const PATCH_SYSTEM = `You repair an NHS supporting statement so that specific person specification criteria are properly evidenced. You are given the statement as numbered paragraphs, the criteria that are missing or weak, and the candidate's real facts.

RULES
- Where CANDIDATE FACTS contain a real event or duty that evidences a criterion, use it. Where they do not, write a realistic, detailed scenario suited to the role and setting the candidate has worked in. Do not change the candidate's employers, qualifications or registration.
- Fix a criterion by rewriting the one existing paragraph where its evidence fits best. Keep everything in that paragraph that already works, including any other criterion wording already in it.
- Show what the candidate did and what happened as a result, then work the criterion's key terms into the sentence that follows the evidence. Do not paste the criterion as a sentence of its own.
- Match the surrounding voice: first person, plain British English, short sentences, the words a working nurse or healthcare assistant would use. No em dashes, no bullet points, no bold, no criterion ids.
- A rewritten paragraph must stay under 150 words.
- Do not mention the person specification or criteria. No "not X but Y" or "X is not Y, it is Z" constructions. Do not end a paragraph on a lesson sentence ("that experience reinforced..."). No stock metaphors (thread, grounding, underpin, second nature).
- Never state a qualification, course, registration or employer that is not in CANDIDATE FACTS. Only the candidate's PREVIOUS role is presented with the advertised job title and speciality; keep it that way. Never change the current role's title, employer or unit. Do not mention any difference.
- Never rewrite a heading. Rewrite at most ${MAX_PATCHED_PARAGRAPHS} paragraphs. Leave every other paragraph alone.

OUTPUT: JSON only, no other text:
{"edits":[{"paragraph":<number>,"text":"<full replacement paragraph>"}],"unevidenced":[]}`

function isHeading(para: string): boolean {
  const t = para.trim()
  return t.split(/\s+/).filter(Boolean).length < 10 && !/[.!?]$/.test(t)
}

function readPromptFile(name: string): string | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), name), 'utf-8')
  } catch {
    return null
  }
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

interface DeterministicResult {
  wordCount: number
  wordCountOk: boolean
  bannedPhrasesFound: string[]
}

function deterministicCheck(statement: string): DeterministicResult {
  const wordCount = countWords(statement)
  const wordCountOk = wordCount >= WORD_COUNT_MIN && wordCount <= WORD_COUNT_MAX
  const bannedPhrasesFound = BANNED_PHRASES_V3.filter(phrase =>
    statement.toLowerCase().includes(phrase.toLowerCase())
  )
  return { wordCount, wordCountOk, bannedPhrasesFound }
}

function buildCandidateFacts(client: Client): string {
  // Privacy: never send client.full_name to an AI provider
  const parts: string[] = []
  if (client.work_history) parts.push(`Work history: ${client.work_history}`)
  if (client.qualifications) parts.push(`Qualifications: ${client.qualifications}`)
  if (client.background) parts.push(`Background: ${client.background}`)
  if (client.skills) parts.push(`Skills: ${client.skills}`)
  if (client.q_difficult_situation) parts.push(`Difficult situation: ${client.q_difficult_situation}`)
  if (client.q_proudest_moment) parts.push(`Proudest moment: ${client.q_proudest_moment}`)
  if (client.q_colleagues_say) parts.push(`Colleagues say: ${client.q_colleagues_say}`)
  if (client.q_skills_equipment) parts.push(`Skills and equipment: ${client.q_skills_equipment}`)
  if (client.q_why_trust) parts.push(`Why this trust: ${client.q_why_trust}`)
  return parts.join('\n\n') || 'No candidate facts available.'
}

export async function runNHSV3Pipeline(
  statement: string,
  analysis: StatementAnalysis,
  client: Client
): Promise<CoverageReport> {
  const auditorPrompt = readPromptFile('nhs_v3_auditor_prompt.md')

  // If V3 auditor prompt is missing, fall back gracefully
  if (!auditorPrompt) {
    console.warn('V3 auditor prompt missing — skipping V3 pipeline audit')
    const det = deterministicCheck(statement)
    return {
      allPass: det.wordCountOk && det.bannedPhrasesFound.length === 0,
      criteria: [],
      patched: false,
      warningBanner: det.bannedPhrasesFound.length > 0 ? [`Banned phrases found: ${det.bannedPhrasesFound.join(', ')}`] : null,
      banned_words_found: det.bannedPhrasesFound,
      missing_sections: [],
      verdict: det.wordCountOk ? 'word count ok' : `word count ${det.wordCount} (out of range)`,
      tokenUsage: { auditInputTokens: 0, auditOutputTokens: 0, patchInputTokens: 0, patchOutputTokens: 0 },
    }
  }

  const essentialCriteria = analysis.essentialCriteria ?? []
  const desirableCriteria = analysis.desirableCriteria ?? []
  const allCriteria = [...essentialCriteria, ...desirableCriteria]
  const methodTag = (c: string) => {
    const m = analysis.criteriaMethods?.[c]
    return m && !m.includes('A') ? ` [${m}]` : ''
  }

  const criteriaText = [
    'Essential:',
    ...essentialCriteria.map((c, i) => `E${i + 1}. ${c}${methodTag(c)}`),
    'Desirable:',
    ...desirableCriteria.map((c, i) => `D${i + 1}. ${c}${methodTag(c)}`),
  ].join('\n')

  const tokenUsage = { auditInputTokens: 0, auditOutputTokens: 0, patchInputTokens: 0, patchOutputTokens: 0 }

  // ── First audit ────────────────────────────────────────────────────────────
  const candidateFacts = buildCandidateFacts(client)
  const buildAuditMsg = (text: string) =>
    `PERSON SPECIFICATION:\n${criteriaText}\n\nCANDIDATE FACTS:\n${candidateFacts}\n\nSTATEMENT:\n${text}`
  const userMsg = buildAuditMsg(statement)

  const auditMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 3000,
    temperature: 0,
    system: auditorPrompt,
    messages: [{ role: 'user', content: userMsg }],
  }, { timeout: 60000 })
  tokenUsage.auditInputTokens += auditMsg.usage.input_tokens
  tokenUsage.auditOutputTokens += auditMsg.usage.output_tokens

  let auditResult: {
    criteria?: Array<{ id: string; criterion: string; score: number; location: string; reason: string }>
    all_pass?: boolean
    failing_ids?: string[]
    real_job_titles_used?: boolean
    no_invented_facts?: boolean
    invented_facts_found?: string[]
    ai_tells_found?: string[]
    buried_criteria?: string[]
    relevant_experience_dated_and_sized?: boolean
    six_structure_parts_present?: Record<string, boolean>  // legacy field name
    five_structure_parts_present?: Record<string, boolean>
    word_count?: number
    word_count_ok?: boolean
    banned_phrases_found?: string[]
    verdict?: string
    non_uk_locations?: string[]
  } = {}

  const auditText = auditMsg.content[0]?.type === 'text' ? auditMsg.content[0].text : ''
  const jsonMatch = auditText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try { auditResult = JSON.parse(jsonMatch[0]) } catch { /* non-critical */ }
  }

  const det = deterministicCheck(statement)
  const failingIds = auditResult.failing_ids ?? []
  const bannedFound = [...(auditResult.banned_phrases_found ?? []), ...det.bannedPhrasesFound]
  const firstAllPass = (auditResult.all_pass ?? false) && bannedFound.length === 0 && det.wordCountOk

  // ── Deterministic verify ───────────────────────────────────────────────────
  let criteriaChecks = verifyCriteriaV3(statement, essentialCriteria, desirableCriteria)

  // A criterion that cannot be found in the text is always a failure: shortlisters score
  // each one and will not search for it.
  // Credentials the candidate may not hold (certificates, formally trained procedures) are
  // never "fixed" by writing about them, so they do not trigger a repair.
  const credentialLike = (wording: string) =>
    analysis.criteriaMethods?.[wording] === 'C' || /\b(venepuncture|cannulat|catheteris|phlebotomy)/i.test(wording)
  const notFoundIds = criteriaChecks.filter(c => !c.found && !credentialLike(c.wording)).map(c => c.id)
  const combinedFailingIds = [...new Set([...failingIds, ...notFoundIds])]

  let currentStatement = statement
  let patched = false

  // ── Patch if needed: rewrite only the affected paragraphs, splice in code ───
  if (combinedFailingIds.length > 0) {
    try {
      const idOf = (i: number) => i < essentialCriteria.length ? `E${i + 1}` : `D${i - essentialCriteria.length + 1}`
      const failingLines = allCriteria
        .map((c, i) => ({ id: idOf(i), c }))
        .filter(x => combinedFailingIds.includes(x.id))
        .map(x => {
          const reason = (auditResult.criteria ?? []).find(a => a.id === x.id)?.reason
          return `${x.id}. ${x.c}${reason ? ` (auditor: ${reason})` : ''}`
        })

      const paragraphs = statement.split(/\n\n+/).filter(p => p.trim())
      const numbered = paragraphs
        .map((p, i) => `[${i + 1}]${isHeading(p) ? ' (heading)' : ''} ${p.trim()}`)
        .join('\n\n')

      const patchMsg = await anthropic.messages.create({
        model: process.env.GENERATION_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: PATCH_SYSTEM,
        messages: [{
          role: 'user',
          content: `CRITERIA TO FIX:\n${failingLines.join('\n')}\n\nCANDIDATE FACTS:\n${candidateFacts}\n\nSTATEMENT PARAGRAPHS:\n${numbered}`,
        }],
      }, { timeout: 90000 })
      tokenUsage.patchInputTokens += patchMsg.usage.input_tokens
      tokenUsage.patchOutputTokens += patchMsg.usage.output_tokens

      const patchText = patchMsg.content[0]?.type === 'text' ? patchMsg.content[0].text : ''
      const patchJson = patchText.match(/\{[\s\S]*\}/)
      const parsed: { edits?: Array<{ paragraph?: number; text?: string }> } = patchJson ? JSON.parse(patchJson[0]) : {}

      const next = [...paragraphs]
      let applied = 0
      for (const edit of parsed.edits ?? []) {
        if (applied >= MAX_PATCHED_PARAGRAPHS) break
        const idx = (edit.paragraph ?? 0) - 1
        const text = (edit.text ?? '')
          .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2')
          .replace(/\s*[–—]\s*/g, ', ')
          .replace(/\*\*/g, '')
          .replace(/\s*\(?\b[ED]\d+\b\)?/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        if (idx < 0 || idx >= next.length || isHeading(next[idx])) continue
        const wc = countWords(text)
        if (wc < 30 || wc > 170) continue
        next[idx] = text
        applied++
      }

      const candidate = next.join('\n\n')
      if (applied > 0 && countWords(candidate) <= WORD_COUNT_MAX) {
        currentStatement = candidate
        patched = true
        console.log(`V3_PATCH paragraphs_rewritten=${applied} criteria=${combinedFailingIds.join(',')}`)
      }
    } catch (err) {
      console.warn('V3_PATCH failed (non-fatal):', err instanceof Error ? err.message : err)
    }

    // Re-audit once so the reported scores describe the text the user actually receives
    if (patched) {
      try {
        const reAuditMsg = await anthropic.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 3000,
          temperature: 0,
          system: auditorPrompt,
          messages: [{ role: 'user', content: buildAuditMsg(currentStatement) }],
        }, { timeout: 60000 })
        tokenUsage.auditInputTokens += reAuditMsg.usage.input_tokens
        tokenUsage.auditOutputTokens += reAuditMsg.usage.output_tokens
        const reAuditText = reAuditMsg.content[0]?.type === 'text' ? reAuditMsg.content[0].text : ''
        const reJsonMatch = reAuditText.match(/\{[\s\S]*\}/)
        if (reJsonMatch) {
          const reAudit = JSON.parse(reJsonMatch[0])
          if (Array.isArray(reAudit.criteria) && reAudit.criteria.length > 0) auditResult = reAudit
        }
        criteriaChecks = verifyCriteriaV3(currentStatement, essentialCriteria, desirableCriteria)
      } catch { /* non-critical — keep first audit */ }
    }
  }

  // ── Build CoverageReport ───────────────────────────────────────────────────
  const finalDet = deterministicCheck(currentStatement)
  const criteria: CriterionCoverage[] = (auditResult.criteria ?? []).map(c => ({
    criterion: c.criterion,
    type: c.id.startsWith('E') ? 'essential' : 'desirable',
    score: c.score,
    pass: c.score >= 4,
    location: c.location ?? null,
    reason: c.reason ?? '',
    deterministicPresent: criteriaChecks.find(ch => ch.id === c.id)?.found ?? false,
  }))

  const allPass = (auditResult.all_pass ?? false) && finalDet.bannedPhrasesFound.length === 0 && finalDet.wordCountOk
  const warningBanners: string[] = []
  if (!finalDet.wordCountOk) warningBanners.push(`Word count ${finalDet.wordCount} (target 1,150–1,400)`)
  if (finalDet.bannedPhrasesFound.length > 0) warningBanners.push(`Banned phrases: ${finalDet.bannedPhrasesFound.join(', ')}`)
  if (auditResult.ai_tells_found?.length) warningBanners.push(`Reads as machine-written in places: ${auditResult.ai_tells_found.slice(0, 4).join('; ')}`)
  if (auditResult.buried_criteria?.length) warningBanners.push(`Hard-to-find criteria: ${auditResult.buried_criteria.slice(0, 4).join('; ')}`)
  if (auditResult.relevant_experience_dated_and_sized === false) warningBanners.push('Most relevant role has no duration or scale: ask the candidate for dates and unit size')
  if (auditResult.non_uk_locations?.length) warningBanners.push(`Non-UK locations: ${auditResult.non_uk_locations.join(', ')}`)

  return {
    allPass,
    criteria,
    patched,
    patchedStatement: patched ? currentStatement : undefined,
    warningBanner: warningBanners.length > 0 ? warningBanners : null,
    banned_words_found: [...finalDet.bannedPhrasesFound, ...(auditResult.banned_phrases_found ?? [])],
    missing_sections: [],
    verdict: auditResult.verdict ?? (allPass ? 'shortlist-safe' : 'reject-risk'),
    tokenUsage,
  }
}
