// Parses the "specific questions" pasted from an application form. A question is usually a
// section of the person specification: a heading, a list of requirements, then a prompt such
// as "How do you meet these essential criteria?". Every requirement must be answered.

export interface ParsedQuestion {
  number: number
  title: string
  requirements: string[]
  raw: string
}

const BULLET = /^[\s\-–—•*·▪●◦■□✓➢>]+/
const FORM_PROMPT = /^(?:how (?:do|does|would|can) you|please (?:describe|give|explain|provide|tell|use)|use this (?:space|box)|describe how|explain how|give (?:an )?example|provide (?:an )?example|\(?max(?:imum)? \d+)/i

// Splits "1. ...\n\n2. ..." (blank line, then the next sequential number) into questions.
export function splitQuestions(text: string): string[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const out: string[] = []
  let current: string[] = []
  let expected = 1
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(\d+)[.)]\s+(.*)$/)
    const prevBlank = i === 0 || lines[i - 1].trim() === ''
    if (m && Number(m[1]) === expected && (prevBlank || expected === 1)) {
      if (current.length) out.push(current.join('\n').trim())
      current = [m[2]]
      expected++
    } else {
      current.push(lines[i])
    }
  }
  if (current.length) out.push(current.join('\n').trim())
  return out.filter(Boolean)
}

export function extractRequirements(question: string): { title: string; requirements: string[] } {
  const lines = question
    .split('\n')
    .map(l => l.replace(BULLET, '').trim())
    .filter(Boolean)
    // a line that is only the form's own prompt is not a requirement
    .filter(l => !(FORM_PROMPT.test(l) && /[?*]\s*$|\.\s*$/.test(l) && l.split(/\s+/).length <= 14))

  if (lines.length === 0) return { title: '', requirements: [] }
  if (lines.length === 1) return { title: '', requirements: [lines[0]] }

  // A short first line with no sentence punctuation is the section heading.
  const first = lines[0]
  const isHeading = first.split(/\s+/).length <= 5 && !/[.!?]$/.test(first)
  return isHeading
    ? { title: first.replace(/[:\-–—]\s*$/, ''), requirements: lines.slice(1) }
    : { title: '', requirements: lines }
}

export function parseApplicationQuestions(text: string): ParsedQuestion[] {
  return splitQuestions(text).map((raw, i) => {
    const { title, requirements } = extractRequirements(raw)
    return { number: i + 1, title, requirements, raw }
  }).filter(q => q.requirements.length > 0)
}

// Splits generated answers back into one block per question using the "Question N" headings.
export function splitAnswers(text: string, expected: number): string[] | null {
  const re = /^\W*Question\s+(\d+)\b[^\n]*$/gim
  const marks: { n: number; index: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) marks.push({ n: Number(m[1]), index: m.index })
  if (marks.length !== expected) return null
  const blocks: string[] = new Array(expected).fill('')
  marks.forEach((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length
    if (mk.n >= 1 && mk.n <= expected) blocks[mk.n - 1] = text.slice(mk.index, end).trim()
  })
  return blocks.every(Boolean) ? blocks : null
}
