-- 002: document verification, profiles, per-shop payment modes, rider flow. Run after 001.
create type app_kind as enum ('customer','business','rider');
create type kyc_status as enum ('pending','approved','rejected');

alter table profiles add column verified boolean not null default false, add column avatar_path text, add column address text, add column barangay_id smallint references barangays(id);
alter table eateries add column category text not null default 'Carinderia', add column pay_methods text[] not null default '{cod}', add column pay_details jsonb not null default '{}',
  add constraint pay_methods_ok check (pay_methods <@ array['cod','gcash','maya','bank'] and cardinality(pay_methods) >= 1);
drop policy edit_eatery on eateries; -- owners must not touch approval or commission; they use update_shop()

drop function place_order(uuid, text, text, text, smallint, pay_method, text, jsonb);
drop function track_order(text);
alter table orders alter column pay type text using pay::text, add column customer_id uuid references profiles(id);
alter table orders add constraint pay_ok check (pay in ('cod','gcash','maya','bank'));
drop type pay_method;

create table applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
  kind app_kind not null, status kyc_status not null default 'pending', data jsonb not null default '{}', docs jsonb not null default '{}',
  reason text, created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid, unique (user_id, kind));
alter table applications enable row level security;
create policy own_or_admin_apps on applications for select using (user_id = auth.uid() or is_admin());
create policy own_orders on orders for select using (customer_id = auth.uid());
create policy pool_orders on orders for select using (status = 'ready' and rider_id is null and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'rider'));

