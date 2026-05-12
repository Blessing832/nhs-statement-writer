const express = require('express')
const { chromium } = require('playwright')
const pdfParse = require('pdf-parse')
const mammoth = require('mammoth')
const axios = require('axios')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3001
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || 'changeme'

// Health check must be before auth middleware so Railway can reach it
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Auth middleware for all other routes
app.use((req, res, next) => {
  const secret = req.headers['x-scraper-secret']
  if (secret !== SCRAPER_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' })
  }
  next()
})

app.post('/scrape', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  let browser = null
  try {
    console.log(`Scraping: ${url.split('?')[0]}`)

    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    })

    // Strip query params — NHS Jobs search results append filter params to the URL
    const cleanUrl = url.split('?')[0]
    const urlObj = new URL(cleanUrl)

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    })

    // Pre-set NHS cookie consent so the browser doesn't land on a cookie wall
    await context.addCookies([
      {
        name: 'nhsuk-cookie-consent',
        value: '%7B%22preferences%22%3Atrue%2C%22statistics%22%3Atrue%2C%22marketing%22%3Atrue%2C%22version%22%3A1%7D',
        domain: urlObj.hostname,
        path: '/',
      },
      {
        name: 'seen_cookie_message',
        value: 'yes',
        domain: urlObj.hostname,
        path: '/',
      },
    ])

    const page = await context.newPage()

    // Navigate to the job page (clean URL — no search filter query params)
    await page.goto(cleanUrl, { waitUntil: 'networkidle', timeout: 30000 })

    // If cookie consent dialog still appeared (some sites ignore pre-set cookies),
    // click the accept button before doing anything else
    try {
      const acceptLabels = ['Accept all cookies', 'Accept all', 'Accept cookies', 'I agree', 'Allow all']
      for (const label of acceptLabels) {
        const btn = page.getByRole('button', { name: label, exact: false })
        const count = await btn.count()
        if (count > 0) {
          await btn.first().click()
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
          console.log(`Accepted cookie consent: "${label}"`)
          break
        }
      }
    } catch (err) {
      console.log('Cookie consent handling:', err.message)
    }

    // NHS job boards render person spec, job description, etc. in tabs.
    // Click every tab button so all sections are visible before extracting text.
    const isNhsSite =
      cleanUrl.includes('jobs.nhs.uk') ||
      cleanUrl.includes('healthjobsuk.com') ||
      cleanUrl.includes('jobs.scot.nhs.uk')
    if (isNhsSite) {
      try {
        const tabs = await page.$$('[role="tab"]')
        for (const tab of tabs) {
          await tab.click().catch(() => {})
          await page.waitForTimeout(250)
        }
        // Ensure person spec tab is the last one clicked so its content is fully visible
        const allClickable = await page.$$('button, a')
        for (const el of allClickable) {
          const txt = (await el.textContent().catch(() => '')).toLowerCase().trim()
          if (txt === 'person specification' || txt === 'person spec') {
            await el.click().catch(() => {})
            await page.waitForTimeout(400)
            break
          }
        }
      } catch (err) {
        console.log(`Tab expand (${cleanUrl}):`, err.message)
      }
    }

    // Extract page title / job title
    const jobTitle = await page
      .title()
      .then((t) => t.replace(/ - .*$/, '').trim())
      .catch(() => 'Unknown Role')

    // Extract organisation name
    const organisation = await page
      .evaluate(() => {
        const selectors = [
          '[class*="employer"]',
          '[class*="organisation"]',
          '[class*="trust"]',
          '[data-testid*="employer"]',
          'h2',
          'h3',
        ]
        for (const sel of selectors) {
          const el = document.querySelector(sel)
          if (el && el.textContent && el.textContent.trim().length > 3) {
            return el.textContent.trim()
          }
        }
        return ''
      })
      .catch(() => '')

    // Find all document links (PDF, DOCX, DOC)
    const docLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'))
      return links
        .filter((a) => {
          const href = a.href.toLowerCase()
          const text = a.textContent.toLowerCase().trim()
          const isDocFile =
            href.endsWith('.pdf') ||
            href.endsWith('.docx') ||
            href.endsWith('.doc') ||
            href.includes('/document/') ||
            href.includes('/download/') ||
            href.includes('/attachment/') ||
            href.includes('/file/') ||
            href.includes('/files/')
          const isDocLink =
            text.includes('job description') ||
            text.includes('person spec') ||
            text.includes('person specification') ||
            text.includes('jdps') ||
            text.includes('jd and ps') ||
            text.includes('jd & ps') ||
            text.includes('jd/ps') ||
            text.includes('job pack') ||
            text.includes('job detail') ||
            text.includes('supporting document') ||
            text.includes('supporting info') ||
            text.includes('role profile') ||
            text.includes('application pack') ||
            text.includes('information pack') ||
            text.includes('candidate pack') ||
            text.includes('additional information') ||
            text.includes('further information') ||
            text.includes('recruitment pack') ||
            text.includes('download') ||
            text.includes('attachment') ||
            isDocFile
          return isDocLink && href.startsWith('http')
        })
        .map((a) => ({
          href: a.href,
          text: a.textContent.trim(),
          // Score: higher = more likely to be PS
          score: (
            a.textContent.toLowerCase().includes('person spec') ? 10 :
            a.textContent.toLowerCase().includes('job description') ? 8 :
            a.textContent.toLowerCase().includes('job pack') ? 7 :
            a.textContent.toLowerCase().includes('role profile') ? 6 :
            a.textContent.toLowerCase().includes('application pack') ? 5 : 1
          ),
        }))
    })

    // Sort: person spec first, then job description, then others
    docLinks.sort((a, b) => b.score - a.score)

    console.log(`Found ${docLinks.length} document links:`, docLinks)

    // Also grab the visible page text as fallback
    const pageText = await page.evaluate(() => document.body.innerText)

    // Get cookies from the browser session so we can use them for downloads
    const cookies = await context.cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    await browser.close()
    browser = null

    // Download and parse each document — limit per-doc to 30k chars, total to 5 docs
    // PS-scored docs are sorted first so they get priority in combined text
    let combinedDocText = ''
    const downloadedDocs = []
    const PER_DOC_LIMIT = 30000

    for (const link of docLinks.slice(0, 5)) {
      try {
        let docText = await downloadAndParseDoc(link.href, cookieHeader)
        if (docText && docText.length > 100) {
          // Truncate very large docs but keep both start and end (PS often at end)
          if (docText.length > PER_DOC_LIMIT) {
            const half = PER_DOC_LIMIT / 2
            docText = docText.slice(0, half) + '\n\n[...middle omitted...]\n\n' + docText.slice(-half)
          }
          combinedDocText += `\n\n--- ${link.text || 'Document'} ---\n${docText}`
          downloadedDocs.push(link.text || link.href)
          console.log(`Parsed doc: ${link.text} (${docText.length} chars after trim)`)
        }
      } catch (err) {
        console.error(`Failed to parse ${link.href}:`, err.message)
      }
    }

    // Combine doc text and page text: docs have the full JDPS, page text has the
    // rendered tabs (person spec table, job summary). Keeping both maximises coverage.
    const cleanPageText = extractRelevantPageText(pageText)
    let rawText
    if (combinedDocText.length > 200) {
      // Docs first (authoritative), then page text for anything the PDF missed
      rawText = combinedDocText + '\n\n=== PAGE TEXT (SUPPLEMENTAL) ===\n' + cleanPageText
    } else {
      rawText = cleanPageText
    }

    res.json({
      jobTitle,
      organisation,
      rawText,
      downloadedDocs,
      source: combinedDocText.length > 200 ? 'documents' : 'page',
    })
  } catch (err) {
    console.error('Scrape error:', err)
    if (browser) await browser.close().catch(() => {})
    res.status(500).json({ error: err.message })
  }
})

async function downloadAndParseDoc(url, cookieHeader) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Cookie: cookieHeader,
      Referer: url,
    },
    maxRedirects: 5,
  })

  const buffer = Buffer.from(response.data)
  const contentType = response.headers['content-type'] || ''
  const urlLower = url.toLowerCase()

  if (contentType.includes('pdf') || urlLower.includes('.pdf') || urlLower.includes('pdf')) {
    const data = await pdfParse(buffer)
    return data.text
  }

  if (
    contentType.includes('wordprocessingml') ||
    contentType.includes('msword') ||
    urlLower.includes('.docx') ||
    urlLower.includes('.doc')
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // Try PDF by default
  try {
    const data = await pdfParse(buffer)
    return data.text
  } catch {
    return ''
  }
}

function extractRelevantPageText(text) {
  // Clean up whitespace from page text
  const cleaned = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n')
  // Keep 20k chars: first 14k (job description) + last 6k (person spec at bottom)
  if (cleaned.length <= 20000) return cleaned
  return cleaned.slice(0, 14000) + '\n\n[...middle omitted...]\n\n' + cleaned.slice(-6000)
}

app.listen(PORT, () => {
  console.log(`Scraper service running on port ${PORT}`)
})
