/**
 * Role synonym groups. Each array is a cluster of equivalent/related job titles.
 * When an applicant lists any term from a cluster as a keyword, it will match
 * jobs with titles containing ANY term from the same cluster.
 */
export const ROLE_SYNONYM_GROUPS: string[][] = [
  // Support / Care Workers
  [
    'support worker', 'care assistant', 'care worker', 'healthcare assistant', 'hca',
    'recovery worker', 'residential support worker', 'community support worker',
    'mental health support worker', 'learning disability support worker',
    'rehabilitation assistant', 'enablement worker', 'reablement worker',
    'wellbeing worker', 'waking night support worker',
  ],

  // Nursing
  [
    'staff nurse', 'registered nurse', 'rgn', 'rmn', 'rnld', 'rn', 'rn1', 'rn2',
    'adult nurse', 'mental health nurse', 'learning disability nurse',
    'community nurse', 'district nurse', 'practice nurse',
  ],

  // Senior / Team Lead Nursing
  [
    'ward manager', 'charge nurse', 'senior staff nurse', 'band 7 nurse',
    'clinical team leader', 'shift leader',
  ],

  // Midwifery
  ['midwife', 'midwifery', 'specialist midwife', 'community midwife'],

  // Allied Health Professionals
  [
    'occupational therapist', 'ot', 'physiotherapist', 'physio', 'physiotherapy',
    'speech and language therapist', 'salt', 'dietitian', 'dietician',
    'radiographer', 'paramedic', 'podiatrist', 'chiropodist',
  ],

  // Social Work
  [
    'social worker', 'social care worker', 'approved mental health professional', 'amhp',
    'adult social worker', 'children social worker', 'looked after children',
  ],

  // Project Management
  [
    'project manager', 'project management', 'project coordinator', 'project lead',
    'project officer', 'project support', 'programme manager', 'programme coordinator',
    'programme lead', 'delivery manager', 'change manager', 'transformation manager',
    'implementation manager',
  ],

  // Administration / Clerical
  [
    'administrator', 'admin', 'medical secretary', 'receptionist', 'clerical officer',
    'administrative officer', 'admin assistant', 'ward clerk',
    'data entry', 'administrative assistant',
  ],

  // Management / Leadership
  [
    'service manager', 'operations manager', 'general manager', 'registered manager',
    'deputy manager', 'assistant manager', 'team manager', 'care manager',
    'clinical manager', 'locality manager',
  ],

  // Mental Health
  [
    'mental health', 'psychiatry', 'psychiatric', 'psychology', 'psychologist',
    'counsellor', 'counselor', 'therapist', 'psychotherapist',
    'crisis worker', 'crisis team', 'crisis support',
  ],

  // Healthcare Assistants / Clinical Support
  [
    'clinical support worker', 'therapy assistant', 'ot assistant',
    'physiotherapy assistant', 'nursing auxiliary', 'nursing assistant',
  ],

  // GP / Primary Care
  ['gp', 'general practitioner', 'primary care', 'practice manager', 'gp practice'],

  // Community
  ['community', 'community care', 'outreach', 'home care', 'domiciliary care'],

  // CAMHS / Children
  [
    'camhs', "children's mental health", 'child and adolescent', 'children and young people',
    'cyp', 'looked after children', 'lac',
  ],

  // Specialist Nursing
  [
    'specialist nurse', 'clinical nurse specialist', 'cns', 'nurse specialist',
    'advanced nurse practitioner', 'anp', 'nurse practitioner', 'np',
    'nurse consultant', 'clinical nurse educator',
  ],

  // Pharmacy
  ['pharmacist', 'pharmacy', 'pharmacy technician', 'dispensary'],

  // Health Visitor
  ['health visitor', 'health visiting', 'public health nurse'],

  // Domestic / Housekeeping
  ['domestic', 'housekeeper', 'housekeeping', 'cleaning', 'cleaner', 'catering'],

  // Porter / Estates
  ['porter', 'portering', 'estates', 'facilities', 'maintenance'],
]

/**
 * Build a fast lookup map: keyword → set of all synonyms in the same group.
 */
function buildSynonymMap(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const group of ROLE_SYNONYM_GROUPS) {
    const groupSet = new Set(group.map((t) => t.toLowerCase()))
    for (const term of group) {
      map.set(term.toLowerCase(), groupSet)
    }
  }
  return map
}

const SYNONYM_MAP = buildSynonymMap()

/**
 * Given a user keyword, return all synonyms (including the keyword itself).
 */
