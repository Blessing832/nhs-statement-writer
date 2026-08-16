import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { Client, StatementAnalysis, CoverageReport, CriterionCoverage } from './types'
import { verifyCriteria } from './verify-criteria'
import { scanBanned, BannedWordHit } from './bannedWords'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function readPromptFile(name: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), name), 'utf-8')
  } catch {
    throw new Error(`Missing prompt file: ${name}. Add it to the repo root.`)
  }
}

function parseAuditJson(text: string): AuditResponse {
  const clean = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  return JSON.parse(clean)
}

interface AuditCriterion {
  id: string
  criterion: string
  score: number
  location: string
  reason: string
  essential?: boolean
}

interface AuditResponse {
  criteria: AuditCriterion[]
  all_pass: boolean
  failing_ids: string[]
  opening_ok: boolean
  completion_ok: boolean
  missing_sections: string[]
  banned_words_found: string[]
  oversized_paragraphs: string[]
  trust_values_present?: boolean
  board_values_present?: boolean
  verdict: string
}

interface AuditResult {
  response: AuditResponse
  inputTokens: number
  outputTokens: number
}

async function auditStatement(
  personSpec: string,
  statement: string,
  auditorPromptFile: string
): Promise<AuditResult> {
  const systemPrompt = readPromptFile(auditorPromptFile)
  const userMessage = `## PERSON SPECIFICATION\n${personSpec}\n\n## STATEMENT\n${statement}`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const response = parseAuditJson(text)

  return {
    response,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  }
}

interface PatchResult {
  statement: string
  inputTokens: number
  outputTokens: number
}

async function patchStatement(
  statement: string,
  failingCriteria: AuditCriterion[],
  candidateFacts: string,
  patchPromptFile: string
): Promise<PatchResult> {
  const systemPrompt = readPromptFile(patchPromptFile)
  const userMessage = [
    '## STATEMENT',
    statement,
    '',
    '## FAILING CRITERIA',
    JSON.stringify(failingCriteria, null, 2),
    '',
    '## CANDIDATE FACTS',
    candidateFacts,
  ].join('\n')

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : statement

  return {
    statement: text
      .replace(/ — /g, ', ')
      .replace(/—/g, ', ')
      .replace(/\*\*/g, ''),
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  }
}

function buildPersonSpecText(analysis: StatementAnalysis): string {
  const lines: string[] = ['ESSENTIAL:']
  analysis.essentialCriteria.forEach((c, i) => lines.push(`E${i + 1}. ${c}`))
  lines.push('', 'DESIRABLE:')
  analysis.desirableCriteria.forEach((c, i) => lines.push(`D${i + 1}. ${c}`))
  return lines.join('\n')
}

function buildCandidateFacts(client: Client): string {
  return [
    `Work History: ${client.work_history}`,
    `Qualifications: ${client.qualifications}`,
    `Skills: ${client.skills}`,
    client.background ? `Additional Background: ${client.background}` : '',
  ].filter(Boolean).join('\n\n')
}

function mergeCoverage(
  auditCriteria: AuditCriterion[],
  verifyMissingSet: Set<string>,
  essentialSet: Set<string>,
  desirableSet: Set<string>
): CriterionCoverage[] {
  return auditCriteria.map(ac => ({
    criterion: ac.criterion,
    type: (essentialSet.has(ac.criterion) ? 'essential' : desirableSet.has(ac.criterion) ? 'desirable' : ac.essential ? 'essential' : 'desirable') as 'essential' | 'desirable',
    score: ac.score,
    pass: ac.score >= 5,
    location: ac.location === 'MISSING' ? null : ac.location,
    reason: ac.reason,
    deterministicPresent: !verifyMissingSet.has(ac.criterion),
  }))
}

function bannedHitsToAuditEntries(hits: BannedWordHit[]): AuditCriterion[] {
  return hits.map((hit, i) => ({
    id: `BW${i + 1}`,
    criterion: `Remove banned word: "${hit.word}" — rewrite the sentence without it or any of its inflections`,
    score: 0,
    location: `Sentence: "${hit.sentence.slice(0, 100)}${hit.sentence.length > 100 ? '…' : ''}"`,
    reason: `Banned word "${hit.found}" found. Rewrite without changing the surrounding meaning.`,
  }))
}

function trimToWordLimit(text: string, limit: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= limit) return text

  const CLOSING = 'Thank you.'
  const closingIdx = text.indexOf(CLOSING)
  const statementPart = closingIdx >= 0 ? text.slice(0, closingIdx + CLOSING.length) : text
  const questionsTail = closingIdx >= 0 ? text.slice(closingIdx + CLOSING.length) : ''

  const paragraphs = statementPart.split(/\n\n+/)
  let totalWords = 0
  const kept: string[] = []
  for (const para of paragraphs) {
    const paraWordCount = para.trim().split(/\s+/).filter(Boolean).length
    if (totalWords + paraWordCount <= limit) {
      kept.push(para)
      totalWords += paraWordCount
    } else {
      const remaining = limit - totalWords
      if (remaining > 15) {
        const paraWords = para.trim().split(/\s+/)
        const partial = paraWords.slice(0, remaining).join(' ')
        const lastPeriod = partial.lastIndexOf('.')
        if (lastPeriod > partial.length * 0.6) kept.push(partial.slice(0, lastPeriod + 1))
      }
      break
    }
  }
  while (kept.length > 0 && /^\*\*[^*]+\*\*$/.test(kept[kept.length - 1].trim())) {
    kept.pop()
  }
  let truncated = kept.join('\n\n')
  if (!truncated.trimEnd().endsWith(CLOSING)) truncated += '\n\n' + CLOSING
  return truncated + questionsTail
}

