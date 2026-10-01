import { sb } from '@/lib/supabase'
import Browse from '@/components/Browse'
export const revalidate = 30
export default async function Home() {
  const [b, e] = await Promise.all([
    sb.from('barangays').select('id,name').order('name'),
    sb.from('eateries').select('id,slug,name,description,is_open,barangay_id,category').order('name'),
  ])
  return <Browse barangays={b.data ?? []} eateries={e.data ?? []} />
}