-- Private bucket for ID photos. Users write/read their own folder; admins read everything.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('kyc', 'kyc', false, 5242880, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy kyc_insert on storage.objects for insert to authenticated with check (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);
create policy kyc_read on storage.objects for select to authenticated using (bucket_id = 'kyc' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create function update_profile(p_name text, p_phone text, p_address text, p_barangay smallint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if p_phone !~ '^(09|\+639)\d{9}$' then raise exception 'Mobile number must look like 09XXXXXXXXX.'; end if;
  update profiles set full_name = left(trim(p_name), 80), phone = p_phone, address = left(trim(p_address), 200), barangay_id = p_barangay where id = auth.uid();
end $$;

create function submit_application(p_kind app_kind, p_data jsonb, p_docs jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare need text[]; k text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  need := case p_kind when 'customer' then array['selfie','id','residency'] when 'rider' then array['selfie','license','motorcycle'] else array['storefront','permit'] end;
  foreach k in array need loop
    if coalesce(p_docs->>k, '') not like auth.uid()::text || '/%' then raise exception 'Missing document: %.', k; end if;
  end loop;
  if length(trim(coalesce(p_data->>'full_name', ''))) < 2 or coalesce(p_data->>'phone', '') !~ '^(09|\+639)\d{9}$'
     or length(trim(coalesce(p_data->>'address', ''))) < 5 or coalesce(p_data->>'barangay_id', '') !~ '^\d+$' then
    raise exception 'Fill in your full name, mobile number (09XXXXXXXXX), address and barangay.'; end if;
  if p_kind = 'business' and length(trim(coalesce(p_data->>'name', ''))) < 2 then raise exception 'Enter your shop name.'; end if;
  if p_kind = 'rider' and length(trim(coalesce(p_data->>'plate', ''))) < 3 then raise exception 'Enter your plate number.'; end if;
  update profiles set full_name = trim(p_data->>'full_name'), phone = p_data->>'phone', address = trim(p_data->>'address'),
    barangay_id = (p_data->>'barangay_id')::smallint, avatar_path = coalesce(p_docs->>'selfie', avatar_path) where id = auth.uid();
  insert into applications(user_id, kind, data, docs) values (auth.uid(), p_kind, p_data, p_docs)
  on conflict (user_id, kind) do update set data = excluded.data, docs = excluded.docs, status = 'pending', reason = null, reviewed_at = null
    where applications.status <> 'approved';
end $$;

create function review_application(p_id uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a applications;
begin
  if not is_admin() then raise exception 'Admins only.'; end if;
  select * into a from applications where id = p_id for update;
  if not found then raise exception 'Application not found.'; end if;
  update applications set status = case when p_approve then 'approved'::kyc_status else 'rejected'::kyc_status end,
    reason = p_reason, reviewed_at = now(), reviewed_by = auth.uid() where id = p_id;
  if not p_approve then return; end if;
  if a.kind = 'customer' then update profiles set verified = true where id = a.user_id;
  elsif a.kind = 'rider' then update profiles set role = 'rider', verified = true where id = a.user_id and role = 'customer';
  else
    update profiles set role = 'eatery', verified = true where id = a.user_id and role = 'customer';
    if not exists (select 1 from eateries where owner_id = a.user_id) then
      insert into eateries(owner_id, slug, name, description, barangay_id, phone, category, is_approved)
      values (a.user_id, trim(both '-' from lower(regexp_replace(a.data->>'name', '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || substr(md5(a.id::text), 1, 4),
        trim(a.data->>'name'), a.data->>'description', (a.data->>'barangay_id')::smallint, a.data->>'phone', coalesce(a.data->>'category', 'Other'), true);
    end if;
  end if;
end $$;

-- Shops choose which payment modes they accept. The delivery fee is never part of this: it is always cash to the rider.
create function update_shop(p_id uuid, p_is_open boolean, p_pay text[], p_details jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or exists (select 1 from eateries where id = p_id and owner_id = auth.uid())) then raise exception 'Not allowed.'; end if;
  if length(coalesce(p_details, '{}')::text) > 1000 then raise exception 'Payment details too long.'; end if;
  update eateries set is_open = p_is_open, pay_methods = p_pay, pay_details = coalesce(p_details, '{}') where id = p_id;
end $$;

create function claim_order(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'rider') then raise exception 'Riders only.'; end if;
  update orders set rider_id = auth.uid() where id = p_id and status = 'ready' and rider_id is null;
  if not found then raise exception 'Another rider already took this order.'; end if;
end $$;

create or replace function set_order_status(p_id uuid, p_status order_status) returns void
language plpgsql security definer set search_path = public as $$
declare o orders; by_shop boolean; by_rider boolean;
begin
  select * into o from orders where id = p_id for update;
  if not found then raise exception 'Order not found.'; end if;
  by_shop := is_admin() or exists (select 1 from eateries where id = o.eatery_id and owner_id = auth.uid());
  by_rider := coalesce(o.rider_id = auth.uid(), false) and p_status in ('out_for_delivery', 'delivered');
  if not (by_shop or by_rider) then raise exception 'Not allowed.'; end if;
  if not ((o.status::text || '>' || p_status::text) = any (array['pending>accepted','pending>cancelled','accepted>preparing','accepted>cancelled','preparing>ready','ready>out_for_delivery','out_for_delivery>delivered'])) then
    raise exception 'Cannot move order from % to %.', o.status, p_status; end if;
  if p_status = 'out_for_delivery' and o.rider_id is null then raise exception 'Waiting for a rider to claim this order.'; end if;
  update orders set status = p_status where id = p_id;
end $$;

create function place_order(p_eatery uuid, p_name text, p_phone text, p_address text, p_barangay smallint, p_pay text, p_note text, p_items jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare e eateries; o_id uuid; v_code text; sub numeric := 0; fee numeric; r record;
begin
  if not exists (select 1 from profiles where id = auth.uid() and verified) then raise exception 'Verify your account before ordering.'; end if;
  select * into e from eateries where id = p_eatery and is_approved and is_open;
  if not found then raise exception 'This shop is closed right now.'; end if;
  if not (p_pay = any (e.pay_methods)) then raise exception 'This shop does not accept that payment method.'; end if;
  if length(trim(p_name)) < 2 or p_phone !~ '^(09|\+639)\d{9}$' or length(trim(p_address)) < 5 then
    raise exception 'Check your name, mobile number (09XXXXXXXXX) and address.'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid cart.'; end if;
  if jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid cart.'; end if;
  if (select count(*) from orders where customer_id = auth.uid() and status = 'pending') >= 5 then raise exception 'Too many open orders.'; end if;
  fee := delivery_fee(e.barangay_id, p_barangay);
  insert into orders(eatery_id, customer_id, customer_name, customer_phone, address, barangay_id, pay, note, subtotal, delivery_fee)
    values (p_eatery, auth.uid(), trim(p_name), p_phone, trim(p_address), p_barangay, p_pay, left(p_note, 200), 0, fee)
    returning id, code into o_id, v_code;
  for r in
    select m.id, m.name, m.price, least(20, sum(greatest(1, (i->>'qty')::int)))::int as qty
    from jsonb_array_elements(p_items) i
    join menu_items m on m.id = (i->>'id')::uuid and m.eatery_id = p_eatery and m.is_available
    group by m.id, m.name, m.price
  loop
    insert into order_items(order_id, item_id, name, price, qty) values (o_id, r.id, r.name, r.price, r.qty);
    sub := sub + r.price * r.qty;
  end loop;
  if sub = 0 then raise exception 'Those items are sold out.'; end if;
  update orders set subtotal = sub where id = o_id;
  return v_code;
end $$;

create function track_order(p_code text)
returns table (code text, status order_status, eatery text, subtotal numeric, delivery_fee numeric, pay text, items jsonb)
language sql stable security definer set search_path = public as $$
  select o.code, o.status, e.name, o.subtotal, o.delivery_fee, o.pay,
    (select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'price', i.price)) from order_items i where i.order_id = o.id)
  from orders o join eateries e on e.id = o.eatery_id where o.code = upper(p_code) $$;
