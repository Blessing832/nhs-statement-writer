import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // These packages contain native binaries / require Node.js built-ins and must not be bundled
  serverExternalPackages: ['pdf-parse', 'mammoth', '@sparticuz/chromium-min', 'puppeteer-core'],
}

export default nextConfig
