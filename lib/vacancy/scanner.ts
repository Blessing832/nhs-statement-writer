import { supabaseAdmin } from '@/lib/supabase'
import type { ApplicantPreferences, ScrapedVacancy, Vacancy, VacancySource } from './types'
import { matchesRoleKeywords, matchesLocation, matchesBand, matchesEmploymentType, isTemporaryRole } from './synonyms'
import { scrapeNHSEngland, checkEnglandVacancyOpen } from './scrapers/england'
import { scrapeNHSScotland, checkScotlandVacancyOpen } from './scrapers/scotland'
import { scrapeCivilService, checkCivilServiceVacancyOpen } from './scrapers/civil-service'
import { scrapeHealthJobsUK, checkHealthJobsUKVacancyOpen } from './scrapers/healthjobsuk'

// NHS staff groups for care/clinical roles
const CARE_STAFF_GROUPS = [
  'CLINICAL_SERVICES',
  'ALLIED_HEALTH_PROF',
  'NURSING_AND_MIDWIFERY_REGD',
]

const FRESH_HOURS = 168 // Only consider vacancies posted within this window (7 days)

function isFresh(postedAt: string | null): boolean {
  if (!postedAt) return true // If no posted date, include it (can't tell)
  const posted = new Date(postedAt)
  const cutoff = new Date(Date.now() - FRESH_HOURS * 60 * 60 * 1000)
  return posted >= cutoff
}

function isStillOpen(closesAt: string | null): boolean {
  if (!closesAt) return true // If no closing date, assume open
  return new Date(closesAt) > new Date()
}

/**
 * Deduplicate scraped vacancies and filter out stale/closed ones.
 */
function filterAndDedup(vacancies: ScrapedVacancy[]): ScrapedVacancy[] {
  const seen = new Set<string>()
  return vacancies.filter((v) => {
    if (seen.has(v.external_id)) return false
    seen.add(v.external_id)
    // Must be fresh (within 48h) and not already past closing date
    return isFresh(v.posted_at) && isStillOpen(v.closes_at)
  })
}

/**
 * Check if a vacancy matches a set of applicant preferences.
 */
export function vacancyMatchesPreferences(
  vacancy: ScrapedVacancy | Vacancy,
  prefs: ApplicantPreferences
): boolean {
  // Role keywords (with synonym expansion)
  if (prefs.role_keywords.length > 0) {
    if (!matchesRoleKeywords(vacancy.title, vacancy.organisation, prefs.role_keywords)) return false
  }

  // Location
  if (prefs.locations.length > 0) {
    if (!matchesLocation(vacancy.location, prefs.locations)) return false
  }

  // Band
  if (prefs.bands.length > 0 && vacancy.band) {
    if (!matchesBand(vacancy.band, prefs.bands)) return false
  }

  // Employment type
  if (prefs.employment_type && prefs.employment_type !== 'any') {
    if (!matchesEmploymentType(vacancy.employment_type, prefs.employment_type)) return false
  }

  // Permanent-only (for sponsorship-eligible applicants)
  if (prefs.permanent_only) {
    if (isTemporaryRole(vacancy.employment_type || '', vacancy.title || '')) return false
  }

  return true
}

/**
 * Upsert vacancies into DB, return their IDs.
 */
async function upsertVacancies(vacancies: ScrapedVacancy[]): Promise<Map<string, string>> {
  const idMap = new Map<string, string>() // external_id → db uuid
  if (vacancies.length === 0) return idMap

  const { data, error } = await supabaseAdmin
    .from('vacancies')
    .upsert(
      vacancies.map((v) => ({
        external_id: v.external_id,
        source: v.source,
        title: v.title,
        organisation: v.organisation,
        location: v.location,
        band: v.band,
        employment_type: v.employment_type,
        url: v.url,
        posted_at: v.posted_at,
        closes_at: v.closes_at,
        is_open: true,
        last_checked_at: new Date().toISOString(),
      })),
      { onConflict: 'external_id,source', ignoreDuplicates: false }
    )
    .select('id, external_id')

  if (error) {
    console.error('[scanner] Upsert vacancies error:', error.message)
    return idMap
  }

  for (const row of data || []) {
    idMap.set(row.external_id, row.id)
  }
  return idMap
}

