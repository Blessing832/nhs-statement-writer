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

    // Collect all potentially relevant document links using three strategies:
    //   1. Any link whose URL looks like a document file (PDF/DOCX/download path)
    //   2. Any link with document-related keyword text
    //   3. Every link inside sections that appear to be attachment/supporting-doc areas
    const docLinks = await page.evaluate(() => {
      const seen = new Set()
      const results = []

      function scoreAndAdd(href, text) {
        const norm = (href || '').split('?')[0].toLowerCase()
        if (!href || !href.startsWith('http') || seen.has(norm)) return
        seen.add(norm)
        const t = (text || '').toLowerCase().trim()
        const h = href.toLowerCase()
        const score =
          (t.includes('person spec') || t.includes('person specification')) ? 10 :
          (t.includes('jdps') || t.includes('jd and ps') || t.includes('jd & ps') || t.includes('jd/ps')) ? 9 :
          t.includes('job description') ? 8 :
          (t.includes('job pack') || t.includes('role profile')) ? 7 :
          (t.includes('application pack') || t.includes('candidate pack') || t.includes('recruitment pack')) ? 6 :
          (t.includes('supporting document') || t.includes('supporting info') || t.includes('information pack')) ? 5 :
          (h.endsWith('.pdf') || h.endsWith('.docx') || h.endsWith('.doc')) ? 4 :
          (h.includes('/download/') || h.includes('/attachment/') || h.includes('/file/') || h.includes('/document/') || h.includes('/files/')) ? 3 :
          t.includes('download') ? 2 :
          t.includes('attachment') ? 2 : 1
        results.push({ href, text: (text || '').trim(), score })
      }

      // Strategy 1 & 2: all links that are doc files OR match keywords
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.href
        const text = a.textContent.trim()
        const h = href.toLowerCase()
        const t = text.toLowerCase()

        const isDocFile =
          h.endsWith('.pdf') || h.endsWith('.docx') || h.endsWith('.doc') ||
          h.includes('/document/') || h.includes('/download/') ||
          h.includes('/attachment/') || h.includes('/file/') || h.includes('/files/')

        const isKeywordMatch =
          t.includes('person spec') || t.includes('job description') || t.includes('job desc') ||
          t.includes('jdps') || t.includes('jd and ps') || t.includes('jd & ps') || t.includes('jd/ps') ||
          t.includes('job pack') || t.includes('job detail') || t.includes('role profile') ||
          t.includes('supporting document') || t.includes('supporting info') ||
          t.includes('application pack') || t.includes('information pack') ||
          t.includes('candidate pack') || t.includes('recruitment pack') ||
          t.includes('additional information') || t.includes('further information') ||
          t.includes('download') || t.includes('attachment')

        if (isDocFile || isKeywordMatch) scoreAndAdd(href, text)
      }

      // Strategy 3: every link inside sections that look like attachment areas,
      // regardless of the individual link text
      const attachSelectors = [
        '[class*="attachment"]', '[id*="attachment"]',
        '[class*="supporting"]', '[id*="supporting"]',
        '[class*="document"]',   '[id*="document"]',
        '[class*="download"]',   '[id*="download"]',
        '[aria-label*="document"]', '[aria-label*="attachment"]',
        '[aria-label*="supporting"]',
        '[data-section*="document"]', '[data-section*="attachment"]',
      ]
      for (const sel of attachSelectors) {
        document.querySelectorAll(sel).forEach(section => {
          section.querySelectorAll('a[href]').forEach(a => {
            if (a.href.startsWith('http')) scoreAndAdd(a.href, a.textContent.trim())
          })
        })
      }

      results.sort((a, b) => b.score - a.score)
      return results
    })

    console.log(`Found ${docLinks.length} document links:`, docLinks)

    // Also grab the visible page text as fallback
    const pageText = await page.evaluate(() => document.body.innerText)

    // Get cookies from the browser session so we can use them for downloads
    const cookies = await context.cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

    await browser.close()
    browser = null

    // Download and parse each document — limit per-doc to 30k chars, total to 8 docs.
    // Higher-scored docs (person spec first) are processed first.
    let combinedDocText = ''
    const downloadedDocs = []
    const PER_DOC_LIMIT = 30000

    for (const link of docLinks.slice(0, 8)) {
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
      Accept: 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,*/*',
    },
    maxRedirects: 5,
  })

  const buffer = Buffer.from(response.data)
  const contentType = (response.headers['content-type'] || '').toLowerCase()
  const urlLower = url.toLowerCase()

  const isPdf = contentType.includes('pdf') || urlLower.includes('.pdf')
  const isDocx =
    contentType.includes('wordprocessingml') ||
    contentType.includes('msword') ||
    urlLower.includes('.docx') ||
    urlLower.includes('.doc')

  if (isPdf) {
    const data = await pdfParse(buffer)
    return data.text || ''
  }
  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value || ''
  }

  // Unknown content type — common with NHS Jobs extensionless /download/{id} URLs.
  // Always try PDF first (most JDPS files are PDFs), then DOCX.
  try {
    const data = await pdfParse(buffer)
    if (data.text && data.text.length > 100) return data.text
  } catch { /* not a PDF */ }
  try {
    const result = await mammoth.extractRawText({ buffer })
    if (result.value && result.value.length > 100) return result.value
  } catch { /* not a DOCX */ }
  return ''
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
