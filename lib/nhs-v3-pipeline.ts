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

const WORD_COUNT_MIN = 1380
const WORD_COUNT_MAX = 1420
const MAX_PATCHES = 2

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

export async function runNHSV3Pipeline(
  statement: string,
  analysis: StatementAnalysis,
  client: Client
): Promise<CoverageReport> {
  const auditorPrompt = readPromptFile('nhs_v3_auditor_prompt.md')
  const patchPrompt = readPromptFile('nhs_v2_patch_prompt.md')

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

  const criteriaText = [
    'Essential:',
    ...essentialCriteria.map((c, i) => `E${i + 1}. ${c}`),
    'Desirable:',
    ...desirableCriteria.map((c, i) => `D${i + 1}. ${c}`),
  ].join('\n')

  let tokenUsage = { auditInputTokens: 0, auditOutputTokens: 0, patchInputTokens: 0, patchOutputTokens: 0 }

  // ── First audit ────────────────────────────────────────────────────────────
  const userMsg = `PERSON SPECIFICATION:\n${criteriaText}\n\nSTATEMENT:\n${statement}`

  const auditMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 3000,
    temperature: 0,
    system: auditorPrompt,
    messages: [{ role: 'user', content: userMsg }],
  })
  tokenUsage.auditInputTokens += auditMsg.usage.input_tokens
  tokenUsage.auditOutputTokens += auditMsg.usage.output_tokens

  let auditResult: {
    criteria?: Array<{ id: string; criterion: string; score: number; location: string; reason: string }>
    all_pass?: boolean
    failing_ids?: string[]
    real_job_titles_used?: boolean
    no_invented_facts?: boolean
    six_structure_parts_present?: Record<string, boolean>
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
  const criteriaChecks = verifyCriteriaV3(statement, essentialCriteria, desirableCriteria)
  const notFoundIds = criteriaChecks.filter(c => !c.found).map(c => c.id)

  // Merge NOT FOUND into failing_ids
  const combinedFailingIds = [...new Set([...failingIds, ...notFoundIds])]

  let currentStatement = statement
  let patched = false

  // ── Patch if needed ────────────────────────────────────────────────────────
  if (!firstAllPass && combinedFailingIds.length > 0 && patchPrompt) {
    for (let attempt = 0; attempt < MAX_PATCHES; attempt++) {
      const failingCriteria = allCriteria.filter((_, i) => {
        const id = i < essentialCriteria.length ? `E${i + 1}` : `D${i - essentialCriteria.length + 1}`
        return combinedFailingIds.includes(id)
      })

      const patchMsg = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 2400,
        temperature: 0.7,
        system: patchPrompt,
        messages: [{
          role: 'user',
          content: `FAILING CRITERIA:\n${failingCriteria.join('\n')}\n\nSTATEMENT:\n${currentStatement}`,
        }],
      })
      tokenUsage.patchInputTokens += patchMsg.usage.input_tokens
      tokenUsage.patchOutputTokens += patchMsg.usage.output_tokens

      const patchText = patchMsg.content[0]?.type === 'text' ? patchMsg.content[0].text.trim() : ''
      if (patchText && patchText.length > 200) {
        currentStatement = patchText
        patched = true
      }

      // Re-audit
      const reAuditMsg = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 3000,
        temperature: 0,
        system: auditorPrompt,
        messages: [{ role: 'user', content: `PERSON SPECIFICATION:\n${criteriaText}\n\nSTATEMENT:\n${currentStatement}` }],
      })
      tokenUsage.auditInputTokens += reAuditMsg.usage.input_tokens
      tokenUsage.auditOutputTokens += reAuditMsg.usage.output_tokens

      const reAuditText = reAuditMsg.content[0]?.type === 'text' ? reAuditMsg.content[0].text : ''
      const reJsonMatch = reAuditText.match(/\{[\s\S]*\}/)
      if (reJsonMatch) {
        try {
          const reAudit = JSON.parse(reJsonMatch[0])
          if (reAudit.all_pass) {
            auditResult = reAudit
            break
          }
        } catch { /* non-critical */ }
      }
    }
  }

  // ── Build CoverageReport ───────────────────────────────────────────────────
  const finalDet = deterministicCheck(currentStatement)
  const criteria: CriterionCoverage[] = (auditResult.criteria ?? []).map(c => ({
    criterion: c.criterion,
    type: c.id.startsWith('E') ? 'essential' : 'desirable',
    score: c.score,
    pass: c.score >= 5,
    location: c.location ?? null,
    reason: c.reason ?? '',
    deterministicPresent: criteriaChecks.find(ch => ch.id === c.id)?.found ?? false,
  }))

  const allPass = (auditResult.all_pass ?? false) && finalDet.bannedPhrasesFound.length === 0 && finalDet.wordCountOk
  const warningBanners: string[] = []
  if (!finalDet.wordCountOk) warningBanners.push(`Word count ${finalDet.wordCount} (target 1,380–1,420)`)
  if (finalDet.bannedPhrasesFound.length > 0) warningBanners.push(`Banned phrases: ${finalDet.bannedPhrasesFound.join(', ')}`)
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