interface PipelineConfig {
  auditorPromptFile: string
  patchPromptFile: string
  label: string
  wordLimit: number
}

async function runPipeline(
  statement: string,
  analysis: StatementAnalysis,
  client: Client,
  config: PipelineConfig
): Promise<CoverageReport> {
  const essential = analysis.essentialCriteria ?? []
  const desirable = analysis.desirableCriteria ?? []
  const allCriteria = [...essential, ...desirable]
  const essentialSet = new Set(essential)
  const desirableSet = new Set(desirable)

  if (allCriteria.length === 0) {
    return {
      allPass: true,
      criteria: [],
      patched: false,
      warningBanner: null,
      banned_words_found: [],
      missing_sections: [],
      verdict: 'No person specification criteria found.',
      tokenUsage: { auditInputTokens: 0, auditOutputTokens: 0, patchInputTokens: 0, patchOutputTokens: 0 },
    }
  }

  const personSpecText = buildPersonSpecText(analysis)
  const candidateFacts = buildCandidateFacts(client)

  // ── Round 1: deterministic scans ─────────────────────────────────────────
  const verify1 = verifyCriteria(statement, allCriteria)
  const missingSet1 = new Set(verify1.missing.map(v => v.criterion))
  const bannedHits1 = scanBanned(statement)
  if (bannedHits1.length > 0) {
    console.log(`${config.label} banned scan: ${bannedHits1.map(h => `"${h.found}"`).join(', ')}`)
  }

  let audit1: AuditResult
  try {
    audit1 = await auditStatement(personSpecText, statement, config.auditorPromptFile)
  } catch (err) {
    console.error(`${config.label} AUDIT_ERR round1:`, err)
    return {
      allPass: verify1.missing.length === 0 && bannedHits1.length === 0,
      criteria: allCriteria.map(c => ({
        criterion: c,
        type: essentialSet.has(c) ? 'essential' : 'desirable',
        score: missingSet1.has(c) ? 0 : 3,
        pass: !missingSet1.has(c),
        location: null,
        reason: missingSet1.has(c) ? 'Not found by keyword check' : 'Found by keyword check',
        deterministicPresent: !missingSet1.has(c),
      })),
      patched: false,
      warningBanner: verify1.missing.length > 0 ? verify1.missing.map(m => m.criterion) : null,
      banned_words_found: bannedHits1.map(h => h.found),
      missing_sections: [],
      verdict: 'Audit unavailable — keyword check used as fallback.',
      tokenUsage: { auditInputTokens: 0, auditOutputTokens: 0, patchInputTokens: 0, patchOutputTokens: 0 },
    }
  }

  console.log(`${config.label} audit1 tokens: in=${audit1.inputTokens} out=${audit1.outputTokens} all_pass=${audit1.response.all_pass}`)

  // ── Patch — only for essential failures and banned words ─────────────────
  // Desirable-only misses are shown in the coverage report but don't block.
  const essentialFailing = audit1.response.criteria.filter(
    ac => ac.score < 5 && essentialSet.has(ac.criterion)
  )
  const needsPatch = essentialFailing.length > 0 || bannedHits1.length > 0

  if (!needsPatch) {
    return {
      allPass: true,
      criteria: mergeCoverage(audit1.response.criteria, missingSet1, essentialSet, desirableSet),
      patched: false,
      warningBanner: null,
      banned_words_found: audit1.response.banned_words_found,
      missing_sections: audit1.response.missing_sections,
      verdict: audit1.response.verdict,
      tokenUsage: {
        auditInputTokens: audit1.inputTokens,
        auditOutputTokens: audit1.outputTokens,
        patchInputTokens: 0,
        patchOutputTokens: 0,
      },
    }
  }

  // ── Patch ─────────────────────────────────────────────────────────────────
  // Focus the patcher only on essential failures + banned words so it's concise and fast.
  const auditFailingEssentialIds = new Set(
    audit1.response.criteria
      .filter(ac => ac.score < 5 && essentialSet.has(ac.criterion))
      .map(ac => ac.id)
  )
  const deterministicEssentialMisses = audit1.response.criteria.filter(
    ac => missingSet1.has(ac.criterion) && essentialSet.has(ac.criterion) && !auditFailingEssentialIds.has(ac.id)
  )
  const failingCriteria = [
    ...bannedHitsToAuditEntries(bannedHits1),
    ...audit1.response.criteria.filter(ac => auditFailingEssentialIds.has(ac.id)),
    ...deterministicEssentialMisses,
  ]

  let patchedStatement = statement
  let patchTokens = { input: 0, output: 0 }

  try {
    const patchResult = await patchStatement(statement, failingCriteria, candidateFacts, config.patchPromptFile)
    patchedStatement = trimToWordLimit(patchResult.statement, config.wordLimit)
    patchTokens = { input: patchResult.inputTokens, output: patchResult.outputTokens }
    const patchedWordCount = patchedStatement.trim().split(/\s+/).filter(Boolean).length
    console.log(`${config.label} patch tokens: in=${patchTokens.input} out=${patchTokens.output} words=${patchedWordCount}`)
    // Post-patch banned-word scan — patcher must not introduce new banned words
    const postPatchBanned = scanBanned(patchedStatement)
    if (postPatchBanned.length > 0) {
      console.warn(`${config.label} post-patch banned words still present: ${postPatchBanned.map(h => `"${h.found}"`).join(', ')}`)
    }
  } catch (err) {
    console.error(`${config.label} PATCH_ERR:`, err)
    return {
      allPass: false,
      criteria: mergeCoverage(audit1.response.criteria, missingSet1, essentialSet, desirableSet),
      patched: false,
      warningBanner: failingCriteria.map(fc => fc.criterion),
      banned_words_found: audit1.response.banned_words_found,
      missing_sections: audit1.response.missing_sections,
      verdict: audit1.response.verdict,
      tokenUsage: {
        auditInputTokens: audit1.inputTokens,
        auditOutputTokens: audit1.outputTokens,
        patchInputTokens: 0,
        patchOutputTokens: 0,
      },
    }
  }

  // ── Round 2: deterministic scans + audit ─────────────────────────────────
  const bannedHits2 = scanBanned(patchedStatement)
  const verify2 = verifyCriteria(patchedStatement, allCriteria)
  const missingSet2 = new Set(verify2.missing.map(v => v.criterion))

  let audit2: AuditResult
  try {
    audit2 = await auditStatement(personSpecText, patchedStatement, config.auditorPromptFile)
    console.log(`${config.label} audit2 tokens: in=${audit2.inputTokens} out=${audit2.outputTokens} all_pass=${audit2.response.all_pass}`)
  } catch (err) {
    console.error(`${config.label} AUDIT_ERR round2:`, err)
    return {
      allPass: false,
      criteria: mergeCoverage(audit1.response.criteria, missingSet2, essentialSet, desirableSet),
      patched: true,
      warningBanner: failingCriteria.map(fc => fc.criterion),
      banned_words_found: audit1.response.banned_words_found,
      missing_sections: audit1.response.missing_sections,
      verdict: audit1.response.verdict,
      tokenUsage: {
        auditInputTokens: audit1.inputTokens,
        auditOutputTokens: audit1.outputTokens,
        patchInputTokens: patchTokens.input,
        patchOutputTokens: patchTokens.output,
      },
    }
  }

  const stillFailing = audit2.response.criteria.filter(ac => ac.score < 5 && essentialSet.has(ac.criterion))
  const warningBanner = (!audit2.response.all_pass && stillFailing.length > 0)
    ? stillFailing.map(ac => `${ac.id}: ${ac.criterion} (score ${ac.score}/5 — ${ac.reason})`)
    : null

  // Merge LLM-detected and deterministic post-patch banned words, deduplicated
  const finalBannedWords = [
    ...new Set([...audit2.response.banned_words_found, ...bannedHits2.map(h => h.found)]),
  ]

  return {
    allPass: audit2.response.all_pass && bannedHits2.length === 0,
    criteria: mergeCoverage(audit2.response.criteria, missingSet2, essentialSet, desirableSet),
    patched: true,
    patchedStatement,
    warningBanner,
    banned_words_found: finalBannedWords,
    missing_sections: audit2.response.missing_sections,
    verdict: audit2.response.verdict,
    tokenUsage: {
      auditInputTokens: audit1.inputTokens + audit2.inputTokens,
      auditOutputTokens: audit1.outputTokens + audit2.outputTokens,
      patchInputTokens: patchTokens.input,
      patchOutputTokens: patchTokens.output,
    },
  }
}

export async function runEnglandWalesPipeline(
  statement: string,
  analysis: StatementAnalysis,
  client: Client
): Promise<CoverageReport> {
  return runPipeline(statement, analysis, client, {
    auditorPromptFile: 'auditor_prompt.md',
    patchPromptFile: 'patch_prompt.md',
    label: 'PIPELINE[EW]',
    wordLimit: 1400,
  })
}

export async function runScotlandPipeline(
  statement: string,
  analysis: StatementAnalysis,
  client: Client
): Promise<CoverageReport> {
  return runPipeline(statement, analysis, client, {
    auditorPromptFile: 'auditor_prompt_scotland.md',
    patchPromptFile: 'patch_prompt_scotland.md',
    label: 'PIPELINE[SCO]',
    wordLimit: 1130,
  })
}
