'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sb } from '@/lib/supabase'
export default function Login() {
  const router = useRouter()
  const [signup, setSignup] = useState(false)
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true); setMsg('')
    const { data, error } = signup ? await sb.auth.signUp({ email, password: pw }) : await sb.auth.signInWithPassword({ email, password: pw })
    setBusy(false)
    if (error) return setMsg(error.message)
    if (!data.session) return setMsg('Check your email to confirm your account, then sign in.')
    router.push(signup ? '/register' : '/profile')
  }
  return (
    <main className="mx-auto max-w-sm space-y-3 px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold text-sea">{signup ? 'Create your account' : 'Sign in'}</h1>
      <input className="field" type="email" autoComplete="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="field" type="password" autoComplete={signup ? 'new-password' : 'current-password'} placeholder="Password (8+ characters)" value={pw} onChange={e => setPw(e.target.value)} />
      {msg && <p role="alert" className="font-bold text-red-700">{msg}</p>}
      <button className="btn w-full" disabled={busy || !email || pw.length < 8} onClick={go}>{signup ? 'Create account' : 'Sign in'}</button>
      <button className="w-full text-sm font-bold underline" onClick={() => setSignup(!signup)}>{signup ? 'I already have an account' : 'New here? Create an account'}</button>
    </main>
  )
}
