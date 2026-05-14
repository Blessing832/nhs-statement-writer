export interface Client {
  id: string
  client_code: string
  full_name: string
  work_history: string
  qualifications: string
  skills: string
  background: string
  special_instructions: string
  opening_style: string
  subscription_start: string
  subscription_end: string
  is_active: boolean
  created_at: string
}

export interface Statement {
  id: string
  client_id: string
  vacancy_url: string
  job_title: string
  organisation: string
  generated_statement: string
  key_duties: string[]
  is_rewrite: boolean
  rewrite_instruction?: string
  created_at: string
}

export interface GenerateRequest {
  client_code: string
  vacancy_url: string
  instructions?: string
  style?: '1' | '2'
  specificQuestions?: string
  rewriteInstruction?: string
  previousStatement?: string
}

export interface StatementAnalysis {
  jobSummary: string
  enhancedPreviousTitle?: string
  trustOrOrganisation?: string
  advertKeyPhrases?: string[]
  jdKeywords?: string[]
  essentialCriteria: string[]
  desirableCriteria: string[]
  keyDuties: string[]
  subheadingPlan?: string[]
  candidateStrengths: string[]
  potentialGaps: string[]
  meetsAllEssential?: boolean
}

export interface GenerateResult {
  statement: string
  previousRoleDuties: string[]
  currentRoleDuties: string[]
  analysis: StatementAnalysis | null
  jobTitle: string
  organisation: string
  source?: string
  promptRegion: 'england-wales' | 'scotland' | 'civil-service' | 'generic'
}

export interface ScrapeResult {
  jobTitle: string
  organisation: string
  jobDescription: string
  personSpec: string
  rawText: string
  source?: string
  error?: string
}
