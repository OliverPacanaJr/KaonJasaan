'use client'
import Link from 'next/link'
import { useMe } from '@/lib/me'
function L({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-bold underline-offset-4 hover:underline">{children}</Link>
}
export default function Nav() {
  const { me, loading } = useMe()
  if (loading) return null
  if (!me) return <L href="/login">Sign in</L>
  return (
    <>
      {me.role === 'admin' && <L href="/admin">Admin</L>}
      {me.role === 'rider' && <L href="/rider">Deliveries</L>}
      {me.role === 'eatery' && <L href="/dashboard">Shop orders</L>}
      <L href="/profile">Profile</L>
    </>
  )
}
