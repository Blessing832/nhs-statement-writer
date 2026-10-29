import { CriterionCheck } from './types'

const FILLER_RE = /^(ability\s+to|evidence\s+of|experience\s+(of|in|with)|knowledge\s+of|understanding\s+of|awareness\s+of|commitment\s+to|demonstrable\s+|proven\s+|strong\s+|excellent\s+|good\s+|effective\s+|demonstrate[sd]?\s+|a\s+(?=\w)|an\s+(?=\w)|the\s+(?=\w))/i

function stripFiller(criterion: string): string {
  let s = criterion.trim()
  let changed = true
  while (changed) {
    changed = false
    const next = s.replace(FILLER_RE, '')
    if (next !== s) { s = next.trim(); changed = true }
  }
  return s
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[–—-]/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function findSentenceContaining(phrase: string, statement: string): string | undefined {
  const normPhrase = normalize(phrase)
  const sentences = statement.match(/[^.!?]+[.!?]*/g) ?? []
  for (const s of sentences) {
    if (normalize(s).includes(normPhrase)) return s.trim()
  }
  // Try key-words fallback
  const words = normPhrase.split(' ').filter(w => w.length >= 4)
  if (words.length > 0) {
    for (const s of sentences) {
      const ns = normalize(s)
      const allPresent = words.every(w =>
        ns.includes(w) ||
        (w.endsWith('s') && ns.includes(w.slice(0, -1))) ||
        (!w.endsWith('s') && ns.includes(w + 's'))
      )
      if (allPresent) return s.trim()
    }
  }
  return undefined
}

function presentInStatement(phrase: string, normStatement: string): boolean {
  const norm = normalize(phrase)
  if (normStatement.includes(norm)) return true
  const words = norm.split(' ').filter(w => w.length >= 4)
  if (words.length === 0) return false
  return words.every(w => {
    if (normStatement.includes(w)) return true
    if (w.endsWith('s') && normStatement.includes(w.slice(0, -1))) return true
    if (!w.endsWith('s') && normStatement.includes(w + 's')) return true
    return false
  })
}

// ── V3: returns CriterionCheck[] with numbered IDs ────────────────────────────

export function verifyCriteriaV3(
  statement: string,
  essentialCriteria: string[],
  desirableCriteria: string[]
): CriterionCheck[] {
  const normStatement = normalize(statement)
  const results: CriterionCheck[] = []

  for (let i = 0; i < essentialCriteria.length; i++) {
    const wording = essentialCriteria[i]
    const keyPhrase = stripFiller(wording)
    const found = presentInStatement(keyPhrase, normStatement) || presentInStatement(wording, normStatement)
    const sentence = found ? findSentenceContaining(keyPhrase, statement) : undefined
    results.push({ id: `E${i + 1}`, wording, found, sentence })
  }

  for (let i = 0; i < desirableCriteria.length; i++) {
    const wording = desirableCriteria[i]
    const keyPhrase = stripFiller(wording)
    const found = presentInStatement(keyPhrase, normStatement) || presentInStatement(wording, normStatement)
    const sentence = found ? findSentenceContaining(keyPhrase, statement) : undefined
    results.push({ id: `D${i + 1}`, wording, found, sentence })
  }

  return results
}

// ── V2 legacy interface (unchanged) ───────────────────────────────────────────

export interface CriterionVerification {
  criterion: string
  keyPhrase: string
  present: boolean
}

export interface VerifyResult {
  present: CriterionVerification[]
  missing: CriterionVerification[]
}

export function verifyCriteria(statement: string, criteria: string[]): VerifyResult {
  const normStatement = normalize(statement)
  const present: CriterionVerification[] = []
  const missing: CriterionVerification[] = []

  for (const criterion of criteria) {
    const keyPhrase = stripFiller(criterion)
    const isPresent = presentInStatement(keyPhrase, normStatement) ||
                      presentInStatement(criterion, normStatement)

    const result: CriterionVerification = { criterion, keyPhrase, present: isPresent }
    ;(isPresent ? present : missing).push(result)
  }

  return { present, missing }
}