export function getSynonyms(keyword: string): string[] {
  const key = keyword.toLowerCase().trim()
  const group = SYNONYM_MAP.get(key)
  if (group) return Array.from(group)

  // Partial match: if no exact group found, check if the keyword is a substring of any group term
  for (const [term, group] of SYNONYM_MAP.entries()) {
    if (term.includes(key) || key.includes(term)) {
      return Array.from(group)
    }
  }

  return [key]
}

/**
 * Check if a job title/description matches any of the applicant's role keywords,
 * using synonym expansion for fuzzy matching.
 */
export function matchesRoleKeywords(
  jobTitle: string,
  jobOrg: string,
  keywords: string[]
): boolean {
  const searchText = `${jobTitle} ${jobOrg}`.toLowerCase()

  for (const keyword of keywords) {
    const synonyms = getSynonyms(keyword)
    for (const syn of synonyms) {
      if (searchText.includes(syn)) return true
    }
  }
  return false
}

/**
 * Check if a job location matches any of the applicant's preferred locations.
 * Handles broad terms like "Scotland", "England", "Remote", "Anywhere".
 */
export function matchesLocation(jobLocation: string, preferredLocations: string[]): boolean {
  if (!preferredLocations.length) return true

  const loc = jobLocation.toLowerCase()

  for (const pref of preferredLocations) {
    const p = pref.toLowerCase().trim()

    if (p === 'anywhere' || p === 'any' || p === 'remote') return true
    if (loc.includes(p)) return true

    // Broad region matching
    if (p === 'scotland' && (
      loc.includes('scotland') || loc.includes('edinburgh') || loc.includes('glasgow') ||
      loc.includes('aberdeen') || loc.includes('dundee') || loc.includes('inverness') ||
      loc.includes('perth') || loc.includes('stirling') || loc.includes('fife') ||
      loc.includes('lothian') || loc.includes('lanarkshire') || loc.includes('ayrshire')
    )) return true

    if (p === 'england' && (
      loc.includes('england') || loc.includes('london') || loc.includes('manchester') ||
      loc.includes('birmingham') || loc.includes('leeds') || loc.includes('liverpool') ||
      loc.includes('bristol') || loc.includes('sheffield') || loc.includes('oxford') ||
      loc.includes('cambridge') || loc.includes('newcastle') || loc.includes('nottingham')
    )) return true

    if (p === 'wales' && (
      loc.includes('wales') || loc.includes('cardiff') || loc.includes('swansea') ||
      loc.includes('newport')
    )) return true
  }
  return false
}

/**
 * Check if the band in a job listing matches any of the applicant's preferred bands.
 * Handles formats like "Band 5", "AFC Band 5", "NHS Band 5", "Grade 6" etc.
 */
export function matchesBand(jobBand: string, preferredBands: string[]): boolean {
  if (!preferredBands.length) return true
  if (!jobBand) return true // If band not specified in listing, don't exclude it

  const jb = jobBand.toLowerCase().replace(/\s+/g, ' ').trim()

  for (const band of preferredBands) {
    const b = band.toLowerCase().replace(/\s+/g, ' ').trim()
    // Match "band 5" → "band 5", "5", "afc band 5"
    if (jb.includes(b)) return true
    // Match "5" → "band 5"
    if (jb.includes(`band ${b}`)) return true
  }
  return false
}

/**
 * Returns true when a vacancy appears to be a temporary / non-permanent post.
 * Used to filter out fixed-term, bank, secondment, and locum roles for applicants
 * who need permanent (i.e. visa-sponsorable) positions.
 */
export function isTemporaryRole(jobType: string, jobTitle: string): boolean {
  const combined = `${jobType} ${jobTitle}`.toLowerCase()
  const tempSignals = [
    'fixed term', 'fixed-term', 'fixed_term',
    'secondment',
    'bank',
    'locum',
    'temporary',
    'temp ',
    'interim',
    'maternity cover',
    'cover',
    'casual',
    'zero hours', 'zero-hours',
  ]
  return tempSignals.some((s) => combined.includes(s))
}

/**
 * Check if the employment type matches the applicant's preference.
 */
export function matchesEmploymentType(jobType: string, preference: string): boolean {
  if (preference === 'any' || !preference) return true
  if (!jobType) return true // If not specified in listing, don't exclude

  const jt = jobType.toLowerCase()
  const pref = preference.toLowerCase()

  if (pref === 'full-time') return jt.includes('full') || jt.includes('full-time') || jt.includes('fulltime')
  if (pref === 'part-time') return jt.includes('part') || jt.includes('part-time') || jt.includes('parttime')
  return true
}
