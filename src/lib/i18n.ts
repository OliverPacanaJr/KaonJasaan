'use client'
import { useSyncExternalStore } from 'react'
const D = {
  en: { tag: 'Everything from Jasaan shops, delivered by Jasaan neighbors.', all: 'All barangays', search: 'Search shops', open: 'Open', closed: 'Closed', from: 'Delivery from ₱20', cart: 'Your order', name: 'Your name', phone: 'Mobile (09XXXXXXXXX)', addr: 'Address or landmark', note: 'Note for the kitchen (optional)', cod: 'Cash on delivery', gcash: 'GCash', maya: 'Maya', bank: 'Bank transfer', place: 'Place order', empty: 'No shops here yet.', sub: 'Subtotal', fee: 'Delivery (cash to rider)', total: 'Total', sold: 'Sold out', s_pending: 'Waiting for the shop', s_accepted: 'Accepted', s_preparing: 'Being cooked', s_ready: 'Ready for pickup', s_out_for_delivery: 'On the way', s_delivered: 'Delivered', s_cancelled: 'Cancelled' },
  ceb: { tag: 'Tanang paninda sa Jasaan, gihatud sa silingan.', all: 'Tanang barangay', search: 'Pangita og tindahan', open: 'Abli', closed: 'Sirado', from: 'Hatud gikan ₱20', cart: 'Imong order', name: 'Imong ngalan', phone: 'Numero (09XXXXXXXXX)', addr: 'Address o timailhan', note: 'Mensahe sa kusina (kon gusto)', cod: 'Bayad inig abot', gcash: 'GCash', maya: 'Maya', bank: 'Bank transfer', place: 'I-order na', empty: 'Wala pay tindahan dinhi.', sub: 'Subtotal', fee: 'Hatud (cash sa rider)', total: 'Total', sold: 'Ubos na', s_pending: 'Naghulat sa tindahan', s_accepted: 'Gidawat na', s_preparing: 'Giluto pa', s_ready: 'Andam na', s_out_for_delivery: 'Padulong na', s_delivered: 'Naabot na', s_cancelled: 'Gikansela' },
} as const
export type K = keyof typeof D.en
const sub = (f: () => void) => { window.addEventListener('lang', f); return () => window.removeEventListener('lang', f) }
const snap = (): 'en' | 'ceb' => (localStorage.getItem('lang') === 'ceb' ? 'ceb' : 'en')
export function useT() {
  const l = useSyncExternalStore(sub, snap, (): 'en' | 'ceb' => 'en')
  return {
    l, t: (k: K) => D[l][k] as string,
    toggle: () => { localStorage.setItem('lang', l === 'en' ? 'ceb' : 'en'); window.dispatchEvent(new Event('lang')) },
  }
}
