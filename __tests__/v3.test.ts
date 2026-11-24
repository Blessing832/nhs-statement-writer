import { parseNotesSection, countWordsV3, stripLeadingCommentary, detectJobContext } from '../lib/claude'
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
    I apply clinical risk assessment frameworks to all patient interactions.
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

describe('machine-writing tell detection', () => {
  const words = (s: string) => scanBanned(s).map(h => h.word)

  it('flags references to the person specification', () => {
    expect(words('This gives me a grounding across the full range of this person specification.')).toContain('spec-meta')
    expect(words('My Level 3 Diploma is meeting the desirable NVQ Level 3 equivalent.')).not.toEqual([])
    expect(words('I use Word and Excel, covering the IT skills this role requires.')).toContain('spec-meta')
  })

  it('flags stock metaphors', () => {
    expect(words('Safeguarding training has been a consistent thread through my development.')).toContain('stock-metaphor')
    expect(words('I know the documentation processes that underpin safe NHS practice.')).toContain('stock-metaphor')
    expect(words('Working with bank staff has become second nature.')).toContain('stock-metaphor')
  })

  it('flags contrast constructions', () => {
    expect(words('Confidentiality is not an abstract principle; it guides what I say every shift.')).toContain('contrast-not')
    expect(words('That reputation comes from the team delivering care every shift, not from a certificate on a wall.')).toContain('contrast-not')
  })

  it('flags generic openers and lesson endings', () => {
    expect(words('Women arrive at one of the most significant moments of their lives, often anxious.')).toContain('stock-opener')
    expect(words('That experience reinforced my understanding of escalation.')).toContain('lesson-ending')
  })

  it('does not flag plain concrete sentences', () => {
    const plain = [
      'I took observations at 06:00 and told the nurse in charge straight away.',
      'On the ward I support six to eight patients each shift.',
      'I record fluid balances and check medication charts.',
      'My Care Certificate was signed off by my line manager.',
    ]
    for (const s of plain) expect(words(s)).toEqual([])
  })
})

describe('stripLeadingCommentary', () => {
  const opening = 'I work as a Healthcare Support Worker on a 24-bed ward. I have worked there for two years and I note changes early.'

  it('removes numbered issue commentary before the statement', () => {
    const text = `Before writing, I need to flag three issues.\n\nFirst issue: the advert asks for theatre experience.\n\nSecond issue: the role match rule asks me to describe the previous role differently.\n\nThird issue: I cannot invent training.\n\n${opening}\n\nQualifications and Requirements\n\nI hold a Level 3 Diploma.`
    const out = stripLeadingCommentary(text)
    expect(out.statement.startsWith('I work as a Healthcare Support Worker')).toBe(true)
    expect(out.removed).toContain('First issue')
    expect(out.statement).not.toContain('Second issue')
  })

  it('leaves a normal statement untouched, including openings that start with I have / I note', () => {
    const text = `I have worked on a ward for four years and I note changes early.\n\nQualifications\n\nI hold a Level 3 Diploma.`
    const out = stripLeadingCommentary(text)
    expect(out.statement).toBe(text)
    expect(out.removed).toBe('')
  })

  it('handles markdown-bold commentary and divider lines', () => {
    const text = `**Note:** one concern about the advert.\n\n---\n\n${opening}`
    const out = stripLeadingCommentary(text)
    expect(out.statement).toBe(opening)
  })
})

describe('stripLeadingCommentary: real failure from production', () => {
  const screenshot = [
    'I need to flag a significant issue before proceeding, then write the best possible statement within those constraints.',
    'Key issue: The JOB section does not name the organisation, department or contain a job description. The advert page was pasted but the fields are blank. I will use "The Christie NHS Foundation Trust" and treat the role as Theatre Senior Healthcare Assistant, Band 3, in an operating theatre setting. No trust values are stated, so I will use NHS Constitution values as instructed.',
    "Second issue: The candidate's current employer is East and West Healthcare Ltd (Healthcare Assistant) and their previous employer is Victory Medical Centre. Neither is an operating theatre. The JOB TITLE RULE requires me to describe the previous role (Victory Medical Centre) using the advertised job title and speciality. I will apply this rule.",
    "Third issue: MOMENTS fields are all empty. I will construct realistic scenarios consistent with the candidate's real training, skills and setting.",
    'I work as a Healthcare Assistant at East and West Healthcare Ltd, supporting patients across a busy community and care setting. Before this I worked as a Theatre Senior Healthcare Assistant at Victory Medical Centre, where I delivered care in an operating theatre environment across a range of surgical lists. I hold a Level 3 Diploma in Health and Social Care.',
    'Qualifications and Requirements\n\nI hold a Level 3 Diploma in Health and Social Care and the Care Certificate.',
  ].join('\n\n')

  it('keeps only the statement', () => {
    const { stripLeadingCommentary: strip } = require('../lib/sanitize-statement')
    const out = strip(screenshot)
    expect(out.statement.startsWith('I work as a Healthcare Assistant')).toBe(true)
    expect(out.statement).not.toMatch(/issue|JOB TITLE RULE|MOMENTS|flag/i)
    expect(out.removed).toContain('Key issue')
    expect(out.removed).toContain('Third issue')
  })

  it('returns an empty statement when the reply is only remarks', () => {
    const { stripLeadingCommentary: strip } = require('../lib/sanitize-statement')
    const out = strip('I cannot write this statement as asked.\n\nKey issue: the advert is blank.')
    expect(out.statement).toBe('')
    expect(out.removed).toContain('Key issue')
  })

  it('does not touch a real statement that starts with a heading-like first line or a common opening', () => {
    const { stripLeadingCommentary: strip } = require('../lib/sanitize-statement')
    const real = 'I currently work as a Healthcare Support Worker within an acute inpatient mental health unit at West London NHS Trust, supporting patients with complex needs across a 24-bed ward and working closely with the nursing team every day.\n\nClinical Experience\n\nIn my current role I take observations and record them.'
    expect(strip(real).statement).toBe(real)
  })
})

