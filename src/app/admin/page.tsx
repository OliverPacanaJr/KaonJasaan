'use client'
import { useCallback, useEffect, useState } from 'react'
import { sb } from '@/lib/supabase'
import { useMe } from '@/lib/me'
type A = { id: string; kind: string; data: Record<string, string>; docs: Record<string, string>; profiles: { full_name: string | null; phone: string | null } | null }
export default function Admin() {
  const { me, loading } = useMe()
  const [list, setList] = useState<A[]>([]); const [urls, setUrls] = useState<Record<string, string>>({}); const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data } = await sb.from('applications').select('id,kind,data,docs,profiles(full_name,phone)').eq('status', 'pending').order('created_at')
    const rows = (data ?? []) as unknown as A[]
    setList(rows)
    const paths = rows.flatMap(r => Object.values(r.docs))
    if (paths.length) { const { data: s } = await sb.storage.from('kyc').createSignedUrls(paths, 900); setUrls(Object.fromEntries((s ?? []).map(x => [x.path ?? '', x.signedUrl ?? '']))) }
  }, [])
  useEffect(() => { if (me?.role === 'admin') load() }, [me, load])
  async function review(id: string, approve: boolean) {
    const reason = approve ? null : window.prompt('Why is this rejected? The applicant will see this.')
    if (!approve && !reason) return
    const { error } = await sb.rpc('review_application', { p_id: id, p_approve: approve, p_reason: reason })
    if (error) setErr(error.message); else { setErr(''); load() }
  }
  if (loading) return <main className="p-6">…</main>
  if (me?.role !== 'admin') return <main className="p-6 font-bold">Admins only.</main>
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <h1 className="font-display text-3xl font-extrabold text-sea">Pending applications</h1>
      {err && <p role="alert" className="font-bold text-red-700">{err}</p>}
      {list.length === 0 && <p className="text-ink/70">Nothing waiting for review.</p>}
      {list.map(a => (
        <section key={a.id} className="space-y-2 rounded-lg border-2 border-ink/10 bg-white p-4">
          <h2 className="font-display text-xl font-bold">{a.kind}: {a.data.name || a.data.full_name}</h2>
          <p className="text-sm text-ink/70">{a.data.full_name}, {a.data.phone}, {a.data.address}{a.data.plate ? `, plate ${a.data.plate}` : ''}{a.data.category ? `, ${a.data.category}` : ''}</p>
          <div className="flex flex-wrap gap-3">{Object.entries(a.docs).map(([k, path]) => (
            <a key={k} href={urls[path]} target="_blank" rel="noreferrer" className="text-center text-xs font-bold"><img src={urls[path]} alt={k} className="h-28 w-28 rounded-lg object-cover" />{k}</a>))}</div>
          <div className="flex gap-2"><button className="btn flex-1" onClick={() => review(a.id, true)}>Approve</button>
            <button className="rounded-lg border-2 border-ink/20 px-4 font-bold" onClick={() => review(a.id, false)}>Reject</button></div>
        </section>
      ))}
    </main>
  )
}
