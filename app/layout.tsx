import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { FestiveGarland, Snowfall } from '@/components/Festive'

// Fonts ship with the app (npm packages), so a build never has to download them from Google.
const dmSans = localFont({
  src: [
    {
      path: '../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2',
      weight: '100 1000',
      style: 'normal',
    },
    {
      path: '../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-ext-wght-normal.woff2',
      weight: '100 1000',
      style: 'normal',
    },
  ],
  variable: '--font-dm-sans',
  display: 'swap',
})

const fraunces = localFont({
  src: [
    {
      path: '../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: '../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2',
      weight: '100 900',
      style: 'italic',
    },
  ],
  variable: '--font-fraunces',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EaseMe — NHS Supporting Statement Writer',
  description: 'Get a criteria-matched NHS supporting statement ready in minutes. Covers NHS England & Wales, NHS Scotland, Civil Service and HealthJobsUK. Download as a Word doc.',
  keywords: 'NHS supporting statement, NHS job application help, person specification NHS, NHS statement writer, supporting statement generator, NHS application criteria',
  openGraph: {
    title: 'EaseMe — NHS Supporting Statement Writer',
    description: 'Criteria-matched NHS supporting statements in minutes. NHS England & Wales, Scotland, Civil Service, HealthJobsUK.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${dmSans.variable} ${fraunces.variable}`}>
      <body className="min-h-full flex flex-col">
        <FestiveGarland />
        <Snowfall />
        {children}
      </body>
    </html>
  )
}
