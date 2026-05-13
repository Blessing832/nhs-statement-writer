/**
 * Headless-browser scraper that runs inside the Vercel function.
 * Uses @sparticuz/chromium-min to download a serverless-compatible Chromium binary
 * at runtime (cached in /tmp between warm invocations).
 *
 * Designed specifically for NHS job boards where document download links are
 * rendered by JavaScript and cannot be found with a plain HTTP fetch.
 */
import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

// Hosted Chromium binary that matches @sparticuz/chromium-min@148.
// Can be overridden by setting CHROMIUM_REMOTE_EXEC_URL in the Vercel environment.
const CHROMIUM_REMOTE_URL =
  process.env.CHROMIUM_REMOTE_EXEC_URL ||
  'https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.tar'

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
  const cleanUrl = url.split('?')[0]

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null
  try {
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      (await chromium.executablePath(CHROMIUM_REMOTE_URL))

    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ],
      executablePath,
      headless: true,
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

    // Collect ALL links on the page that could possibly be attached files.
    // We deliberately do NOT filter by link text or filename — the file may be
    // named anything (e.g. "Healthcare Assistant.pdf", "Band 3 role.pdf").
    // We download everything that looks like it could be a file and check
    // INSIDE the content for person spec / job description headings.
    const candidateLinks: Array<{ href: string; text: string; score: number }> = await page.evaluate(() => {
      const seen = new Set<string>()
      const results: Array<{ href: string; text: string; score: number }> = []

      // Navigation words that indicate a link goes to another web page, not a file
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
        seen.add(norm)

        const rawText = (anchor.textContent?.trim() || '').replace(/\s+/g, ' ')
        const t = rawText.toLowerCase()
        const h = norm

        // Skip clear navigation links
        if (NAV_WORDS.has(t)) return
        // Skip obvious page links (anchors ending in common path segments)
        if (h.endsWith('/') || h.includes('/about') || h.includes('/contact') ||
            h.includes('/privacy') || h.includes('/cookies') || h.includes('/accessibility')) return

        // Score: higher = more likely to contain person spec
        // Names like "Healthcare Assistant.pdf" score 5 (PDF extension) even with no keywords
        let score = 0
        if (t.includes('person spec')) score = 10
        else if (t.includes('jdps') || t.includes('jd and ps') || t.includes('jd & ps')) score = 9
        else if (t.includes('job description') || t.includes('job desc')) score = 8
        else if (t.includes('job pack') || t.includes('role profile')) score = 7
        else if (t.includes('application pack') || t.includes('candidate pack')) score = 6
        else if (t.includes('supporting') || t.includes('information pack')) score = 5
        else if (h.endsWith('.pdf') || h.endsWith('.docx') || h.endsWith('.doc')) score = 5
        else if (h.includes('/download') || h.includes('/attachment') ||
                 h.includes('/files') || h.includes('/document')) score = 4
        else if (t.includes('download') || t.includes('attachment')) score = 3
        else score = 0 // still included — we try it; score 0 = lowest priority

        // Only include if it has any document indicator; otherwise skip (e.g. plain nav links)
        if (score > 0) results.push({ href, text: rawText, score })
      })

      // Also grab every link inside sections that look like supporting-docs areas,
      // even if their individual links scored 0 above
      const sectionSels = [
        '[class*="attachment"]', '[id*="attachment"]',
        '[class*="supporting"]', '[id*="supporting"]',
        '[class*="document"]',   '[id*="document"]',
        '[class*="download"]',   '[id*="download"]',
        '[aria-label*="document"]', '[aria-label*="attachment"]',
        '[aria-label*="supporting"]',
      ]
      sectionSels.forEach(sel => {
        document.querySelectorAll(sel).forEach(section => {
          section.querySelectorAll('a[href]').forEach((a) => {
            const anchor = a as HTMLAnchorElement
            const href = anchor.href
            if (!href.startsWith('http')) return
            const norm = href.split('?')[0].toLowerCase()
            if (seen.has(norm)) return
            seen.add(norm)
            results.push({ href, text: anchor.textContent?.trim() || '', score: 4 })
          })
        })
      })

      results.sort((a, b) => b.score - a.score)
      return results
    })

    const pageText: string = await page.evaluate(() => document.body.innerText)

    // Capture session cookies to use when downloading files
    const cookies = await page.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    await browser.close()
    browser = null

    console.log(`[scraper] Found ${candidateLinks.length} candidate links on ${cleanUrl}`)
    candidateLinks.forEach(l => console.log(`  [link] score=${l.score} text="${l.text}" href=${l.href}`))

    // Try to download and parse each candidate.
    // We check INSIDE the parsed text for person spec / job description content —
    // the filename is irrelevant. A file named "Healthcare Assistant.pdf" is treated
    // exactly the same as one named "JDPS.pdf".
    const PER_DOC_LIMIT = 30000
    let personSpecText = ''
    let otherDocText = ''
    const downloadedDocs: string[] = []

    for (const link of candidateLinks.slice(0, 12)) {
      try {
        const raw = await downloadAndParseDoc(link.href, cookieHeader)
        if (!raw || raw.length < 200) continue

        const truncated = raw.length > PER_DOC_LIMIT
          ? raw.slice(0, PER_DOC_LIMIT / 2) + '\n\n[...middle omitted...]\n\n' + raw.slice(-PER_DOC_LIMIT / 2)
          : raw

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
    const pdfParse = require('pdf-parse/lib/pdf-parse')
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

function extractRelevantPageText(text: string): string {
  const cleaned = text.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n')
  if (cleaned.length <= 20000) return cleaned
  return cleaned.slice(0, 14000) + '\n\n[...middle omitted...]\n\n' + cleaned.slice(-6000)
}
