import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AuraCare+ · Care, made more human',
  description: 'A safe, synthetic wellness companion for Eleanor and Priya.',
  generator: 'v0.app',
}
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f5f7fb', userScalable: true }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
