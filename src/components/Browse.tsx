'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n'
import type { Barangay, Eatery } from '@/lib/supabase'
export default function Browse({ barangays, eateries }: { barangays: Barangay[]; eateries: Eatery[] }) {
  const { t } = useT()
  const [b, setB] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [c, setC] = useState('')
  const cats = Array.from(new Set(eateries.map(e => e.category).filter(Boolean)))
  const names = new Map(barangays.map(x => [x.id, x.name] as [number, string]))
  const list = eateries.filter(e => (b === null || e.barangay_id === b) && (!c || e.category === c) && e.name.toLowerCase().includes(q.toLowerCase()))
  const chips: { id: number | null; name: string }[] = [{ id: null, name: t('all') }, ...barangays]
  return (
    <main className="mx-auto max-w-xl px-4 pb-20">
      <h1 className="py-8 font-display text-4xl font-extrabold leading-tight text-sea">{t('tag')}</h1>
      <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} />
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
        {chips.map(x => (
          <button key={x.id ?? 'all'} onClick={() => setB(x.id)} aria-pressed={b === x.id}
            className={`shrink-0 rounded-full border-2 px-3 py-1 text-sm font-bold ${b === x.id ? 'border-sun bg-sun' : 'border-ink/15 bg-white'}`}>{x.name}</button>
        ))}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {['', ...cats].map(x => (
          <button key={x || 'all'} onClick={() => setC(x)} aria-pressed={c === x} className={`shrink-0 rounded-full border-2 px-3 py-1 text-sm font-bold ${c === x ? 'border-sea bg-sea text-white' : 'border-ink/15 bg-white'}`}>{x || 'All types'}</button>
        ))}
      </div>
      <ul className="mt-4">
        {list.map(e => (
          <li key={e.id} className="border-b border-ink/10">
            <Link href={`/e/${e.slug}`} className="flex items-center justify-between gap-4 py-4">
              <span>
                <span className="block font-display text-xl font-bold">{e.name}</span>
                <span className="block text-sm text-ink/70">{e.description}</span>
                <span className="block text-sm font-bold text-sea">{names.get(e.barangay_id)}<span className="ml-2 font-normal text-ink/60">{e.category}</span></span>
              </span>
              <span className="shrink-0 text-right text-sm">
                <span className="flex items-center justify-end gap-1.5 font-bold"><span className={`h-2.5 w-2.5 rounded-full ${e.is_open ? 'bg-reef' : 'bg-ink/30'}`} />{e.is_open ? t('open') : t('closed')}</span>
                <span className="text-ink/60">{t('from')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="py-10 text-ink/70">{t('empty')}</p>}
    </main>
  )
}
