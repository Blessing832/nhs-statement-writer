import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { Client, StatementAnalysis, CoverageReport, CriterionCoverage } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const BANNED_PHRASES = [
  'I demonstrate',
  'I have the ability to',
  'Evidence of',
  'I possess',
  'My role requires',
  'The post holder',
  'Ability to demonstrate',
  'Ability to work',
  'Ability to communicate',
]

const WORD_COUNT_MIN = 1380
const WORD_COUNT_MAX = 1420
const MAX_PATCHES = 3

function readPromptFile(name: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), name), 'utf-8')
  } catch {
    throw new Error(`Missing prompt file: ${name}. Add it to the repo root.`)
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
  const bannedPhrasesFound = BANNED_PHRASES.filter(phrase =>
    statement.toLowerCase().includes(phrase.toLowerCase())
  )
  return { wordCount, wordCountOk, bannedPhrasesFound }
}

function trimToWordLimit(text: string, limit: number): string {
  if (countWords(text) <= limit) return text
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
  while (kept.length > 0 && /^\*\*[^*]+\*\*$/.test(kept[kept.length - 1].trim())) kept.pop()
  let truncated = kept.join('\n\n')
  if (!truncated.trimEnd().endsWith(CLOSING)) truncated += '\n\n' + CLOSING
  return truncated + questionsTail
}

interface V2AuditCriterion {
  id: string
  criterion: string
  score: number
  location: string
  reason: string
}

interface V2OpeningItems {
  current_role: boolean
  previous_role_vacancy_title: boolean
  motivation: boolean
  five_conditions: boolean
  three_procedures: boolean
  qualification_requirements: boolean
  department_contribution: boolean
}

interface V2AuditResponse {
  criteria: V2AuditCriterion[]
  all_pass: boolean
  failing_ids: string[]
  opening_seven_items_present: V2OpeningItems
  halo_effect_present: boolean
  paragraph_2_trust_snapshot_ok: boolean
  word_count: number
  word_count_ok: boolean
  opener_violations: string[]
  common_pattern_flags: string[]
  training_claim_flags: string[]
  primary_workplace_flags: string[]
  vacancy_title_ok: boolean
  umbrella_heading_ok: boolean
  banned_phrases_found: string[]
  repeated_verbs: string[]
  consistency_issues: string[]
  verdict: string
}

