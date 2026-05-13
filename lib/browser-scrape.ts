/**
 * Headless-browser scraper powered by Browserless.io cloud Chrome.
 * Connects to a hosted Chromium instance instead of launching one locally,
 * which is reliable in Vercel Lambda where local Chromium always fails.
 */
import puppeteer from 'puppeteer-core'

const NHS_CONSENT_COOKIES = [
  {
    name: 'nhsuk-cookie-consent',
    value: '%7B%22preferences%22%3Atrue%2C%22statistics%22%3Atrue%2C%22marketing%22%3Atrue%2C%22version%22%3A1%7D',
  },
  { name: 'seen_cookie_message', value: 'yes' },
]

export interface BrowserScrapeResult {
  rawText: string
  jobTitle: string
  organisation: string
  downloadedDocs: string[]
}

export async function browserScrapeJob(url: string): Promise<BrowserScrapeResult | null> {
  // Scotland NHS Jobs: ?JobId= is the job identifier — never strip it
  const cleanUrl = url.includes('jobs.scot.nhs.uk') ? url : url.split('?')[0]

  let browser: Awaited<ReturnType<typeof puppeteer.connect>> | null = null
  try {
    const token = process.env.BROWSERLESS_TOKEN
    if (!token) throw new Error('BROWSERLESS_TOKEN not set')

    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${token}`,
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // Pre-set NHS consent cookies so the page loads without a consent wall
    const { hostname } = new URL(cleanUrl)
    await page.setCookie(
      ...NHS_CONSENT_COOKIES.map(c => ({ ...c, domain: hostname, path: '/' }))
    )

    await page.goto(cleanUrl, { waitUntil: 'networkidle0', timeout: 30000 })

    // If a cookie consent dialog still appeared, click accept
    try {
      const labels = ['Accept all cookies', 'Accept all', 'Accept cookies', 'I agree', 'Allow all']
      outer: for (const label of labels) {
        const buttons = await page.$$('button')
        for (const btn of buttons) {
          const text: string = await btn.evaluate((el) => (el as HTMLElement).textContent?.trim() ?? '')
          if (text.toLowerCase().includes(label.toLowerCase())) {
            await btn.click()
            await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {})
            break outer
          }
        }
      }
    } catch { /* non-critical */ }

    // Click every tab so all hidden sections (person spec, job description) become visible
    try {
      const tabs = await page.$$('[role="tab"]')
      for (const tab of tabs) {
        await tab.click().catch(() => {})
        await new Promise(r => setTimeout(r, 250))
      }
      // Specifically click the person spec tab last
      const clickables = await page.$$('button, a')
      for (const el of clickables) {
        const txt: string = await el.evaluate((e) => (e as HTMLElement).textContent?.trim().toLowerCase() ?? '')
        if (txt === 'person specification' || txt === 'person spec') {
          await el.click().catch(() => {})
          await new Promise(r => setTimeout(r, 400))
          break
        }
      }
    } catch { /* non-critical */ }

    // Extract job title and organisation
    const jobTitle = await page.title()
      .then(t => t.replace(/ - .*$/, '').trim())
      .catch(() => '')

    const organisation: string = await page.evaluate(() => {
      const sels = ['[class*="employer"]', '[class*="organisation"]', '[class*="trust"]', 'h2', 'h3']
      for (const sel of sels) {
        const el = document.querySelector(sel) as HTMLElement | null
        if (el?.textContent && el.textContent.trim().length > 3) return el.textContent.trim()
      }
      return ''
    }).catch(() => '')

    // ── Step 1: Find links specifically inside known NHS document sections ──────
    // NHS job pages consistently use headings like "Supporting documents",
    // "Documents to download", "Documents", "Supporting information".
    // Links under those headings are the attachment files — grab them all.
    const sectionLinks: Array<{ href: string; text: string }> = await page.evaluate(() => {
      const SECTION_HEADINGS = [
        'supporting documents',
        'supporting information',
        'documents to download',
        'documents',
        'attachments',
        'downloads',
        'supporting files',
      ]

      const results: Array<{ href: string; text: string }> = []
      const seen = new Set<string>()

      // Find any heading/summary/dt element whose text matches a known section name
      const headingEls = Array.from(document.querySelectorAll(
        'h1,h2,h3,h4,h5,h6,dt,summary,th,[role="heading"]'
      ))
      for (const el of headingEls) {
        const text = (el.textContent?.trim() || '').toLowerCase().replace(/\s+/g, ' ')
        if (!SECTION_HEADINGS.includes(text)) continue

        // Look for links in: the next sibling, the parent, or a details/accordion body
        const containers: (Element | null)[] = [
          el.nextElementSibling,
          el.closest('details'),
          el.closest('li'),
          el.parentElement,
        ]
        for (const container of containers) {
          if (!container) continue
          container.querySelectorAll('a[href]').forEach((a) => {
            const anchor = a as HTMLAnchorElement
            const href = anchor.href
            if (!href.startsWith('http')) return
            const norm = href.split('?')[0].toLowerCase()
            if (seen.has(norm)) return
            seen.add(norm)
            results.push({ href, text: anchor.textContent?.trim().replace(/\s+/g, ' ') || '' })
          })
        }
      }
      return results
    })

    console.log(`[scraper] Found ${sectionLinks.length} links in document sections`)

    // ── Step 2: Apply smart priority — don't download more than needed ──────────
    // Rule 1: If any link is clearly labelled as Person Specification → only that.
    // Rule 2: Else if any link is clearly a Job Description → only that (PS is
    //         always on its last pages).
    // Rule 3: Otherwise → collect all candidates and download them all.

    const PS_LABELS = ['person spec', 'person specification', ' ps ', 'jdps', 'jd and ps', 'jd & ps', 'jd/ps']
    const JD_LABELS = ['job description', 'job desc', 'jd ', 'job detail', 'job pack', 'role profile', 'role description']

    function isPsLabel(text: string) { return PS_LABELS.some(l => text.toLowerCase().includes(l)) }
    function isJdLabel(text: string) { return JD_LABELS.some(l => text.toLowerCase().includes(l)) }

    // All unique candidates from section links + broader page scan
    const allCandidates: Array<{ href: string; text: string; score: number }> = await page.evaluate((sLinks: Array<{href: string; text: string}>) => {
      const seen = new Set<string>(sLinks.map(l => l.href.split('?')[0].toLowerCase()))
      const results: Array<{ href: string; text: string; score: number }> = sLinks.map(l => ({ ...l, score: 5 }))

      const NAV_WORDS = new Set([
        'home', 'about', 'contact', 'login', 'register', 'sign in', 'sign up',
        'privacy', 'terms', 'cookies', 'accessibility', 'help', 'faq', 'search',
        'back', 'next', 'previous', 'apply', 'apply now', 'apply for this job',
        'save', 'share', 'print', 'email', 'twitter', 'facebook', 'linkedin',
      ])

      document.querySelectorAll('a[href]').forEach((a) => {
        const anchor = a as HTMLAnchorElement
        const href = anchor.href
        if (!href.startsWith('http')) return
        const norm = href.split('?')[0].toLowerCase()
        if (seen.has(norm)) return

        const rawText = (anchor.textContent?.trim() || '').replace(/\s+/g, ' ')
        const t = rawText.toLowerCase()
        const h = norm

        if (NAV_WORDS.has(t)) return
        if (h.endsWith('/') || h.includes('/about') || h.includes('/contact') ||
            h.includes('/privacy') || h.includes('/cookies') || h.includes('/accessibility')) return

        let score = 0
        if (t.includes('person spec') || t.includes('person specification')) score = 10
        else if (t.includes('jdps') || t.includes('jd and ps') || t.includes('jd & ps')) score = 9
        else if (t.includes('job description') || t.includes('job desc')) score = 8
        else if (t.includes('job pack') || t.includes('role profile')) score = 7
        else if (t.includes('application pack') || t.includes('candidate pack')) score = 6
        else if (t.includes('supporting') || t.includes('information pack')) score = 5
        else if (h.endsWith('.pdf') || h.endsWith('.docx') || h.endsWith('.doc')) score = 5
        else if (h.includes('/download') || h.includes('/attachment') || h.includes('/files') || h.includes('/document')) score = 4
        else if (t.includes('download') || t.includes('attachment')) score = 3
        else return // skip zero-score links (no document indicator at all)

        seen.add(norm)
        results.push({ href, text: rawText, score })
      })

      results.sort((a, b) => b.score - a.score)
      return results
    }, sectionLinks)

    // Apply the smart priority rules
    const psLabelledLinks = allCandidates.filter(l => isPsLabel(l.text))
    const jdLabelledLinks = allCandidates.filter(l => isJdLabel(l.text))

    let linksToDownload: Array<{ href: string; text: string; score: number }>
    let downloadReason: string

    if (psLabelledLinks.length > 0) {
      linksToDownload = psLabelledLinks
      downloadReason = `PS-labelled file found: ${psLabelledLinks.map(l => l.text).join(', ')}`
    } else if (jdLabelledLinks.length > 0) {
      linksToDownload = jdLabelledLinks
      downloadReason = `JD-labelled file found (PS is inside): ${jdLabelledLinks.map(l => l.text).join(', ')}`
    } else {
      linksToDownload = allCandidates
      downloadReason = `No clear PS/JD label — downloading all ${allCandidates.length} candidates`
    }

    console.log(`[scraper] Strategy: ${downloadReason}`)

    const pageText: string = await page.evaluate(() => document.body.innerText)

    // Capture session cookies to use when downloading files
    const cookies = await page.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    await browser.close()
    browser = null

    linksToDownload.forEach(l => console.log(`  [link] score=${l.score} text="${l.text}" href=${l.href}`))

    // Download and parse selected files.
    // For files without a clear label, check the TEXT INSIDE the file
    // for Person Specification / Essential criteria headings.
    const PER_DOC_LIMIT = 60000
    let personSpecText = ''
    let otherDocText = ''
    const downloadedDocs: string[] = []

    for (const link of linksToDownload.slice(0, 12)) {
      try {
        const raw = await downloadAndParseDoc(link.href, cookieHeader)
        if (!raw || raw.length < 200) continue

        const truncated = smartExtract(raw, PER_DOC_LIMIT)

        const lower = raw.toLowerCase()
        const hasPs = lower.includes('person specification') || lower.includes('essential criteria')
        const hasJd = lower.includes('job description') || lower.includes('main duties') || lower.includes('key responsibilities')

        const label = link.text || link.href.split('/').pop() || 'Document'
        downloadedDocs.push(label)
        console.log(`[scraper] Downloaded "${label}" — ${raw.length} chars, hasPS=${hasPs}, hasJD=${hasJd}`)

        if (hasPs) {
          personSpecText += `\n\n--- ${label} (PERSON SPECIFICATION) ---\n${truncated}`
        } else if (hasJd) {
          otherDocText += `\n\n--- ${label} ---\n${truncated}`
        } else {
          otherDocText += `\n\n--- ${label} ---\n${truncated}`
        }
      } catch (err) {
        console.error(`[scraper] Failed to fetch ${link.href}:`, (err as Error).message)
      }
    }

    // Person spec documents go first so Claude sees them prominently
    const combinedDocText = personSpecText + otherDocText

    const cleanPage = extractRelevantPageText(pageText)
    const rawText = combinedDocText.length > 200
      ? combinedDocText + '\n\n=== PAGE TEXT (SUPPLEMENTAL) ===\n' + cleanPage
      : cleanPage

    return { rawText, jobTitle, organisation, downloadedDocs }
  } catch (err) {
    console.error('Browser scrape error:', (err as Error).message)
    return null
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

async function downloadAndParseDoc(url: string, cookieHeader: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': cookieHeader,
      'Accept': 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,*/*',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) return ''

  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  const urlLower = url.toLowerCase()
  const buffer = Buffer.from(await res.arrayBuffer())

  if (contentType.includes('pdf') || urlLower.includes('.pdf')) return parsePdf(buffer)
  if (contentType.includes('wordprocessingml') || contentType.includes('msword') || urlLower.includes('.docx') || urlLower.includes('.doc')) return parseDocx(buffer)

  // Unknown type (extensionless NHS Jobs download URLs) — try both
  const pdfText = await parsePdf(buffer)
  if (pdfText.length > 100) return pdfText
  return parseDocx(buffer)
}

async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    return (data.text as string) || ''
  } catch { return '' }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  } catch { return '' }
}

// Extract text intelligently: if a Person Specification section exists, anchor
// the window at its start so no criteria are cut. Falls back to start+end split.
function smartExtract(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text

  const lower = text.toLowerCase()
  const psPatterns = [/person\s+specification/, /essential\s+criteria/, /essential\s+requirements/]

  let psStart = -1
  for (const pat of psPatterns) {
    const idx = lower.search(pat)
    if (idx !== -1 && (psStart === -1 || idx < psStart)) psStart = idx
  }

  if (psStart > 0) {
    // Keep a short context from the top (job title / org) + everything from PS onwards
    const context = text.slice(0, Math.min(3000, psStart))
    const psSection = text.slice(psStart, psStart + (maxChars - context.length))
    return context + '\n\n[...job description omitted...]\n\n' + psSection
  }

  // No PS heading found — keep start + end
  const half = Math.floor(maxChars / 2)
  return text.slice(0, half) + '\n\n[...middle omitted...]\n\n' + text.slice(-half)
}

function extractRelevantPageText(text: string): string {
  const cleaned = text.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n')
  return smartExtract(cleaned, 30000)
}
