'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { sb, type Barangay } from '@/lib/supabase'
import { useMe } from '@/lib/me'
type Kind = 'customer' | 'business' | 'rider'
const CATS = ['Carinderia', 'Lechon and grilled', 'Bakery and snacks', 'Drinks and desserts', 'Grocery', 'Pharmacy', 'Other']
const KINDS: Record<Kind, { label: string; hint: string; docs: [string, string][]; extra: [string, string][] }> = {
  customer: { label: 'Customer', hint: 'Order from local shops.', extra: [], docs: [['selfie', 'Selfie (becomes your profile photo)'], ['id', 'Government or school ID'], ['residency', 'Proof of Jasaan residency (barangay certificate or bill)']] },
  business: { label: 'Shop', hint: 'Sell food, groceries or anything else.', extra: [['name', 'Shop name'], ['description', 'What do you sell?']], docs: [['storefront', 'Photo of your shop'], ['permit', 'Business permit or barangay clearance']] },
  rider: { label: 'Rider', hint: 'Deliver orders and earn.', extra: [['plate', 'Plate number']], docs: [['selfie', 'Selfie (becomes your profile photo)'], ['license', "Driver's license"], ['motorcycle', 'Photo of your motorcycle or tricycle']] },
}
export default function Register() {
  const { me, loading } = useMe()
  const [kind, setKind] = useState<Kind>('customer')
  const [bs, setBs] = useState<Barangay[]>([])
  const [f, setF] = useState<Record<string, string>>({ category: CATS[0] })
  const [files, setFiles] = useState<Record<string, File>>({})
  const [apps, setApps] = useState<{ kind: string; status: string; reason: string | null }[]>([])
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const load = () => sb.from('applications').select('kind,status,reason').then(r => setApps(r.data ?? []))
  useEffect(() => { sb.from('barangays').select('id,name').order('name').then(r => setBs(r.data ?? [])) }, [])
  useEffect(() => { if (me) load() }, [me])
  const k = KINDS[kind]
  const cur = apps.find(a => a.kind === kind)
  async function submit() {
    if (!me) return
    setBusy(true); setMsg('')
    try {
      const docs: Record<string, string> = {}
      for (const [key] of k.docs) {
        const file = files[key]
        if (!file) throw new Error('Add every required photo.')
        if (file.size > 5 * 1024 * 1024) throw new Error('Each photo must be under 5 MB.')
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
        const path = `${me.id}/${kind}-${key}-${Date.now()}.${ext}`
        const up = await sb.storage.from('kyc').upload(path, file, { contentType: file.type })
        if (up.error) throw new Error(up.error.message)
        docs[key] = path
      }
      const { error } = await sb.rpc('submit_application', { p_kind: kind, p_data: { ...f, barangay_id: f.barangay_id ?? '' }, p_docs: docs })
      if (error) throw new Error(error.message)
      setFiles({}); await load()
    } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  const field = (key: string, label: string) => (
    <label className="block" key={key}><span className="text-sm font-bold">{label}</span>
      <input className="field mt-1" value={f[key] ?? ''} onChange={e => setF({ ...f, [key]: e.target.value })} /></label>
  )
  if (loading) return <main className="p-6">…</main>
  if (!me) return <main className="p-6 font-bold"><Link href="/login" className="underline">Create an account or sign in</Link> to register.</main>
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <h1 className="font-display text-3xl font-extrabold text-sea">Get verified</h1>
      <div className="grid grid-cols-3 gap-2" role="tablist">
        {(Object.keys(KINDS) as Kind[]).map(x => (
          <button key={x} role="tab" aria-selected={kind === x} onClick={() => setKind(x)}
            className={`rounded-lg border-2 px-2 py-2 text-sm font-bold ${kind === x ? 'border-sea bg-sea text-white' : 'border-ink/15 bg-white'}`}>{KINDS[x].label}</button>
        ))}
      </div>
      <p className="text-ink/70">{k.hint} An admin checks your documents before approving you.</p>
      {cur && cur.status !== 'rejected' ? (
        <p className="rounded-lg bg-sun/30 p-3 font-bold">{cur.status === 'approved' ? 'You are approved for this role.' : 'Your application is under review.'}</p>
      ) : (
        <div className="space-y-3">
          {cur?.status === 'rejected' && <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-800">Rejected: {cur.reason}. Fix this and submit again.</p>}
          {field('full_name', 'Full name')}{field('phone', 'Mobile number (09XXXXXXXXX)')}{field('address', 'Home address')}
          <label className="block"><span className="text-sm font-bold">Barangay</span>
            <select className="field mt-1" value={f.barangay_id ?? ''} onChange={e => setF({ ...f, barangay_id: e.target.value })}>
              <option value="">Choose barangay</option>{bs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          {k.extra.map(([key, label]) => field(key, label))}
          {kind === 'business' && (
            <label className="block"><span className="text-sm font-bold">Type of business</span>
              <select className="field mt-1" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{CATS.map(c => <option key={c}>{c}</option>)}</select></label>
          )}
          {k.docs.map(([key, label]) => (
            <label key={key} className="block rounded-lg border-2 border-dashed border-ink/20 bg-white p-3">
              <span className="block text-sm font-bold">{label}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" capture={key === 'selfie' ? 'user' : undefined} className="mt-2 block w-full text-sm"
                onChange={e => { const file = e.target.files?.[0]; if (file) setFiles({ ...files, [key]: file }) }} />
              {files[key] && <span className="text-sm text-reef">{files[key].name}</span>}
            </label>
          ))}
          {msg && <p role="alert" className="font-bold text-red-700">{msg}</p>}
          <button className="btn w-full" disabled={busy} onClick={submit}>{busy ? 'Uploading…' : 'Submit for approval'}</button>
        </div>
      )}
    </main>
  )
}
