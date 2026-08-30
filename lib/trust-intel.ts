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

  const currentYear = new Date().getFullYear()
  const queries = [
    `"${trustName}" award OR achievement OR CQC OR rated OR outstanding ${currentYear} OR ${currentYear - 1}`,
    `"${trustName}" new OR investment OR service OR expansion OR £ ${currentYear} OR ${currentYear - 1}`,
  ]

  const allItems: { title: string; date: string; snippet: string }[] = []
  const seen = new Set<string>()

  await Promise.allSettled(
    queries.map(async (q) => {
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
          if (seen.has(item.title)) continue
          seen.add(item.title)
          const combined = (item.title + ' ' + item.snippet).toLowerCase()
          if (!combined.includes(trustName.toLowerCase().split(' ')[0])) continue
          allItems.push(item)
        }
      } catch { /* network errors are silent — trust intel is best-effort */ }
    })
  )

  const recent = allItems.filter(i => isRecentEnough(i.date)).slice(0, 5)

  if (recent.length === 0) return null

  console.log(`[trust-intel] Found ${recent.length} items for "${trustName}"`)
  return { trustName, items: recent }
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

  const sections = newsBlock

  return `## TRUST INTELLIGENCE — USE THIS IN THE "WHY THIS TRUST" PARAGRAPH
${sections}`
}
