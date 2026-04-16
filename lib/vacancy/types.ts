export type VacancySource = 'england' | 'scotland' | 'civil-service' | 'healthjobsuk'
export type EmploymentType = 'full-time' | 'part-time' | 'any'
export type MatchStatus = 'pending' | 'done'

export interface ApplicantPreferences {
  id: string
  client_id: string
  locations: string[]
  bands: string[]
  role_keywords: string[]
  employment_type: EmploymentType
  sources: VacancySource[]
  permanent_only: boolean
  is_active: boolean
  notes: string
  nhs_jobs_url: string | null
  healthjobs_url: string | null
  created_at: string
  updated_at: string
  // joined from clients table
  client?: {
    id: string
    client_code: string
    full_name: string
  }
}

export interface Vacancy {
  id: string
  external_id: string
  source: VacancySource
  title: string
  organisation: string
  location: string
  band: string
  employment_type: string
  url: string
  posted_at: string | null
  closes_at: string | null
  is_open: boolean
  last_checked_at: string
  created_at: string
}

export interface VacancyMatch {
  id: string
  vacancy_id: string
  client_id: string
  status: MatchStatus
  matched_at: string
  done_at: string | null
  vacancy?: Vacancy
}

export interface ScanLogEntry {
  id: string
  scanned_at: string
  new_vacancies_found: number
  new_matches_found: number
  sources_scanned: VacancySource[]
}

// Raw vacancy data returned by each scraper before DB insertion
export interface ScrapedVacancy {
  external_id: string
  source: VacancySource
  title: string
  organisation: string
  location: string
  band: string
  employment_type: string
  url: string
  posted_at: string | null
  closes_at: string | null
}

// Dashboard data returned by the API
export interface DashboardApplicant {
  client_id: string
  client_code: string
  full_name: string
  pending_count: number
  matches: DashboardMatch[]
  nhs_jobs_url: string | null
  healthjobs_url: string | null
}

export interface DashboardMatch {
  match_id: string
  vacancy: Vacancy
}

export interface DashboardData {
  needs_action: DashboardApplicant[]
  all_clear: { client_id: string; client_code: string; full_name: string }[]
  last_scan_at: string | null
  new_this_scan: number
  total_open_vacancies: number
}
