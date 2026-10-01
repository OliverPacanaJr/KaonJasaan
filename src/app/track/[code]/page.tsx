'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { sb, peso } from '@/lib/supabase'
import { useT, type K } from '@/lib/i18n'
const STEPS = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered']
type Tr = { code: string; status: string; eatery: string; subtotal: number; delivery_fee: number; pay: string; items: { name: string; qty: number; price: number }[] | null }
export default function Track() {
  const { code } = useParams<{ code: string }>()
  const { t } = useT()
  const [o, setO] = useState<Tr | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let on = true
    const load = async () => { const { data } = await sb.rpc('track_order', { p_code: code }); if (on) { setO(data?.[0] ?? null); setLoaded(true) } }
    load(); const i = setInterval(load, 8000) // polling keeps this reliable on slow data
    return () => { on = false; clearInterval(i) }
  }, [code])
  if (!loaded) return <main className="p-6">…</main>
  if (!o) return <main className="p-6 font-bold">Order not found. Check your code.</main>
  const at = STEPS.indexOf(o.status)
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <p className="text-sm text-ink/70">{o.eatery}</p>
      <h1 className="font-display text-3xl font-extrabold text-sea">{t(('s_' + o.status) as K)}</h1>
      <p className="mt-1 font-bold tabular-nums">Order code: {o.code}</p>
      {o.status === 'cancelled' ? null : (
        <ol className="mt-6 space-y-3 border-l-4 border-ink/10 pl-4">
          {STEPS.map((s, i) => (
            <li key={s} className={`relative ${i <= at ? 'font-bold' : 'text-ink/40'}`}>
              <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ${i < at ? 'bg-reef' : i === at ? 'bg-sun ring-4 ring-sun/40' : 'bg-ink/20'}`} />{t(('s_' + s) as K)}
            </li>
          ))}
        </ol>
      )}
      <ul className="mt-8 space-y-1">{o.items?.map(i => <li key={i.name} className="flex justify-between"><span>{i.qty} × {i.name}</span><span className="tabular-nums">{peso(i.qty * i.price)}</span></li>)}</ul>
      <div className="mt-3 space-y-1 border-t border-ink/10 pt-3 font-bold"><p className="flex justify-between"><span>Pay the shop ({t(o.pay as K)})</span><span className="tabular-nums">{peso(o.subtotal)}</span></p><p className="flex justify-between"><span>Pay the rider (cash)</span><span className="tabular-nums">{peso(o.delivery_fee)}</span></p></div>
    </main>
  )
}
