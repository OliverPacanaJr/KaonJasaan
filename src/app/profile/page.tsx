'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { sb, peso, type Barangay } from '@/lib/supabase'
import { useMe } from '@/lib/me'
const METHODS: [string, string, string][] = [['cod', 'Cash on delivery', ''], ['gcash', 'GCash', 'GCash number'], ['maya', 'Maya', 'Maya number'], ['bank', 'Bank transfer', 'Bank and account number']]
type Shop = { id: string; name: string; is_open: boolean; pay_methods: string[]; pay_details: Record<string, string> }
function MenuEditor({ shopId }: { shopId: string }) {
  const [items, setItems] = useState<{ id: string; name: string; price: number; is_available: boolean }[]>([])
  const [name, setName] = useState(''); const [price, setPrice] = useState('')
  const load = useCallback(() => { sb.from('menu_items').select('id,name,price,is_available').eq('eatery_id', shopId).order('name').then(r => setItems(r.data ?? [])) }, [shopId])
  useEffect(() => { load() }, [load])
  async function add() {
    const { error } = await sb.from('menu_items').insert({ eatery_id: shopId, name: name.trim(), price: Number(price) })
    if (!error) { setName(''); setPrice(''); load() }
  }
  async function flip(id: string, on: boolean) { await sb.from('menu_items').update({ is_available: !on }).eq('id', id); load() }
  return (
    <div className="space-y-2">
      <h4 className="font-bold">Menu and products</h4>
      <ul className="space-y-1">{items.map(i => (
        <li key={i.id} className="flex items-center justify-between gap-2"><span className={i.is_available ? '' : 'text-ink/40 line-through'}>{i.name} {peso(i.price)}</span>
          <button className="rounded-lg border-2 border-ink/20 px-2 py-1 text-sm font-bold" onClick={() => flip(i.id, i.is_available)}>{i.is_available ? 'Mark sold out' : 'Back in stock'}</button></li>))}</ul>
      <div className="flex gap-2"><input className="field" placeholder="Item name" value={name} onChange={e => setName(e.target.value)} />
        <input className="field w-24" inputMode="decimal" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)} />
        <button className="btn" disabled={!name.trim() || !(Number(price) > 0)} onClick={add}>Add</button></div>
    </div>
  )
}
function ShopPanel({ s, onMsg }: { s: Shop; onMsg: (m: string) => void }) {
  const [open, setOpen] = useState(s.is_open)
  const [pay, setPay] = useState<string[]>(s.pay_methods)
  const [det, setDet] = useState<Record<string, string>>(s.pay_details ?? {})
  const toggle = (k: string) => setPay(pay.includes(k) ? pay.filter(x => x !== k) : [...pay, k])
  async function save() {
    const details = Object.fromEntries(Object.entries(det).filter(([k]) => pay.includes(k)))
    const { error } = await sb.rpc('update_shop', { p_id: s.id, p_is_open: open, p_pay: pay, p_details: details })
    onMsg(error ? error.message : 'Shop saved.')
  }
  return (
    <section className="space-y-3 rounded-lg border-2 border-ink/10 bg-white p-4">
      <h3 className="font-display text-xl font-bold">{s.name}</h3>
      <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={open} onChange={() => setOpen(!open)} /> Open for orders</label>
      <div className="space-y-2"><h4 className="font-bold">Payment modes you accept</h4>
        {METHODS.map(([k, label, ph]) => (
          <div key={k}><label className="flex items-center gap-2"><input type="checkbox" checked={pay.includes(k)} onChange={() => toggle(k)} /> {label}</label>
            {k !== 'cod' && pay.includes(k) && <input className="field mt-1" placeholder={ph} value={det[k] ?? ''} onChange={e => setDet({ ...det, [k]: e.target.value })} />}</div>))}
        <p className="text-sm text-ink/70">Delivery fees are always paid in cash to the rider, whatever you accept here.</p></div>
      <button className="btn w-full" disabled={pay.length === 0} onClick={save}>Save shop settings</button>
      <MenuEditor shopId={s.id} />
    </section>
  )
}
export default function Profile() {
  const router = useRouter()
  const { me, loading, reload } = useMe()
  const [bs, setBs] = useState<Barangay[]>([])
  const [p, setP] = useState({ full_name: '', phone: '', address: '', barangay_id: '' })
  const [avatar, setAvatar] = useState('')
  const [apps, setApps] = useState<{ kind: string; status: string; reason: string | null }[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [orders, setOrders] = useState<{ code: string; status: string; subtotal: number; delivery_fee: number }[]>([])
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!me) return
    setP({ full_name: me.full_name ?? '', phone: me.phone ?? '', address: me.address ?? '', barangay_id: String(me.barangay_id ?? '') })
    if (me.avatar_path) sb.storage.from('kyc').createSignedUrl(me.avatar_path, 3600).then(r => setAvatar(r.data?.signedUrl ?? ''))
    sb.from('barangays').select('id,name').order('name').then(r => setBs(r.data ?? []))
    sb.from('applications').select('kind,status,reason').then(r => setApps(r.data ?? []))
    sb.from('eateries').select('id,name,is_open,pay_methods,pay_details').eq('owner_id', me.id).then(r => setShops(r.data ?? []))
    sb.from('orders').select('code,status,subtotal,delivery_fee').eq('customer_id', me.id).order('created_at', { ascending: false }).limit(10).then(r => setOrders(r.data ?? []))
  }, [me])
  async function save() {
    const { error } = await sb.rpc('update_profile', { p_name: p.full_name, p_phone: p.phone, p_address: p.address, p_barangay: Number(p.barangay_id) || null })
    setMsg(error ? error.message : 'Profile saved.'); if (!error) reload()
  }
  if (loading) return <main className="p-6">…</main>
  if (!me) return <main className="p-6 font-bold"><Link href="/login" className="underline">Sign in</Link> to see your profile.</main>
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setP({ ...p, [k]: e.target.value })
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <div className="flex items-center gap-4">
        {avatar ? <img src={avatar} alt="Your profile photo" className="h-20 w-20 rounded-full object-cover" /> : <div className="h-20 w-20 rounded-full bg-sea/20" aria-hidden />}
        <div><h1 className="font-display text-3xl font-extrabold text-sea">{me.full_name || 'Your profile'}</h1><p className="text-sm text-ink/70">{me.email} ({me.verified ? 'verified' : 'not verified'})</p></div>
      </div>
      <section className="space-y-3">
        <input className="field" placeholder="Full name" value={p.full_name} onChange={set('full_name')} />
        <input className="field" placeholder="Mobile (09XXXXXXXXX)" inputMode="tel" value={p.phone} onChange={set('phone')} />
        <input className="field" placeholder="Home address" value={p.address} onChange={set('address')} />
        <select className="field" value={p.barangay_id} onChange={set('barangay_id')}><option value="">Barangay</option>{bs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <button className="btn w-full" onClick={save}>Save profile</button>
        {msg && <p role="status" className="font-bold">{msg}</p>}
      </section>
      <section className="space-y-2"><h2 className="font-display text-2xl font-bold">Verification</h2>
        {apps.map(a => <p key={a.kind} className="font-bold">{a.kind}: {a.status}{a.reason ? ` (${a.reason})` : ''}</p>)}
        <Link href="/register" className="font-bold text-sea underline">Apply as customer, shop or rider</Link></section>
      {shops.map(s => <ShopPanel key={s.id} s={s} onMsg={setMsg} />)}
      <section><h2 className="font-display text-2xl font-bold">My orders</h2>
        <ul className="mt-2 divide-y divide-ink/10">{orders.map(o => <li key={o.code}><Link href={`/track/${o.code}`} className="flex justify-between py-3 font-bold"><span>{o.code} ({o.status.replace(/_/g, ' ')})</span><span className="tabular-nums">{peso(o.subtotal + o.delivery_fee)}</span></Link></li>)}</ul></section>
      <button className="font-bold underline" onClick={async () => { await sb.auth.signOut(); router.push('/') }}>Sign out</button>
    </main>
  )
}
