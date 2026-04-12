import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NHS Statement Writer',
  description: 'Professional supporting statement generator for NHS and Civil Service job applications',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
