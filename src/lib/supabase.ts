import { createClient } from '@supabase/supabase-js'
export const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export type Barangay = { id: number; name: string; zone?: number }
export type Eatery = { id: string; slug: string; name: string; description: string | null; is_open: boolean; barangay_id: number; category: string; pay_methods?: string[]; pay_details?: Record<string, string> }
export type MenuItem = { id: string; name: string; price: number; is_available: boolean }
export const peso = (n: number) => '₱' + Number(n).toLocaleString('en-PH')
// Display-only mirror of delivery_fee() in SQL. The database is the source of truth.
export const feeFor = (a: number, b: number, bs: Barangay[]) =>
  a === b ? 20 : bs.find(x => x.id === a)?.zone === bs.find(x => x.id === b)?.zone ? 40 : 60
