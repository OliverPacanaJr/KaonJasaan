-- KaonJasaan schema. Orders are written ONLY through place_order(); status changes ONLY through set_order_status().
create type order_status as enum ('pending','accepted','preparing','ready','out_for_delivery','delivered','cancelled');
create type pay_method as enum ('cod','gcash');
create type user_role as enum ('customer','eatery','rider','admin');

create table barangays (id smallint primary key generated always as identity, name text not null unique, zone smallint not null default 2);
create table profiles (id uuid primary key references auth.users on delete cascade, role user_role not null default 'customer', full_name text, phone text);
create table eateries (
  id uuid primary key default gen_random_uuid(), owner_id uuid references profiles(id),
  slug text not null unique, name text not null, description text,
  barangay_id smallint not null references barangays(id), phone text,
  is_approved boolean not null default false, is_open boolean not null default true,
  commission_pct numeric(4,2) not null default 5, created_at timestamptz not null default now());
create table menu_items (
  id uuid primary key default gen_random_uuid(), eatery_id uuid not null references eateries(id) on delete cascade,
  name text not null, price numeric(8,2) not null check (price > 0), is_available boolean not null default true);
create table orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text),1,8)),
  eatery_id uuid not null references eateries(id), rider_id uuid references profiles(id),
  customer_name text not null, customer_phone text not null, address text not null,
  barangay_id smallint not null references barangays(id), pay pay_method not null,
  status order_status not null default 'pending', subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null, platform_fee numeric(10,2) not null default 10,
  note text, created_at timestamptz not null default now());
create index on orders (eatery_id, status);
create index on orders (customer_phone, status);
create table order_items (
  order_id uuid not null references orders(id) on delete cascade, item_id uuid not null references menu_items(id),
  name text not null, price numeric(8,2) not null, qty int not null check (qty between 1 and 20), primary key (order_id, item_id));

create function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as
$$ begin insert into profiles(id) values (new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Fees (PHP): same barangay 20, same zone ("neighboring") 40, otherwise 60. Edit barangays.zone to tune.
create function delivery_fee(a smallint, b smallint) returns numeric language sql stable as
$$ select case when a = b then 20
  when (select zone from barangays where id = a) = (select zone from barangays where id = b) then 40 else 60 end $$;

alter table barangays enable row level security; alter table profiles enable row level security;
alter table eateries enable row level security; alter table menu_items enable row level security;
alter table orders enable row level security; alter table order_items enable row level security;

create policy read_barangays on barangays for select using (true);
create policy own_profile on profiles for select using (id = auth.uid() or is_admin());
create policy read_eateries on eateries for select using (is_approved or owner_id = auth.uid() or is_admin());
create policy edit_eatery on eateries for update using (owner_id = auth.uid() or is_admin());
create policy read_menu on menu_items for select using (exists (select 1 from eateries e where e.id = eatery_id and (e.is_approved or e.owner_id = auth.uid() or is_admin())));
create policy edit_menu on menu_items for all using (exists (select 1 from eateries e where e.id = eatery_id and (e.owner_id = auth.uid() or is_admin())));
create policy staff_orders on orders for select using (rider_id = auth.uid() or is_admin() or exists (select 1 from eateries e where e.id = eatery_id and e.owner_id = auth.uid()));
create policy staff_items on order_items for select using (exists (select 1 from orders o join eateries e on e.id = o.eatery_id where o.id = order_id and (e.owner_id = auth.uid() or o.rider_id = auth.uid() or is_admin())));

-- Guest checkout. Prices, fees and availability are computed server-side; the client is never trusted.
create function place_order(p_eatery uuid, p_name text, p_phone text, p_address text, p_barangay smallint, p_pay pay_method, p_note text, p_items jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare e eateries; o_id uuid; v_code text; sub numeric := 0; fee numeric; r record;
begin
  select * into e from eateries where id = p_eatery and is_approved and is_open;
  if not found then raise exception 'This eatery is closed right now.'; end if;
  if length(trim(p_name)) < 2 or p_phone !~ '^(09|\+639)\d{9}$' or length(trim(p_address)) < 5 then
    raise exception 'Check your name, mobile number (09XXXXXXXXX) and address.'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid cart.'; end if;
  if jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid cart.'; end if;
  if (select count(*) from orders where customer_phone = p_phone and status = 'pending') >= 5 then
    raise exception 'Too many open orders for this number.'; end if;
  fee := delivery_fee(e.barangay_id, p_barangay);
  insert into orders(eatery_id, customer_name, customer_phone, address, barangay_id, pay, note, subtotal, delivery_fee)
    values (p_eatery, trim(p_name), p_phone, trim(p_address), p_barangay, p_pay, left(p_note, 200), 0, fee)
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

-- Order state machine, enforced in the database.
create function set_order_status(p_id uuid, p_status order_status) returns void
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if not (is_admin() or exists (select 1 from eateries where id = o.eatery_id and owner_id = auth.uid())) then raise exception 'Not allowed.'; end if;
  if not ((o.status::text || '>' || p_status::text) = any (array['pending>accepted','pending>cancelled','accepted>preparing','accepted>cancelled','preparing>ready','ready>out_for_delivery','out_for_delivery>delivered'])) then
    raise exception 'Cannot move order from % to %.', o.status, p_status; end if;
  update orders set status = p_status where id = p_id;
end $$;

-- Public tracking by code only; exposes no phone or address.
create function track_order(p_code text)
returns table (code text, status order_status, eatery text, subtotal numeric, delivery_fee numeric, pay pay_method, items jsonb)
language sql stable security definer set search_path = public as $$
  select o.code, o.status, e.name, o.subtotal, o.delivery_fee, o.pay,
    (select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'price', i.price)) from order_items i where i.order_id = o.id)
  from orders o join eateries e on e.id = o.eatery_id where o.code = upper(p_code) $$;

-- Seed. VERIFY barangay names and zones against the official list before launch.
insert into barangays(name, zone) values ('Lower Jasaan',1),('Upper Jasaan',1),('Aplaya',2),('Bobontugan',2),('Corrales',2),('Danao',3),('Jampason',3),('Kimaya',3),('Luz Banzon',3),('Natubo',2),('San Antonio',3),('San Nicolas',2),('Solana',3),('Luna',3);
insert into eateries(slug, name, description, barangay_id, is_approved)
  select 'lola-nena', 'Lola Nena''s Carinderia', 'Home-cooked ulam and rice, all day.', id, true from barangays where name = 'Lower Jasaan';
insert into eateries(slug, name, description, barangay_id, is_approved)
  select 'aplaya-grill', 'Aplaya Grill House', 'Inihaw by the bay.', id, true from barangays where name = 'Aplaya';
insert into menu_items(eatery_id, name, price)
  select e.id, x.n, x.p from eateries e, (values ('Adobo + rice',65),('Tinola + rice',70),('Fried bangus + rice',75),('Iced tea',20)) x(n, p) where e.slug = 'lola-nena';
insert into menu_items(eatery_id, name, price)
  select e.id, x.n, x.p from eateries e, (values ('Chicken inasal + rice',95),('Grilled pusit',120),('Pork BBQ stick',25)) x(n, p) where e.slug = 'aplaya-grill';
