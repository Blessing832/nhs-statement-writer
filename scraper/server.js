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
    console.log(`Scraping: ${url}`)

    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    })

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    })

    const page = await context.newPage()

    // Navigate to the job page
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

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
            href.includes('/file/')
          const isDocLink =
            text.includes('job description') ||
            text.includes('person spec') ||
            text.includes('person specification') ||
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

    // If we got doc text, use it; otherwise fall back to page text
    const rawText =
      combinedDocText.length > 200
        ? combinedDocText
        : extractRelevantPageText(pageText)

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
