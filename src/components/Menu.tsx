'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { sb, peso, feeFor, type Barangay, type Eatery, type MenuItem } from '@/lib/supabase'
import { useT, type K } from '@/lib/i18n'
import { useMe } from '@/lib/me'
function Row({ a, b, big }: { a: string; b: string; big?: boolean }) {
  return <div className={`flex items-end ${big ? 'text-xl font-extrabold' : ''}`}><span>{a}</span><i className="leader" /><span className="tabular-nums">{b}</span></div>
}
export default function Menu({ eatery, menu, barangays }: { eatery: Eatery; menu: MenuItem[]; barangays: Barangay[] }) {
  const { t } = useT()
  const { me } = useMe()
  const router = useRouter()
  const [cart, setCart] = useState<Record<string, number>>({})
  const [f, setF] = useState({ name: '', phone: '', addr: '', note: '', b: eatery.barangay_id, pay: eatery.pay_methods?.[0] ?? 'cod' })
  useEffect(() => { if (me) setF(x => ({ ...x, name: x.name || me.full_name || '', phone: x.phone || me.phone || '', addr: x.addr || me.address || '', b: me.barangay_id ?? x.b })) }, [me])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const sub = useMemo(() => menu.reduce((s, m) => s + m.price * (cart[m.id] ?? 0), 0), [cart, menu])
  const fee = feeFor(eatery.barangay_id, f.b, barangays)
  const bump = (id: string, d: number) => setCart(c => {
    const v = Math.max(0, Math.min(20, (c[id] ?? 0) + d)); const x = { ...c, [id]: v }
    if (!v) delete x[id]
    return x
  })
  async function submit() {
    setBusy(true); setErr('')
    const { data, error } = await sb.rpc('place_order', {
      p_eatery: eatery.id, p_name: f.name, p_phone: f.phone, p_address: f.addr, p_barangay: f.b,
      p_pay: f.pay, p_note: f.note || null, p_items: Object.entries(cart).map(([id, qty]) => ({ id, qty })),
    })
    if (error) { setErr(error.message); setBusy(false); return }
    router.push('/track/' + data)
  }
  const ready = sub > 0 && f.name && f.phone && f.addr && !busy && eatery.is_open && me?.verified
  return (
    <main className="mx-auto max-w-xl px-4 pb-20">
      <header className="py-6">
        <h1 className="font-display text-4xl font-extrabold text-sea">{eatery.name}</h1>
        <p className="mt-1 text-ink/70">{eatery.description}</p>
        <p className="mt-2 flex items-center gap-2 text-sm font-bold">
          <span className={`h-2.5 w-2.5 rounded-full ${eatery.is_open ? 'bg-reef' : 'bg-ink/30'}`} />
          <span>{eatery.is_open ? t('open') : t('closed')}</span>
          <span className="text-sea">{barangays.find(x => x.id === eatery.barangay_id)?.name}</span>
        </p>
      </header>
      <ul className="space-y-4">
        {menu.map(m => (
          <li key={m.id} className={`flex items-end ${m.is_available ? '' : 'opacity-50'}`}>
            <span className="font-bold">{m.name}{!m.is_available && <span className="ml-2 text-sm font-normal">{t('sold')}</span>}</span>
            <i className="leader" /><span className="font-bold tabular-nums">{peso(m.price)}</span>
            <span className="ml-3 flex items-center gap-2">
              <button aria-label={`Remove ${m.name}`} onClick={() => bump(m.id, -1)} className="h-9 w-9 rounded-full border-2 border-ink/20 font-bold">−</button>
              <span className="w-5 text-center tabular-nums">{cart[m.id] ?? 0}</span>
              <button aria-label={`Add ${m.name}`} disabled={!m.is_available || !eatery.is_open} onClick={() => bump(m.id, 1)} className="h-9 w-9 rounded-full bg-sun font-bold disabled:opacity-30">+</button>
            </span>
          </li>
        ))}
      </ul>
      <section className="mt-10 space-y-3">
        <h2 className="font-display text-2xl font-bold">{t('cart')}</h2>
        {!me ? <p className="rounded-lg bg-sun/30 p-3 font-bold"><Link href="/login" className="underline">Sign in</Link> to place an order.</p>
          : !me.verified && <p className="rounded-lg bg-sun/30 p-3 font-bold">Your account is not verified yet. <Link href="/register" className="underline">Submit your documents</Link> to start ordering.</p>}
        <input className="field" autoComplete="name" placeholder={t('name')} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <input className="field" autoComplete="tel" inputMode="tel" placeholder={t('phone')} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
        <select className="field" value={f.b} onChange={e => setF({ ...f, b: +e.target.value })}>
          {barangays.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <input className="field" placeholder={t('addr')} value={f.addr} onChange={e => setF({ ...f, addr: e.target.value })} />
        <input className="field" placeholder={t('note')} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          {(eatery.pay_methods ?? ['cod']).map(p => (
            <button key={p} onClick={() => setF({ ...f, pay: p })} aria-pressed={f.pay === p}
              className={`rounded-lg border-2 px-3 py-2.5 font-bold ${f.pay === p ? 'border-sea bg-sea text-white' : 'border-ink/15 bg-white'}`}>{t(p as K)}</button>
          ))}
        </div>
        {f.pay !== 'cod' && <p className="rounded-lg bg-sun/30 p-3 text-sm">Send {peso(sub)} to {eatery.pay_details?.[f.pay] || 'the shop'} via {t(f.pay as K)} and keep the screenshot.</p>}
        <p className="text-sm text-ink/70">The delivery fee ({peso(fee)}) is always paid in cash to the rider.</p>
        <div className="space-y-1 pt-2">
          <Row a={t('sub')} b={peso(sub)} /><Row a={t('fee')} b={peso(fee)} /><Row a={t('total')} b={peso(sub + fee)} big />
        </div>
        {err && <p role="alert" className="font-bold text-red-700">{err}</p>}
        <button className="btn w-full" disabled={!ready} onClick={submit}>{t('place')}</button>
      </section>
    </main>
  )
}
