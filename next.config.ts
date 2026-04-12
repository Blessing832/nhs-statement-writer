import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // pdf-parse uses Node.js built-ins — keep them server-side only
  serverExternalPackages: ['pdf-parse', 'mammoth'],
}

export default nextConfig
