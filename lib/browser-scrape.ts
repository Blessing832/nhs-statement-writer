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

    // Collect all document links using three strategies
    const docLinks: Array<{ href: string; text: string; score: number }> = await page.evaluate(() => {
      const seen = new Set<string>()
      const results: Array<{ href: string; text: string; score: number }> = []

      function addLink(href: string, text: string) {
        const norm = (href || '').split('?')[0].toLowerCase()
        if (!href || !href.startsWith('http') || seen.has(norm)) return
        seen.add(norm)
        const t = (text || '').toLowerCase().trim()
        const h = href.toLowerCase()
        const score =
          t.includes('person spec') ? 10 :
          (t.includes('jdps') || t.includes('jd and ps') || t.includes('jd & ps')) ? 9 :
          t.includes('job description') ? 8 :
          (t.includes('job pack') || t.includes('role profile')) ? 7 :
          (t.includes('application pack') || t.includes('candidate pack')) ? 6 :
          (t.includes('supporting document') || t.includes('supporting info')) ? 5 :
          (h.endsWith('.pdf') || h.endsWith('.docx') || h.endsWith('.doc')) ? 4 :
          (h.includes('/download/') || h.includes('/attachment/') || h.includes('/file/') || h.includes('/document/')) ? 3 :
          t.includes('download') ? 2 :
          t.includes('attachment') ? 2 : 1
        results.push({ href, text: (text || '').trim(), score })
      }

      // Strategy 1 + 2: doc file URLs and keyword-matched link text
      document.querySelectorAll('a[href]').forEach((a) => {
        const anchor = a as HTMLAnchorElement
        const href = anchor.href
        const text = anchor.textContent?.trim() || ''
        const h = href.toLowerCase()
        const t = text.toLowerCase()
        const isDocFile =
          h.endsWith('.pdf') || h.endsWith('.docx') || h.endsWith('.doc') ||
          h.includes('/document/') || h.includes('/download/') ||
          h.includes('/attachment/') || h.includes('/file/') || h.includes('/files/')
        const isKeyword =
          t.includes('person spec') || t.includes('job description') || t.includes('job desc') ||
          t.includes('jdps') || t.includes('jd and ps') || t.includes('jd & ps') ||
          t.includes('job pack') || t.includes('role profile') ||
          t.includes('supporting document') || t.includes('application pack') ||
          t.includes('candidate pack') || t.includes('recruitment pack') ||
          t.includes('download') || t.includes('attachment')
        if (isDocFile || isKeyword) addLink(href, text)
      })

      // Strategy 3: all links inside attachment/document sections
      const sectionSels = [
        '[class*="attachment"]', '[id*="attachment"]',
        '[class*="supporting"]', '[id*="supporting"]',
        '[class*="document"]', '[id*="document"]',
        '[class*="download"]', '[id*="download"]',
        '[aria-label*="document"]', '[aria-label*="attachment"]',
        '[aria-label*="supporting"]',
      ]
      sectionSels.forEach(sel => {
        document.querySelectorAll(sel).forEach(section => {
          section.querySelectorAll('a[href]').forEach((a) => {
            const anchor = a as HTMLAnchorElement
            if (anchor.href.startsWith('http')) addLink(anchor.href, anchor.textContent?.trim() || '')
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

    console.log(`Browser scrape found ${docLinks.length} document links for ${cleanUrl}`)

    // Download and parse each document (person spec first due to scoring)
    let combinedDocText = ''
    const downloadedDocs: string[] = []
    const PER_DOC_LIMIT = 30000

    for (const link of docLinks.slice(0, 8)) {
      try {
        let text = await downloadAndParseDoc(link.href, cookieHeader)
        if (text && text.length > 200) {
          if (text.length > PER_DOC_LIMIT) {
            text = text.slice(0, PER_DOC_LIMIT / 2) + '\n\n[...middle omitted...]\n\n' + text.slice(-PER_DOC_LIMIT / 2)
          }
          combinedDocText += `\n\n--- ${link.text || 'Document'} ---\n${text}`
          downloadedDocs.push(link.text || link.href)
          console.log(`Parsed: ${link.text} (${text.length} chars)`)
        }
      } catch (err) {
        console.error(`Failed to parse ${link.href}:`, (err as Error).message)
      }
    }

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
