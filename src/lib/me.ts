'use client'
import { useCallback, useEffect, useState } from 'react'
import { sb } from './supabase'
export type Me = { id: string; email: string; role: string; verified: boolean; full_name: string | null; phone: string | null; address: string | null; barangay_id: number | null; avatar_path: string | null }
export function useMe() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    const { data: { session } } = await sb.auth.getSession()
    let next: Me | null = null
    if (session) {
      const { data } = await sb.from('profiles').select('role,verified,full_name,phone,address,barangay_id,avatar_path').eq('id', session.user.id).maybeSingle()
      next = { id: session.user.id, email: session.user.email ?? '', role: 'customer', verified: false, full_name: null, phone: null, address: null, barangay_id: null, avatar_path: null, ...(data ?? {}) }
    }
    setMe(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)) // stable identity: tab refocus must not reset forms
    setLoading(false)
  }, [])
  useEffect(() => {
    reload()
    const { data } = sb.auth.onAuthStateChange(() => { setTimeout(reload, 0) })
    return () => data.subscription.unsubscribe()
  }, [reload])
  return { me, loading, reload }
}
