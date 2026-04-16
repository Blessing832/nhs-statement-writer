export type VacancySource = 'england' | 'scotland' | 'civil-service' | 'healthjobsuk'
export type EmploymentType = 'full-time' | 'part-time' | 'any'

export interface SearchLink {
  id: string       // client-side uuid
  label: string    // e.g. "NHS Jobs – London Band 3"
  url: string      // pre-filtered search URL
}

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
  search_links: SearchLink[]
  created_at: string
  updated_at: string
  // joined from clients table
  client?: {
    id: string
    client_code: string
    full_name: string
  }
}