function parseV2AuditJson(text: string): V2AuditResponse {
  const clean = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  const json = JSON.parse(clean)
  json.failing_ids = json.failing_ids ?? []
  json.opener_violations = json.opener_violations ?? []
  json.common_pattern_flags = json.common_pattern_flags ?? []
  json.training_claim_flags = json.training_claim_flags ?? []
  json.primary_workplace_flags = json.primary_workplace_flags ?? []
  json.banned_phrases_found = json.banned_phrases_found ?? []
  json.repeated_verbs = json.repeated_verbs ?? []
  json.consistency_issues = json.consistency_issues ?? []
  json.criteria = json.criteria ?? []
  return json
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

async function v2Audit(
  personSpecText: string,
  statement: string,
): Promise<{ response: V2AuditResponse; inputTokens: number; outputTokens: number }> {
  const systemPrompt = readPromptFile('nhs_v2_auditor_prompt.md')
  const userMessage = `## PERSON SPECIFICATION\n${personSpecText}\n\n## STATEMENT\n${statement}`
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  return {
    response: parseV2AuditJson(text),
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  }
}

async function v2Patch(
  statement: string,
  auditResult: V2AuditResponse,
  candidateFacts: string,
): Promise<{ statement: string; inputTokens: number; outputTokens: number }> {
  const systemPrompt = readPromptFile('nhs_v2_patch_prompt.md')
  const userMessage = [
    '## STATEMENT',
    statement,
    '',
    '## AUDIT RESULT',
    JSON.stringify(auditResult, null, 2),
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
    statement: text.replace(/ — /g, ', ').replace(/—/g, ', ').replace(/\*\*/g, ''),
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
  }
}

function mapCriteria(criteria: V2AuditCriterion[]): CriterionCoverage[] {
  return criteria.map(ac => ({
    criterion: ac.criterion,
    type: (ac.id.startsWith('E') ? 'essential' : 'desirable') as 'essential' | 'desirable',
    score: ac.score,
    pass: ac.score >= 5,
    location: ac.location === 'MISSING' ? null : ac.location,
    reason: ac.reason,
    deterministicPresent: ac.location !== 'MISSING',
  }))
}

function isPassingState(audit: V2AuditResponse, det: DeterministicResult): boolean {
  return audit.all_pass && det.wordCountOk && det.bannedPhrasesFound.length === 0
}

export async function runNHSV2Pipeline(
  statement: string,
  analysis: StatementAnalysis,
  client: Client,
): Promise<CoverageReport> {
  const essential = analysis.essentialCriteria ?? []
  if (essential.length === 0) {
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

  let current = statement
  let latestAudit: V2AuditResponse | null = null
  let totalAuditIn = 0, totalAuditOut = 0, totalPatchIn = 0, totalPatchOut = 0
  let patched = false
  let patchCount = 0

  for (let attempt = 0; attempt <= MAX_PATCHES; attempt++) {
    // Step 2: deterministic check
    const det = deterministicCheck(current)
    console.log(`NHSV2[${attempt}] wordCount=${det.wordCount} wordCountOk=${det.wordCountOk} bannedPhrases=${det.bannedPhrasesFound.join(',')||'none'}`)

    // Step 3: audit (Haiku)
    let auditResult: { response: V2AuditResponse; inputTokens: number; outputTokens: number }
    try {
      auditResult = await v2Audit(personSpecText, current)
      totalAuditIn += auditResult.inputTokens
      totalAuditOut += auditResult.outputTokens
      latestAudit = auditResult.response
      console.log(`NHSV2[${attempt}] audit all_pass=${auditResult.response.all_pass} failing=${JSON.stringify(auditResult.response.failing_ids)} wordCountOk=${auditResult.response.word_count_ok}`)
    } catch (err) {
      console.error(`NHSV2 AUDIT_ERR[${attempt}]:`, err)
      break
    }

    // Step 4: done if all checks pass
    if (isPassingState(auditResult.response, det)) {
      console.log(`NHSV2 passed at attempt=${attempt}`)
      break
    }

    // No more patches after MAX_PATCHES
    if (attempt >= MAX_PATCHES) {
      console.warn(`NHSV2 still failing after ${MAX_PATCHES} patches — returning with warning`)
      break
    }

    // Step 4: patch (Sonnet)
    try {
      const patch = await v2Patch(current, auditResult.response, candidateFacts)
      totalPatchIn += patch.inputTokens
      totalPatchOut += patch.outputTokens
      patchCount++
      current = trimToWordLimit(patch.statement, WORD_COUNT_MAX)
      patched = true
      console.log(`NHSV2 patch#${patchCount} tokens: in=${patch.inputTokens} out=${patch.outputTokens} words=${countWords(current)}`)
    } catch (err) {
      console.error(`NHSV2 PATCH_ERR[${attempt}]:`, err)
      break
    }
  }

  // Step 6: build coverage report from latest audit
  if (!latestAudit) {
    return {
      allPass: false,
      criteria: [],
      patched,
      patchedStatement: patched ? current : undefined,
      warningBanner: ['Audit unavailable — please review statement manually'],
      banned_words_found: [],
      missing_sections: [],
      verdict: 'Audit failed — could not verify coverage.',
      tokenUsage: {
        auditInputTokens: totalAuditIn,
        auditOutputTokens: totalAuditOut,
        patchInputTokens: totalPatchIn,
        patchOutputTokens: totalPatchOut,
      },
    }
  }

  const finalDet = deterministicCheck(current)
  const warningBanner: string[] = []

  if (!finalDet.wordCountOk) {
    warningBanner.push(`Word count ${finalDet.wordCount} — target 1,380-1,420`)
  }
  for (const p of finalDet.bannedPhrasesFound) {
    warningBanner.push(`Banned phrase: "${p}"`)
  }
  for (const ac of latestAudit.criteria.filter(c => c.id.startsWith('E') && c.score < 5)) {
    warningBanner.push(`${ac.id}: ${ac.criterion} (score ${ac.score}/5 — ${ac.reason})`)
  }
  for (const v of latestAudit.opener_violations) {
    warningBanner.push(v)
  }

  const allPassFinal = isPassingState(latestAudit, finalDet)

  console.log(
    `NHSV2 final: allPass=${allPassFinal} wordCount=${finalDet.wordCount} patches=${patchCount}` +
    ` audit_in=${totalAuditIn} audit_out=${totalAuditOut} patch_in=${totalPatchIn} patch_out=${totalPatchOut}`
  )

  return {
    allPass: allPassFinal,
    criteria: mapCriteria(latestAudit.criteria),
    patched,
    patchedStatement: patched ? current : undefined,
    warningBanner: warningBanner.length > 0 ? warningBanner : null,
    banned_words_found: [
      ...new Set([...latestAudit.banned_phrases_found, ...finalDet.bannedPhrasesFound]),
    ],
    missing_sections: latestAudit.opener_violations,
    verdict: latestAudit.verdict,
    tokenUsage: {
      auditInputTokens: totalAuditIn,
      auditOutputTokens: totalAuditOut,
      patchInputTokens: totalPatchIn,
      patchOutputTokens: totalPatchOut,
    },
  }
}
