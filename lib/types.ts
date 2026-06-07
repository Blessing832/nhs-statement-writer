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
  scotland_q2_variation: string
  subscription_start: string
  subscription_end: string
  is_active: boolean
  statement_limit: number | null
  created_at: string
  q_difficult_situation: string
  q_why_trust: string
  q_colleagues_say: string
  q_proudest_moment: string
  q_skills_equipment: string
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

export interface CriterionScore {
  criterion: string
  type: 'essential' | 'desirable'
  easeme: number  // 0–4: 0=absent 1=mentioned 2=evidenced 3=evidenced+outcome 4=exceptional
  pct: number     // 0, 25, 60, 100, or 115+
  note: string
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
  criteriaScores?: CriterionScore[]
  overallPct?: number
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
