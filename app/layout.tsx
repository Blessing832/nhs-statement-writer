import type { Metadata } from 'next'
import { DM_Sans, Fraunces } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EaseMe — NHS Supporting Statement Writer',
  description: 'Get a criteria-matched NHS supporting statement ready in 2 minutes. Covers NHS England & Wales, NHS Scotland, Civil Service and HealthJobsUK. Download as a Word doc.',
  keywords: 'NHS supporting statement, NHS job application help, person specification NHS, NHS statement writer, supporting statement generator, NHS application criteria',
  openGraph: {
    title: 'EaseMe — NHS Supporting Statement Writer',
    description: 'Criteria-matched NHS supporting statements in 2 minutes. NHS England & Wales, Scotland, Civil Service, HealthJobsUK.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${dmSans.variable} ${fraunces.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
