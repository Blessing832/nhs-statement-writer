// Shared, dependency-free cleaner so the writer's own remarks never reach an applicant,
// on the server, in the cache, after a refresh, or in the browser.

const COMMENTARY_START = /^(?:(?:first|second|third|fourth|fifth|key|main|critical|significant|major|another|final|one more)\s+(?:issue|concern|problem|point|note)s?\b|issues?\b|concerns?\b|before (?:i|writing|we|proceeding)\b|i (?:need|want) to (?:flag|note|point out|raise|clarify|mention)\b|i must (?:flag|note|point out)\b|i (?:cannot|can't|am unable to|am not able to|won't|will not)\b|notes?\s*[:\-]|important\s*[:\-]|warning\s*[:\-]|a (?:few|couple of) (?:issues|concerns|points|things)\b|heads[- ]up|here(?:'s| is| are) (?:the|your|a)\b|below is\b|statement\s*:)/i

// References to the writer's own instructions. These never appear in a real statement.
const META_TERMS = /\b(?:JOB TITLE RULE|ROLE MATCH|CREDENTIAL RULE|SCENARIO RULE|GROUNDING RULE|MOMENTS fields?|MOMENTS section|JOB section|CANDIDATE section|TRUST section|BUDGET block)\b|\b(?:my instructions|the prompt|these constraints|as instructed)\b|\bI will (?:use|apply|construct|treat|follow|read)\b/

const STATEMENT_OPENING = /^(?:I|My|As|Having|With|Since|Currently|After|Over|In)\b/

const probe = (p: string) => p.trim().replace(/^[#>*_\s-]+/, '')
const wordsIn = (p: string) => p.trim().split(/\s+/).filter(Boolean).length
const isCommentary = (p: string) =>
  COMMENTARY_START.test(probe(p)) || META_TERMS.test(p) || /^[-_=*]{3,}$/.test(p.trim())
const isOpening = (p: string) => !isCommentary(p) && STATEMENT_OPENING.test(probe(p)) && wordsIn(p) >= 20

export function stripLeadingCommentary(text: string): { statement: string; removed: string } {
  const paras = text.split(/\n\s*\n/)
  let k = paras.findIndex(isOpening)

  if (k === -1) {
    // No clear opening paragraph: remove only the leading paragraphs that are clearly remarks.
    k = 0
    while (k < paras.length && isCommentary(paras[k])) k++
    if (k >= paras.length) return { statement: '', removed: text.trim() }
  }

  if (k === 0) return { statement: text, removed: '' }
  const head = paras.slice(0, k)
  // A leading title or label that is not a remark is left alone.
  if (!head.some(isCommentary)) return { statement: text, removed: '' }
  return { statement: paras.slice(k).join('\n\n').trim(), removed: head.join('\n\n').trim() }
}
