/**
 * Fetches recent news about an NHS Trust or Board via Google News RSS.
 * Results are injected into the generation prompt so the "reason for applying"
 * paragraph references real, specific achievements rather than generic praise.
 *
 * No API key required — Google News RSS is publicly available.
 */

export interface TrustIntel {
  trustName: string
  items: { title: string; date: string; snippet: string }[]
  ehrSystem?: string // detected from news/web search — treat as a research hint, not guaranteed fact
}

// Known EHR system names with patterns to detect in text
const EHR_KEYWORDS: { name: string; patterns: string[] }[] = [
  { name: 'RiO', patterns: ['rio epr', ' rio ', '"rio"', 'nhs rio', 'using rio', 'use rio'] },
  { name: 'SystmOne', patterns: ['systmone', 'system one', 's1 clinical'] },
  { name: 'EMIS', patterns: ['emis web', 'emis health', ' emis '] },
  { name: 'Epic', patterns: ['epic systems', 'epic ehr', 'epic electronic', 'go live epic', 'epic go-live'] },
  { name: 'Lorenzo', patterns: ['lorenzo'] },
  { name: 'Cerner', patterns: ['cerner', 'oracle health', 'oracle cerner'] },
  { name: 'Carenotes', patterns: ['carenotes'] },
  { name: 'TrakCare', patterns: ['trakcare', 'trak care', 'traccare'] },
  { name: 'PKB', patterns: ['patients know best', 'patient known best', ' pkb '] },
  { name: 'Clinical Portal', patterns: ['clinical portal'] },
  { name: 'Adastra', patterns: ['adastra'] },
  { name: 'Careflow', patterns: ['careflow'] },
  { name: 'Meditech', patterns: ['meditech'] },
  { name: 'PARIS', patterns: ['paris system', 'paris patient'] },
  { name: 'iClip', patterns: ['iclip'] },
  { name: 'JAC', patterns: ['jac pharmacy', 'jac dispensing'] },
]

