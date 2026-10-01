import './globals.css'
import Link from 'next/link'
import { Bricolage_Grotesque, Atkinson_Hyperlegible } from 'next/font/google'
import LangToggle from '@/components/LangToggle'
import Nav from '@/components/Nav'
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' })
const body = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-body' })
export const metadata = { title: 'HatodJasaan', description: 'Order from local eateries in Jasaan, Misamis Oriental. Local riders, lower fees.', manifest: '/manifest.webmanifest' }
export const viewport = { themeColor: '#0A4D68' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} font-sans`}>
        <header className="sticky top-0 z-10 border-b-4 border-sun bg-sea text-white">
          <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-display text-xl font-extrabold">HatodJasaan</Link>
            <div className="flex items-center gap-3 text-sm">
              <Nav />
              <span className="text-ink"><LangToggle /></span>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}
