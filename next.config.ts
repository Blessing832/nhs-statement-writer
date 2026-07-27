import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // These packages contain native binaries / require Node.js built-ins and must not be bundled
  serverExternalPackages: ['pdf-parse', 'mammoth', 'word-extractor', '@sparticuz/chromium-min', 'puppeteer-core'],

  async rewrites() {
    return [
      {
        // Any path on app.easeme.live → serve the marketing landing page
        source: '/:path*',
        destination: '/landing',
        has: [{ type: 'host', value: 'app.easeme.live' }],
      },
    ]
  },
}

export default nextConfig
