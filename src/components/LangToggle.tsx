'use client'
import { useT } from '@/lib/i18n'
export default function LangToggle() {
  const { l, toggle } = useT()
  return <button onClick={toggle} className="rounded-lg border-2 border-ink/20 bg-white px-3 py-1 text-sm font-bold">{l === 'en' ? 'Bisaya' : 'English'}</button>
}
