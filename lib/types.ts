export interface Client {
  id: string
  client_code: string
  full_name: string
  work_history: string
  qualifications: string
  skills: string
  background: string // NHS experience, tools, projects, volunteer work, special info
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
  essentialCriteria: string[]
  desirableCriteria: string[]
  keyDuties: string[]
  candidateStrengths: string[]
  potentialGaps: string[]
}

export interface GenerateResult {
  statement: string
  duties: string[]
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