function detectEhrSystem(texts: string[]): string | null {
  const counts: Record<string, number> = {}
  for (const text of texts) {
    const lower = ' ' + text.toLowerCase() + ' '
    for (const sys of EHR_KEYWORDS) {
      if (sys.patterns.some(p => lower.includes(p))) {
        counts[sys.name] = (counts[sys.name] || 0) + 1
      }
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? null
}

function cleanOrganisationName(raw: string): string {
  return raw
    .split(/\s*[|\-–]\s*/)[0]  // drop "Trust - Ward 12" style suffixes
    .replace(/\s+(nhs\s+)?foundation\s+trust\b/i, ' NHS Foundation Trust')
    .trim()
}

function parseRssItems(xml: string): { title: string; date: string; snippet: string }[] {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  const results: { title: string; date: string; snippet: string }[] = []

  for (const block of itemBlocks.slice(0, 8)) {
    const titleMatch =
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      block.match(/<title>([\s\S]*?)<\/title>/)
    const descMatch =
      block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
      block.match(/<description>([\s\S]*?)<\/description>/)
    const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)

    const title = (titleMatch?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
    const snippet = (descMatch?.[1] ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
    const rawDate = (dateMatch?.[1] ?? '').trim()

    // Format date as "Mon YYYY"
    let date = ''
    try {
      const d = new Date(rawDate)
      if (!isNaN(d.getTime())) {
        date = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      }
    } catch { /* skip */ }

    if (title.length > 10) results.push({ title, date, snippet })
  }

  return results
}

function isRecentEnough(dateStr: string): boolean {
  if (!dateStr) return true // keep if unknown
  try {
    const d = new Date(dateStr)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    return d >= oneYearAgo
  } catch {
    return true
  }
}

export async function fetchTrustIntel(rawOrganisation: string): Promise<TrustIntel | null> {
  if (!rawOrganisation?.trim()) return null

  const trustName = cleanOrganisationName(rawOrganisation)
  if (trustName.length < 5) return null

  // Three complementary searches:
  // 1. Achievements / awards / CQC ratings
  // 2. Strategic news and investments
  // 3. EHR/digital system news — to detect which patient record system the trust uses
  const currentYear = new Date().getFullYear()
  const queries = [
    `"${trustName}" award OR achievement OR CQC OR rated OR outstanding ${currentYear} OR ${currentYear - 1}`,
    `"${trustName}" new OR investment OR service OR expansion OR £ ${currentYear} OR ${currentYear - 1}`,
    `"${trustName}" (RiO OR SystmOne OR EMIS OR Epic OR Lorenzo OR Cerner OR Carenotes OR TrakCare OR "Clinical Portal" OR Adastra OR Careflow OR Meditech OR PARIS OR iClip) electronic patient record`,
  ]

  const allItems: { title: string; date: string; snippet: string }[] = []
  const seen = new Set<string>()
  const ehrTexts: string[] = []

  await Promise.allSettled(
    queries.map(async (q, idx) => {
      try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-GB&gl=GB&ceid=GB:en`
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': 'application/rss+xml, application/xml, text/xml',
          },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return
        const xml = await res.text()
        const items = parseRssItems(xml)
        for (const item of items) {
          // EHR query (index 2): collect all text for system detection, skip dedup/news list
          if (idx === 2) {
            ehrTexts.push(item.title + ' ' + item.snippet)
            continue
          }
          if (seen.has(item.title)) continue
          seen.add(item.title)
          // Only keep items that mention the trust name
          const combined = (item.title + ' ' + item.snippet).toLowerCase()
          if (!combined.includes(trustName.toLowerCase().split(' ')[0])) continue
          allItems.push(item)
        }
      } catch { /* network errors are silent — trust intel is best-effort */ }
    })
  )

  // Keep the 5 most relevant news items, filtering out anything older than 2 years
  const recent = allItems.filter(i => isRecentEnough(i.date)).slice(0, 5)

  // Detect EHR system from the dedicated EHR search results
  const ehrSystem = detectEhrSystem(ehrTexts) ?? undefined

  if (recent.length === 0 && !ehrSystem) return null

  console.log(`[trust-intel] Found ${recent.length} items, EHR detected: "${ehrSystem ?? 'none'}" for "${trustName}"`)
  return { trustName, items: recent, ehrSystem }
}

export function formatTrustIntel(intel: TrustIntel): string {
  const lines = intel.items.map(i => {
    const dateTag = i.date ? `[${i.date}] ` : ''
    return `- ${dateTag}${i.title}${i.snippet ? ': ' + i.snippet : ''}`
  })

  const newsBlock = intel.items.length > 0
    ? `### RECENT ACHIEVEMENTS AND NEWS
The following are real, recent news items about ${intel.trustName}. You MUST reference at least one of these specific achievements or initiatives in the WHY THIS TRUST paragraph. Do NOT use generic praise — use the actual names, dates, and specifics from these items.

${lines.join('\n')}`
    : ''

  const ehrBlock = intel.ehrSystem
    ? `### EHR SYSTEM — RESEARCH FINDING
News search suggests ${intel.trustName} uses or is implementing: **${intel.ehrSystem}**
IMPORTANT: This is a research hint — it may refer to a specific department or pilot, not the whole trust. Apply the EHR ACCURACY RULE: if "${intel.ehrSystem}" also appears verbatim in the job description, use it with confidence ("I am committed to developing proficiency in ${intel.ehrSystem}"). If it does NOT appear in the JD, write: "I am eager to learn ${intel.trustName}'s electronic patient record system — I understand from my research that ${intel.ehrSystem} is used across the trust's services." NEVER state this as certain fact. NEVER use TrakCare for England or Wales roles regardless of this finding.`
    : ''

  const sections = [newsBlock, ehrBlock].filter(Boolean).join('\n\n')

  return `## TRUST INTELLIGENCE — USE THIS IN THE "WHY THIS TRUST" PARAGRAPH
${sections}`
}