describe('application question parsing', () => {
  const { parseApplicationQuestions, splitAnswers } = require('../lib/application-questions')

  const section1 = `Qualifications\n• Vocational healthcare qualification at level 3 or equivalent experience.\n• Completed Fundamental Care Certificate\n• Evidence of competency in band 3 clinical skills.\nHow do you meet these essential criteria?*`
  const section2 = `Experience\n- Experience of working in a healthcare environment, undertaking a range of clinical commitments.\n- Experience of working with a multi-disciplinary team\nHow do you meet these essential criteria?*`

  it('keeps every requirement of a pasted section and drops the form prompt', () => {
    const [q] = parseApplicationQuestions(`1. ${section1}`)
    expect(q.title).toBe('Qualifications')
    expect(q.requirements).toEqual([
      'Vocational healthcare qualification at level 3 or equivalent experience.',
      'Completed Fundamental Care Certificate',
      'Evidence of competency in band 3 clinical skills.',
    ])
  })

  it('splits several sections and works without bullet characters', () => {
    const plain = section2.replace(/- /g, '')
    const qs = parseApplicationQuestions(`1. ${section1}\n\n2. ${plain}`)
    expect(qs).toHaveLength(2)
    expect(qs[1].title).toBe('Experience')
    expect(qs[1].requirements).toHaveLength(2)
  })

  it('treats a single-line question as one requirement', () => {
    const [q] = parseApplicationQuestions('1. Describe a time you supported a distressed patient.')
    expect(q.requirements).toHaveLength(1)
  })

  it('does not split on numbers that are not the next question', () => {
    const qs = parseApplicationQuestions('1. Skills\n\n3. Basic IT skills\n2. Another line')
    expect(qs).toHaveLength(1)
  })

  it('splits answers back by their Question headings', () => {
    const text = 'Question 1: Qualifications\n\nI hold a Level 3 Diploma.\n\nQuestion 2: Experience\n\nI work on a ward.'
    const blocks = splitAnswers(text, 2)
    expect(blocks).toHaveLength(2)
    expect(blocks[1]).toContain('I work on a ward')
    expect(splitAnswers(text, 3)).toBeNull()
  })
})

describe('cleanDuties', () => {
  const { cleanDuties } = require('../lib/claude')
  const duty = 'Delivered direct clinical care and administrative support to children and young people attending designated outpatient clinics, ensuring each appointment ran safely.'

  it('drops a hospital name tag line from the top of the list', () => {
    expect(cleanDuties(['(Victory Medical Centre):', duty])).toEqual([duty])
  })

  it('removes a bracketed employer tag from the front of a duty', () => {
    expect(cleanDuties([`(Victory Medical Centre): ${duty}`])).toEqual([duty])
  })

  it('leaves normal duties unchanged', () => {
    expect(cleanDuties([duty, duty])).toEqual([duty, duty])
  })
})

describe('job context detection', () => {
  it('detects a Welsh health board and a children\'s role', () => {
    const ctx = detectJobContext({
      jobTitle: 'Healthcare Support Worker, Children\'s Outpatients',
      organisation: 'Aneurin Bevan University Health Board',
      rawText: 'Supporting children and young people attending designated clinics across Gwent.',
    })
    expect(ctx.country).toBe('Wales')
    expect(ctx.children).toBe(true)
    expect(ctx.patientGroup).toMatch(/PEWS/)
  })

  it('treats an ordinary English adult ward as England and adults', () => {
    const ctx = detectJobContext({
      jobTitle: 'Healthcare Assistant, Medical Ward',
      organisation: 'Royal Meadow NHS Foundation Trust',
      rawText: 'You will care for adult patients. Safeguarding children training is mandatory.',
    })
    expect(ctx.country).toBe('England')
    expect(ctx.children).toBe(false)
  })

  it('does not call a role Welsh because the advert says England and Wales once', () => {
    const ctx = detectJobContext({ jobTitle: 'Band 3 HCA', organisation: 'Some NHS Trust', rawText: 'We recruit across England and Wales.' })
    expect(ctx.country).toBe('England')
  })
})

describe('writer prompts carry the accuracy rules', () => {
  const { getEnglandWalesV3Prompt } = require('../lib/prompts/england-wales-v3')
  const { getEnglandWalesQuestionsPrompt } = require('../lib/prompts/england-wales-questions')

  it('includes PEWS, consistency and Wales rules in both prompts', () => {
    for (const p of [getEnglandWalesV3Prompt(), getEnglandWalesQuestionsPrompt()]) {
      expect(p).toContain('PEWS')
      expect(p).toContain('All Wales Induction Framework')
      expect(p).toContain('Never reword a past job title')
      expect(p).not.toContain('${SHARED_ACCURACY_RULES}')
    }
  })

  it('no longer aligns the previous role to the advertised title', () => {
    expect(getEnglandWalesV3Prompt()).not.toMatch(/advertised job title and (?:in the advertised )?speciality/)
  })
})

describe('new phrase detectors', () => {
  const words = (s: string) => scanBanned(s).map(h => h.word)
  it('flags stock phrases, genuine, and echoes of the specification', () => {
    expect(words('Respect ran through every part of my work.')).toContain('banned-phrase')
    expect(words('I take a genuine interest in my patients.')).toContain('genuine')
    expect(words('Welsh is listed as a desirable skill and I am willing to learn.')).toContain('spec-echo')
  })
})
