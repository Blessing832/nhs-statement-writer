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

// Check singular/plural/hyphen variants
function presentInStatement(phrase: string, normStatement: string): boolean {
  const norm = normalize(phrase)
  if (normStatement.includes(norm)) return true

  // Try with/without trailing s on each word
  const words = norm.split(' ').filter(w => w.length >= 4)
  if (words.length === 0) return false

  // All key words present somewhere in statement
  const allPresent = words.every(w => {
    if (normStatement.includes(w)) return true
    if (w.endsWith('s') && normStatement.includes(w.slice(0, -1))) return true
    if (!w.endsWith('s') && normStatement.includes(w + 's')) return true
    return false
  })
  return allPresent
}

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
