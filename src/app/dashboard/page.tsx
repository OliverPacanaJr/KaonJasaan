'use client'
import { useCallback, useEffect, useState } from 'react'
import { sb, peso } from '@/lib/supabase'
type O = { id: string; code: string; status: string; customer_name: string; customer_phone: string; address: string; pay: string; subtotal: number; delivery_fee: number; note: string | null; order_items: { name: string; qty: number }[] }
const NEXT: Record<string, [string, string]> = { pending: ['accepted', 'Accept order'], accepted: ['preparing', 'Start cooking'], preparing: ['ready', 'Mark ready'], ready: ['out_for_delivery', 'Handed to rider'], out_for_delivery: ['delivered', 'Mark delivered'] }
export default function Dashboard() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [orders, setOrders] = useState<O[]>([])
  const [em, setEm] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data } = await sb.from('orders').select('*, order_items(name,qty)').in('status', ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery']).order('created_at')
    setOrders((data ?? []) as O[])
  }, [])
  useEffect(() => { sb.auth.getSession().then(({ data }) => setAuthed(!!data.session)) }, [])
  useEffect(() => { if (!authed) return; load(); const i = setInterval(load, 8000); return () => clearInterval(i) }, [authed, load])
  async function login() {
    const { error } = await sb.auth.signInWithPassword({ email: em, password: pw })
    if (error) setErr(error.message); else { setErr(''); setAuthed(true) }
  }
  async function move(id: string, to: string) {
    const { error } = await sb.rpc('set_order_status', { p_id: id, p_status: to })
    if (error) setErr(error.message); else { setErr(''); load() }
  }
  if (authed === null) return <main className="p-6">…</main>
  if (!authed) return (
    <main className="mx-auto max-w-sm space-y-3 px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold text-sea">Eatery login</h1>
      <input className="field" type="email" autoComplete="email" placeholder="Email" value={em} onChange={e => setEm(e.target.value)} />
      <input className="field" type="password" autoComplete="current-password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} />
      {err && <p role="alert" className="font-bold text-red-700">{err}</p>}
      <button className="btn w-full" onClick={login}>Sign in</button>
    </main>
  )
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <div className="flex items-center justify-between"><h1 className="font-display text-3xl font-extrabold text-sea">Incoming orders</h1>
        <button className="text-sm font-bold underline" onClick={async () => { await sb.auth.signOut(); setAuthed(false) }}>Sign out</button></div>
      {err && <p role="alert" className="mt-2 font-bold text-red-700">{err}</p>}
      {orders.length === 0 && <p className="py-10 text-ink/70">No active orders. New orders appear here automatically.</p>}
      <ul className="mt-4 space-y-4">
        {orders.map(o => (
          <li key={o.id} className="rounded-lg border-2 border-ink/10 bg-white p-4">
            <div className="flex justify-between gap-2 font-bold"><span>{o.customer_name} ({o.code})</span><span className="tabular-nums">{peso(o.subtotal + o.delivery_fee)} {o.pay.toUpperCase()}</span></div>
            <p className="text-sm text-ink/70">{o.address}, {o.customer_phone}</p>
            <ul className="my-2">{o.order_items.map(i => <li key={i.name}>{i.qty} × {i.name}</li>)}</ul>
            {o.note && <p className="text-sm italic">“{o.note}”</p>}
            <div className="mt-3 flex gap-2">
              {NEXT[o.status] && <button className="btn flex-1" onClick={() => move(o.id, NEXT[o.status][0])}>{NEXT[o.status][1]}</button>}
              {['pending', 'accepted'].includes(o.status) && <button className="rounded-lg border-2 border-ink/20 px-4 font-bold" onClick={() => move(o.id, 'cancelled')}>Cancel</button>}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
