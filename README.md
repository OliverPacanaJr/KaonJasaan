# HatodJasaan
Local delivery for any Jasaan business (carinderia, lechon manok, bakery, grocery, pharmacy...). Next.js 14 + Supabase + Tailwind, deploys to Vercel.

## Setup
1. Create a Supabase project. In the SQL editor run `supabase/migrations/001_init.sql`, then `002_verification.sql` (it also creates the private `kyc` photo bucket).
2. `cp .env.example .env.local`, fill in the URL and anon key, then `npm install && npm run dev`.
3. Create your account at `/login`, then make yourself admin: `update profiles set role = 'admin' where id = '<your auth user id>';`
4. Verify the seeded barangay names and zones. They set delivery fees: 20 same barangay, 40 same zone, 60 otherwise.
5. Deploy: import the repo in Vercel and add the two env vars. In Supabase Auth, set the Site URL to your Vercel domain.

## Flows
- **Anyone** signs up at `/login`, then submits documents at `/register`: customer (selfie, ID, residency proof), shop (storefront photo, permit or clearance) or rider (selfie, license, motorcycle photo). The selfie becomes the profile photo.
- **Admin** reviews photos at `/admin`. Approving a customer enables ordering, a rider enables `/rider`, a shop creates its public listing. Rejections carry a reason the applicant sees.
- **Shops** edit accepted payment modes, open/closed state and menu in `/profile`, and handle orders at `/dashboard`.
- **Riders** claim ready orders, mark pickup and delivery, and see delivery fees earned.
- The delivery fee is always cash to the rider. Shop payment modes apply only to the items.

## Security
- Document photos live in a private bucket: users read their own folder, admins read all, links are short-lived signed URLs.
- Orders, fees, availability, payment mode and verification are enforced in SQL functions. Clients cannot edit roles, approval, commission or order status directly.