/**
 * Main scan: scrape all job boards, match to applicants, save results.
 * Returns how many new matches were found.
 */
export async function runScan(): Promise<{ newVacancies: number; newMatches: number }> {
  console.log('[scanner] Starting scan...')

  // Load all active applicant preferences
  const { data: allPrefs, error: prefsError } = await supabaseAdmin
    .from('applicant_preferences')
    .select('*, client:clients(id, client_code, full_name)')
    .eq('is_active', true)

  if (prefsError || !allPrefs || allPrefs.length === 0) {
    console.log('[scanner] No active preferences found')
    return { newVacancies: 0, newMatches: 0 }
  }

  const prefs = allPrefs as ApplicantPreferences[]

  // Collect unique values needed for HealthJobsUK keyword search and civil service
  const allKeywords = [...new Set(prefs.flatMap((p) => p.role_keywords))]
  const allLocations = [...new Set(prefs.flatMap((p) => p.locations))]
  const allSources = [...new Set(prefs.flatMap((p) => p.sources))] as VacancySource[]

  const scotlandLocations = allLocations.filter(
    (l) => !['england', 'anywhere', 'any'].includes(l.toLowerCase())
  )

  const scrapedAll: ScrapedVacancy[] = []
  const scraperTasks: Promise<ScrapedVacancy[]>[] = []

  if (allSources.includes('england')) {
    // Query 1: Band 3-4, Permanent, care staff groups — all working patterns
    // Catches all HCA / Support Worker / Nursing / AHP roles
    scraperTasks.push(
      scrapeNHSEngland({
        bands: ['3', '4'],
        contractType: 'Permanent',
        staffGroups: CARE_STAFF_GROUPS,
      }).catch((e) => {
        console.error('[scanner] England Q1 (care) failed:', e.message)
        return []
      })
    )

    // Query 2: Band 3-5, Permanent — NO staffGroup, ALL working patterns
    // Catches admin, data, non-clinical, and any roles missed by Q1
    scraperTasks.push(
      scrapeNHSEngland({
        bands: ['3', '4', '5'],
        contractType: 'Permanent',
      }).catch((e) => {
        console.error('[scanner] England Q2 (all permanent) failed:', e.message)
        return []
      })
    )

    // Query 3: Band 2-3, Permanent — any working pattern, lower bands
    scraperTasks.push(
      scrapeNHSEngland({
        bands: ['2', '3'],
        contractType: 'Permanent',
      }).catch((e) => {
        console.error('[scanner] England Q3 (band 2-3) failed:', e.message)
        return []
      })
    )
  }

  if (allSources.includes('scotland')) {
    const scotlandParams = {
      keywords: allKeywords,
      locations: scotlandLocations,
      bands: [],
      employmentType: 'any',
    }
    scraperTasks.push(
      scrapeNHSScotland({ ...scotlandParams, locations: scotlandLocations }).catch((e) => {
        console.error('[scanner] Scotland scraper failed:', e.message)
        return []
      })
    )
  }

  if (allSources.includes('civil-service')) {
    scraperTasks.push(
      scrapeCivilService({
        keywords: allKeywords,
        locations: allLocations,
        bands: [],
        employmentType: 'any',
      }).catch((e) => {
        console.error('[scanner] Civil Service scraper failed:', e.message)
        return []
      })
    )
  }

  if (allSources.includes('healthjobsuk')) {
    // Scotland is handled manually — only scrape England + Wales via HealthJobsUK
    scraperTasks.push(
      scrapeHealthJobsUK({
        keywords: allKeywords,
        locations: allLocations,
        bands: [],
        employmentType: 'any',
        regions: ['england', 'wales'],
      }).catch((e) => {
        console.error('[scanner] HealthJobsUK scraper failed:', e.message)
        return []
      })
    )
  }

  const scraperResults = await Promise.all(scraperTasks)
  for (const result of scraperResults) scrapedAll.push(...result)

  const fresh = filterAndDedup(scrapedAll)
  console.log(`[scanner] Found ${fresh.length} fresh vacancies after filtering`)

  if (fresh.length === 0) {
    await supabaseAdmin.from('scan_log').insert({
      new_vacancies_found: 0,
      new_matches_found: 0,
      sources_scanned: allSources,
    })
    return { newVacancies: 0, newMatches: 0 }
  }

  // Upsert vacancies into DB
  const vacancyIdMap = await upsertVacancies(fresh)
  const newVacancyCount = vacancyIdMap.size

  // Match each vacancy to each applicant
  const matchInserts: { vacancy_id: string; client_id: string; status: string }[] = []

  for (const scraped of fresh) {
    const vacancyId = vacancyIdMap.get(scraped.external_id)
    if (!vacancyId) continue

    for (const pref of prefs) {
      // Only match to sources this applicant wants
      if (!pref.sources.includes(scraped.source)) continue

      if (vacancyMatchesPreferences(scraped, pref)) {
        matchInserts.push({
          vacancy_id: vacancyId,
          client_id: pref.client_id,
          status: 'pending',
        })
      }
    }
  }

  let newMatchCount = 0
  if (matchInserts.length > 0) {
    const { data: inserted, error: matchError } = await supabaseAdmin
      .from('vacancy_matches')
      .upsert(matchInserts, { onConflict: 'vacancy_id,client_id', ignoreDuplicates: true })
      .select('id')

    if (matchError) {
      console.error('[scanner] Match insert error:', matchError.message)
    } else {
      newMatchCount = inserted?.length || 0
    }
  }

  // Log the scan
  await supabaseAdmin.from('scan_log').insert({
    new_vacancies_found: newVacancyCount,
    new_matches_found: newMatchCount,
    sources_scanned: allSources,
  })

  console.log(`[scanner] Scan complete: ${newVacancyCount} vacancies, ${newMatchCount} new matches`)
  return { newVacancies: newVacancyCount, newMatches: newMatchCount }
}

