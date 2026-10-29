import { parseNotesSection, countWordsV3 } from '../lib/claude'
import { scanBanned } from '../lib/bannedWords'
import { verifyCriteriaV3 } from '../lib/verify-criteria'

// ── NOTES parsing ─────────────────────────────────────────────────────────────

describe('parseNotesSection', () => {
  const sampleNotes = `TITLE CHECK: MATCH — statement uses "Staff Nurse" which matches the advertised title

GAPS:
• E3: Manual handling — candidate did not provide a specific scenario
• E7: Driving licence — candidate does not hold one

COVERAGE:
• E1: Communication skills — evidenced in paragraph 2 with SBAR scenario
• E2: Clinical assessment — evidenced in body with NEWS2 example

QUESTIONS:
• Confirm years of experience at Band 5 level before submission`

  it('parses TITLE CHECK', () => {
    const parsed = parseNotesSection(sampleNotes)
    expect(parsed.titleCheck).toContain('MATCH')
  })

  it('parses GAPS as array', () => {
    const parsed = parseNotesSection(sampleNotes)
    expect(parsed.gaps.length).toBe(2)
    expect(parsed.gaps[0]).toContain('Manual handling')
  })

  it('parses COVERAGE as array', () => {
    const parsed = parseNotesSection(sampleNotes)
    expect(parsed.coverage.length).toBe(2)
    expect(parsed.coverage[0]).toContain('Communication')
  })

  it('parses QUESTIONS as array', () => {
    const parsed = parseNotesSection(sampleNotes)
    expect(parsed.questions.length).toBe(1)
    expect(parsed.questions[0]).toContain('years of experience')
  })

  it('detects MISMATCH in titleCheck', () => {
    const mismatch = parseNotesSection('TITLE CHECK: MISMATCH — used "RN" not "Staff Nurse"\nGAPS:\nNone identified.\nCOVERAGE:\nNone\nQUESTIONS:\nNone.')
    expect(mismatch.titleCheck?.toLowerCase()).toContain('mismatch')
  })

  it('returns empty arrays for missing sections', () => {
    const parsed = parseNotesSection('TITLE CHECK: MATCH')
    expect(parsed.gaps).toEqual([])
    expect(parsed.coverage).toEqual([])
    expect(parsed.questions).toEqual([])
  })
})

// ── Word count ────────────────────────────────────────────────────────────────

describe('countWordsV3', () => {
  it('counts words correctly', () => {
    expect(countWordsV3('Hello world')).toBe(2)
    expect(countWordsV3('  multiple   spaces   ')).toBe(2)
  })

  it('returns 0 for empty string', () => {
    expect(countWordsV3('')).toBe(0)
    expect(countWordsV3('   ')).toBe(0)
  })

  it('handles undefined gracefully', () => {
    expect(countWordsV3(undefined as unknown as string)).toBe(0)
  })
})

// ── Flag-mode filter: criterion phrases untouched ─────────────────────────────

describe('scanBanned - criterion phrase protection logic', () => {
  it('detects "robust" in a plain sentence', () => {
    const hits = scanBanned('I have robust clinical skills.')
    expect(hits.some(h => h.word === 'robust')).toBe(true)
  })

  it('detects "passionate" in a sentence', () => {
    const hits = scanBanned('I am passionate about patient care.')
    expect(hits.some(h => h.word === 'passionate')).toBe(true)
  })

  it('does NOT flag opener-exempt sentences', () => {
    const hits = scanBanned('My career has shaped every aspect of my professional development.')
    expect(hits.length).toBe(0)
  })

  it('detects new regex flag: ps-reference', () => {
    const hits = scanBanned('As per my person specification I have the required skills.')
    expect(hits.some(h => h.word === 'ps-reference')).toBe(true)
  })

  it('detects new regex flag: show-on-my', () => {
    const hits = scanBanned('I will show on my application that I meet all criteria.')
    expect(hits.some(h => h.word === 'show-on-my')).toBe(true)
  })

  it('detects new regex flag: make-sure-noun', () => {
    const hits = scanBanned('I always make sure patients receive timely care.')
    expect(hits.some(h => h.word === 'make-sure-noun')).toBe(true)
  })

  it('does NOT flag make-sure when followed by I', () => {
    const hits = scanBanned('I make sure I document everything correctly.')
    expect(hits.some(h => h.word === 'make-sure-noun')).toBe(false)
  })
})

// ── verifyCriteriaV3 ──────────────────────────────────────────────────────────

describe('verifyCriteriaV3', () => {
  const essential = [
    'Ability to communicate effectively with patients and colleagues',
    'Knowledge of clinical risk assessment frameworks',
  ]
  const desirable = [
    'Experience of working in an acute ward setting',
  ]

  const statement = `
    I communicate effectively with patients and colleagues daily.
    I apply clinical risk assessment to all patient interactions.
    Thank you.
  `

  it('returns correct IDs: E1, E2, D1', () => {
    const results = verifyCriteriaV3(statement, essential, desirable)
    expect(results.map(r => r.id)).toEqual(['E1', 'E2', 'D1'])
  })

  it('finds E1 and E2 as present', () => {
    const results = verifyCriteriaV3(statement, essential, desirable)
    expect(results.find(r => r.id === 'E1')?.found).toBe(true)
    expect(results.find(r => r.id === 'E2')?.found).toBe(true)
  })

  it('marks D1 as not found when absent', () => {
    const results = verifyCriteriaV3(statement, essential, desirable)
    expect(results.find(r => r.id === 'D1')?.found).toBe(false)
  })

  it('returns sentence location for found criteria', () => {
    const results = verifyCriteriaV3(statement, essential, desirable)
    const e1 = results.find(r => r.id === 'E1')
    expect(e1?.sentence).toBeDefined()
    expect(e1?.sentence?.toLowerCase()).toContain('communicate')
  })

  it('returns correct wording for each criterion', () => {
    const results = verifyCriteriaV3(statement, essential, desirable)
    expect(results[0].wording).toBe(essential[0])
    expect(results[2].wording).toBe(desirable[0])
  })
})

// ── Exact wording check ───────────────────────────────────────────────────────

describe('exact wording preservation in verifyCriteriaV3', () => {
  it('finds exact verbatim criterion phrase', () => {
    const essential = ['effective verbal communication skills']
    const statement = 'I demonstrate effective verbal communication skills in all clinical settings.'
    const results = verifyCriteriaV3(statement, essential, [])
    expect(results[0].found).toBe(true)
  })

  it('does not find criterion when completely absent', () => {
    const essential = ['paediatric oncology nursing']
    const statement = 'I have worked in adult medical wards.'
    const results = verifyCriteriaV3(statement, essential, [])
    expect(results[0].found).toBe(false)
  })
})

// ── Story gate logic ──────────────────────────────────────────────────────────

describe('story gate word count threshold', () => {
  it('countWordsV3 correctly identifies <40 word fields', () => {
    const shortText = 'I handled a difficult patient.'
    expect(countWordsV3(shortText)).toBeLessThan(40)
  })

  it('countWordsV3 correctly identifies >=40 word fields', () => {
    const longText = 'During a night shift on the acute medical ward I was responsible for a patient who had deteriorated rapidly. I escalated using SBAR to the registrar and initiated an emergency response. The patient was stabilised within 20 minutes due to early intervention.'
    expect(countWordsV3(longText)).toBeGreaterThanOrEqual(40)
  })
})
