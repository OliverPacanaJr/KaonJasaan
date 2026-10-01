'use client'
import { useCallback, useEffect, useState } from 'react'
import { sb, peso } from '@/lib/supabase'
import { useMe } from '@/lib/me'
type O = { id: string; code: string; status: string; rider_id: string | null; customer_name: string; customer_phone: string; address: string; pay: string; subtotal: number; delivery_fee: number; eateries: { name: string } | null }
export default function Rider() {
  const { me, loading } = useMe()
  const [orders, setOrders] = useState<O[]>([]); const [earn, setEarn] = useState({ trips: 0, total: 0 }); const [err, setErr] = useState('')
  const load = useCallback(async () => {
    if (!me) return
    const { data } = await sb.from('orders').select('id,code,status,rider_id,customer_name,customer_phone,address,pay,subtotal,delivery_fee,eateries(name)').in('status', ['ready', 'out_for_delivery']).order('created_at')
    setOrders((data ?? []) as unknown as O[])
    const { data: d } = await sb.from('orders').select('delivery_fee').eq('rider_id', me.id).eq('status', 'delivered')
    setEarn({ trips: (d ?? []).length, total: (d ?? []).reduce((s: number, x: { delivery_fee: number }) => s + x.delivery_fee, 0) })
  }, [me])
  useEffect(() => { if (me?.role !== 'rider') return; load(); const i = setInterval(load, 8000); return () => clearInterval(i) }, [me, load])
  async function act(fn: 'claim_order' | 'set_order_status', id: string, to?: string) {
    const { error } = fn === 'claim_order' ? await sb.rpc('claim_order', { p_id: id }) : await sb.rpc('set_order_status', { p_id: id, p_status: to })
    if (error) setErr(error.message); else { setErr(''); load() }
  }
  if (loading) return <main className="p-6">…</main>
  if (me?.role !== 'rider') return <main className="p-6 font-bold">Riders only. Apply on the Get verified page.</main>
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <h1 className="font-display text-3xl font-extrabold text-sea">Deliveries</h1>
      <p className="rounded-lg bg-sun/30 p-3 font-bold">Delivery fees earned: {peso(earn.total)} from {earn.trips} trips</p>
      {err && <p role="alert" className="font-bold text-red-700">{err}</p>}
      {orders.length === 0 && <p className="text-ink/70">No orders waiting. New ones appear here automatically.</p>}
      {orders.map(o => (
        <section key={o.id} className="space-y-1 rounded-lg border-2 border-ink/10 bg-white p-4">
          <h2 className="font-bold">{o.eateries?.name} to {o.customer_name}</h2>
          <p className="text-sm text-ink/70">{o.address}, {o.customer_phone}</p>
          <p className="font-bold">Collect in cash: {peso(o.delivery_fee + (o.pay === 'cod' ? o.subtotal : 0))}</p>
          {o.rider_id === null ? <button className="btn w-full" onClick={() => act('claim_order', o.id)}>Claim this delivery</button>
            : o.status === 'ready' ? <button className="btn w-full" onClick={() => act('set_order_status', o.id, 'out_for_delivery')}>Picked up from shop</button>
            : <button className="btn w-full" onClick={() => act('set_order_status', o.id, 'delivered')}>Delivered</button>}
        </section>
      ))}
    </main>
  )
}
