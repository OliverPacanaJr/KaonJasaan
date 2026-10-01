import { notFound } from 'next/navigation'
import { sb } from '@/lib/supabase'
import Menu from '@/components/Menu'
export const revalidate = 30
export default async function EateryPage({ params }: { params: { slug: string } }) {
  const { data: e } = await sb.from('eateries').select('id,slug,name,description,is_open,barangay_id,category,pay_methods,pay_details').eq('slug', params.slug).maybeSingle()
  if (!e) notFound()
  const [m, b] = await Promise.all([
    sb.from('menu_items').select('id,name,price,is_available').eq('eatery_id', e.id).order('name'),
    sb.from('barangays').select('id,name,zone').order('name'),
  ])
  return <Menu eatery={e} menu={m.data ?? []} barangays={b.data ?? []} />
}