/**
 * Recheck all open vacancies to see if any have closed.
 * Call this when the admin opens the dashboard.
 */
export async function recheckOpenVacancies(): Promise<number> {
  const { data: openVacancies, error } = await supabaseAdmin
    .from('vacancies')
    .select('id, source, url, closes_at, last_checked_at')
    .eq('is_open', true)
    .order('last_checked_at', { ascending: true })
    .limit(50) // Recheck oldest-checked first, up to 50 at a time

  if (error || !openVacancies) return 0

  // Only recheck vacancies not checked in last 20 minutes
  const cutoff = new Date(Date.now() - 20 * 60 * 1000)
  const toCheck = openVacancies.filter(
    (v) => new Date(v.last_checked_at) < cutoff
  )

  let closedCount = 0
  const now = new Date().toISOString()

  // Check in batches of 10 concurrently
  const batchSize = 10
  for (let i = 0; i < toCheck.length; i += batchSize) {
    const batch = toCheck.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (v) => {
        // First: check if closing date has passed
        if (v.closes_at && new Date(v.closes_at) <= new Date()) {
          await supabaseAdmin
            .from('vacancies')
            .update({ is_open: false, last_checked_at: now })
            .eq('id', v.id)
          closedCount++
          return
        }

        // Then: fetch the actual page to verify
        let stillOpen = true
        if (v.source === 'england') stillOpen = await checkEnglandVacancyOpen(v.url)
        else if (v.source === 'scotland') stillOpen = await checkScotlandVacancyOpen(v.url)
        else if (v.source === 'civil-service') stillOpen = await checkCivilServiceVacancyOpen(v.url)
        else if (v.source === 'healthjobsuk') stillOpen = await checkHealthJobsUKVacancyOpen(v.url)

        await supabaseAdmin
          .from('vacancies')
          .update({ is_open: stillOpen, last_checked_at: now })
          .eq('id', v.id)

        if (!stillOpen) closedCount++
      })
    )
  }

  if (closedCount > 0) {
    console.log(`[scanner] Marked ${closedCount} vacancies as closed`)
  }

  return closedCount
}
