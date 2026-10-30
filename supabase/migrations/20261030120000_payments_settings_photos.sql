-- Payments, the business's own settings, staff photos, and signing somebody
-- else out.
--
-- Each of these was drawn in the admin dashboard design and shown disabled,
-- because there was nowhere to keep it:
--
--   Payments        money received against an order -- a down payment when it
--                   is written, the rest at the counter or on the doorstep --
--                   so an order can say what is paid and what is still owed.
--   Settings        the business's name, TIN, phone, address, delivery fee and
--                   hours: one row, changed by an administrator.
--   Staff photos    a person's own photo, beside their name.
--   Sign out        an administrator ending every session of another account
--                   (a lost phone, a shared computer, somebody leaving).
--
-- Additive: four tables and their functions. Nothing existing is rewritten.
-- Safe to re-run. Apply before deploying the matching client.
-- Mirrored at the end of schema.sql (schemaInstall.test.js checks the copy).

-- ============================================================
-- Payments
-- ============================================================
-- One row per amount received for one order. A payment that covers two orders
-- is two rows with the same request_id, so each order's balance is a plain sum.
--
-- WHAT IS OWED. total_amount less refunded_amount less the payments. A refund
-- lowers what the order is worth, so once something has been given back the
-- customer owes that much less; a balance below zero is shown as nothing owed.
--
-- WHO. Sales take money at the counter and drivers on the doorstep, so both may
-- record a payment. Removing one -- a mistyped amount -- is a manager's.
create table if not exists public.order_payments (
  id bigint primary key default nextval('private.record_id_seq'),
  order_id bigint not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0 and amount <= 1000000000),
  method text not null check (method in ('cash', 'gcash', 'bank', 'check')),
  reference text check (reference is null or char_length(reference) between 1 and 80),
  received_on date not null,
  note text check (note is null or char_length(note) <= 200),
  request_id uuid,
  recorded_by text,
  created_at timestamptz not null default now()
);
create index if not exists order_payments_order_idx on public.order_payments (order_id);
create unique index if not exists order_payments_request_idx
  on public.order_payments (request_id, order_id) where request_id is not null;

alter table public.order_payments enable row level security;
revoke all on public.order_payments from public, anon, authenticated;
grant select on public.order_payments to authenticated;
drop policy if exists "Active staff read payments" on public.order_payments;
create policy "Active staff read payments" on public.order_payments for select
  to authenticated using ((select private.is_active_staff()));

-- What each order has been paid, for the lists. security_invoker: the payments
-- policy above still applies.
create or replace view public.order_paid with (security_invoker = true) as
select p.order_id,
  sum(p.amount) as paid_amount,
  count(*) as payment_count,
  max(p.received_on) as last_paid_on
from public.order_payments p
group by p.order_id;
revoke all on public.order_paid from public, anon;
grant select on public.order_paid to authenticated;

-- Records one payment against one or more orders. With several, the amount
-- settles them oldest first and the last takes whatever is left; it cannot be
-- more than they owe together. `p_request_id` makes a retry after a lost
-- response return the first answer instead of recording the money twice.
create or replace function public.record_payment(
  p_order_ids bigint[],
  p_amount numeric,
  p_method text,
  p_reference text,
  p_received_on date,
  p_note text,
  p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  who text := private.caller_role();
  actor text;
  remaining numeric;
  owed numeric;
  total_owed numeric := 0;
  share numeric;
  ord record;
  rows jsonb := '[]'::jsonb;
  saved public.order_payments;
  ref text := nullif(btrim(coalesce(p_reference, '')), '');
  memo text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if who is null or who not in ('Admin', 'Manager', 'Sales Staff', 'Delivery Staff') then
    raise exception 'Only sales, delivery staff or a manager can record a payment.';
  end if;
  if p_request_id is not null and exists (select 1 from public.order_payments where request_id = p_request_id) then
    return jsonb_build_object('payments', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb)
      from public.order_payments x where x.request_id = p_request_id), 'replayed', true);
  end if;
  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    raise exception 'Choose the order this payment is for.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Put in the amount received.';
  end if;
  if p_amount <> round(p_amount, 2) then
    raise exception 'Use at most two decimal places for the amount.';
  end if;
  if p_method is null or p_method not in ('cash', 'gcash', 'bank', 'check') then
    raise exception 'Choose how it was paid.';
  end if;
  if p_method <> 'cash' and ref is null then
    raise exception 'Put in the reference number from the receipt.';
  end if;
  if ref is not null and char_length(ref) > 80 then
    raise exception 'Keep the reference to 80 characters.';
  end if;
  if memo is not null and char_length(memo) > 200 then
    raise exception 'Keep the note to 200 characters.';
  end if;
  if p_received_on is null or p_received_on > private.shop_today() then
    raise exception 'The payment cannot be dated after today.';
  end if;

  -- Locked oldest first, the order they are settled in, so two people paying
  -- the same orders at once queue rather than both spending one balance.
  for ord in
    select o.id, o.status, o.total_amount, o.refunded_amount
    from public.orders o where o.id = any(p_order_ids) order by o.created_at, o.id for update
  loop
    if ord.status = 'Cancelled' then
      raise exception 'Order #% was cancelled, so nothing is owed on it.', ord.id;
    end if;
    total_owed := total_owed + greatest(0, ord.total_amount - ord.refunded_amount
      - coalesce((select sum(amount) from public.order_payments where order_id = ord.id), 0));
  end loop;
  if (select count(*) from public.orders where id = any(p_order_ids))
     <> (select count(distinct x) from unnest(p_order_ids) x) then
    raise exception 'One of those orders no longer exists.';
  end if;
  if total_owed <= 0 then
    raise exception 'Nothing is owed on that. It is already paid.';
  end if;
  if p_amount > total_owed then
    raise exception 'That is more than is owed (₱%). Put in at most that much.', to_char(total_owed, 'FM999,999,999,990.00');
  end if;

  select s.name into actor from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') limit 1;
  remaining := p_amount;
  for ord in
    select o.id, o.total_amount, o.refunded_amount from public.orders o
    where o.id = any(p_order_ids) order by o.created_at, o.id
  loop
    exit when remaining <= 0;
    owed := greatest(0, ord.total_amount - ord.refunded_amount
      - coalesce((select sum(amount) from public.order_payments where order_id = ord.id), 0));
    continue when owed <= 0;
    share := least(owed, remaining);
    insert into public.order_payments (order_id, amount, method, reference, received_on, note, request_id, recorded_by)
      values (ord.id, share, p_method, ref, p_received_on, memo, p_request_id, actor)
      returning * into saved;
    rows := rows || to_jsonb(saved);
    remaining := remaining - share;
    insert into public.activity_log (id, type, staff_name, description, subject, at)
      values (nextval('private.workshop_id_seq'), 'order', coalesce(actor, 'System'),
        format('₱%s received for order #%s (%s)', to_char(share, 'FM999,999,999,990.00'), ord.id,
          case p_method when 'cash' then 'cash' when 'gcash' then 'GCash'
            when 'bank' then 'bank transfer' else 'check' end),
        format('Order #%s', ord.id), now());
  end loop;
  return jsonb_build_object('payments', rows, 'replayed', false);
end;
$fn$;
revoke all on function public.record_payment(bigint[], numeric, text, text, date, text, uuid) from public, anon;
grant execute on function public.record_payment(bigint[], numeric, text, text, date, text, uuid) to authenticated;

-- Removes a payment entered by mistake. Kept in the activity log.
create or replace function public.remove_payment(p_payment_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  who text := private.caller_role();
  actor text;
  gone public.order_payments;
begin
  if who is null or who not in ('Admin', 'Manager') then
    raise exception 'Only a manager or administrator can remove a payment.';
  end if;
  delete from public.order_payments where id = p_payment_id returning * into gone;
  if not found then raise exception 'That payment is no longer on record.'; end if;
  select s.name into actor from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') limit 1;
  insert into public.activity_log (id, type, staff_name, description, subject, at)
    values (nextval('private.workshop_id_seq'), 'order', coalesce(actor, 'System'),
      format('Payment of ₱%s removed from order #%s', to_char(gone.amount, 'FM999,999,999,990.00'), gone.order_id),
      format('Order #%s', gone.order_id), now());
  return jsonb_build_object('removed', gone.id, 'order_id', gone.order_id);
end;
$fn$;
revoke all on function public.remove_payment(bigint) from public, anon;
grant execute on function public.remove_payment(bigint) to authenticated;

-- ============================================================
-- Business settings: one row
-- ============================================================
-- Read by everyone signed in (the order slip prints the phone and address);
-- changed only by an administrator. Each change bumps the revision, so a save
-- made from an older copy of the screen is refused rather than undoing
-- somebody else's.
create table if not exists public.business_settings (
  id smallint primary key default 1 check (id = 1),
  business_name text not null default 'LSB Handicrafts' check (char_length(btrim(business_name)) between 1 and 120),
  tin text check (tin is null or tin ~ '^[0-9]{3}-?[0-9]{3}-?[0-9]{3}(-?[0-9]{3,5})?$'),
  phone text check (phone is null or char_length(phone) between 7 and 40),
  email text check (email is null or email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  address text check (address is null or char_length(address) <= 300),
  vat_registered boolean not null default false,
  delivery_fee numeric(12,2) check (delivery_fee is null or (delivery_fee >= 0 and delivery_fee <= 1000000)),
  free_delivery_from numeric(12,2) check (free_delivery_from is null or (free_delivery_from > 0 and free_delivery_from <= 1000000000)),
  delivery_areas text[] not null default '{}' check (cardinality(delivery_areas) <= 50),
  open_days text[] not null default '{Mon,Tue,Wed,Thu,Fri,Sat}'
    check (open_days <@ array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']),
  opens_at time,
  closes_at time,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text,
  check (opens_at is null or closes_at is null or opens_at < closes_at)
);
insert into public.business_settings (id) values (1) on conflict (id) do nothing;

create or replace function private.stamp_business_settings()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  new.id := 1;
  new.revision := old.revision + 1;
  new.updated_at := now();
  new.updated_by := coalesce((select s.name from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') limit 1), 'System');
  new.business_name := btrim(new.business_name);
  new.delivery_areas := array(select distinct btrim(a) from unnest(new.delivery_areas) a where btrim(a) <> '' order by 1);
  return new;
end;
$fn$;
revoke all on function private.stamp_business_settings() from public, anon, authenticated;
drop trigger if exists business_settings_stamp on public.business_settings;
create trigger business_settings_stamp before update on public.business_settings
  for each row execute function private.stamp_business_settings();

alter table public.business_settings enable row level security;
revoke all on public.business_settings from public, anon, authenticated;
grant select, update on public.business_settings to authenticated;
drop policy if exists "Active staff read the business settings" on public.business_settings;
create policy "Active staff read the business settings" on public.business_settings for select
  to authenticated using ((select private.is_active_staff()));
drop policy if exists "Administrators change the business settings" on public.business_settings;
create policy "Administrators change the business settings" on public.business_settings for update
  to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- ============================================================
-- Staff photos
-- ============================================================
-- One per person, a data URL the browser has already cut to a small square,
-- the way product photos are kept. Everybody signed in can see them -- they sit
-- beside names -- and each person changes only their own.
create table if not exists public.staff_photos (
  staff_id bigint primary key references public.staff(id) on delete cascade,
  data_url text not null check (
    data_url ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'
    and char_length(data_url) <= 400000),
  updated_at timestamptz not null default now()
);
alter table public.staff_photos enable row level security;
revoke all on public.staff_photos from public, anon, authenticated;
grant select on public.staff_photos to authenticated;
drop policy if exists "Active staff see staff photos" on public.staff_photos;
create policy "Active staff see staff photos" on public.staff_photos for select
  to authenticated using ((select private.is_active_staff()));

-- Sets, replaces or (with null) removes the CALLER's own photo. There is no
-- staff id to pass, so nobody can change anybody else's.
create or replace function public.save_own_photo(p_data_url text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  me bigint;
begin
  select s.id into me from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active' limit 1;
  if me is null then raise exception 'Please sign in again.'; end if;
  if p_data_url is null then
    delete from public.staff_photos where staff_id = me;
    return jsonb_build_object('staff_id', me, 'removed', true);
  end if;
  if p_data_url !~ '^data:image/(jpeg|png|webp);base64,' then
    raise exception 'Choose a JPEG, PNG or WebP photo.';
  end if;
  if char_length(p_data_url) > 400000 then
    raise exception 'That photo is too large. Choose a smaller one.';
  end if;
  insert into public.staff_photos (staff_id, data_url, updated_at) values (me, p_data_url, now())
  on conflict (staff_id) do update set data_url = excluded.data_url, updated_at = excluded.updated_at;
  return jsonb_build_object('staff_id', me, 'removed', false);
end;
$fn$;
revoke all on function public.save_own_photo(text) from public, anon;
grant execute on function public.save_own_photo(text) to authenticated;

-- ============================================================
-- Signing somebody else out
-- ============================================================
-- Ends every session of another staff member's login. A sign-out IS the
-- removal of the session rows (Supabase's own sign-out does the same); their
-- refresh tokens go with them, so no device can renew its access. A token
-- already issued still works until it expires -- an hour at most -- which is
-- why blocking the account, not this, is the answer to somebody who must not
-- get back in at all.
--
-- Administrators only, never their own account (My profile signs out the
-- others), and never the owner account unless the caller is the owner.
create or replace function public.sign_out_staff(p_staff_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  target public.staff;
  me public.staff;
  login uuid;
  ended integer := 0;
begin
  select * into me from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active' limit 1;
  if me.id is null or me.role <> 'Admin' then
    raise exception 'Only an administrator can sign somebody else out.';
  end if;
  select * into target from public.staff where id = p_staff_id;
  if target.id is null then raise exception 'That account no longer exists.'; end if;
  if target.id = me.id then
    raise exception 'Use "Sign out everywhere else" on your own profile.';
  end if;
  if target.is_super_admin and not me.is_super_admin then
    raise exception 'Only the owner can sign the owner out.';
  end if;
  if target.email is null then
    return jsonb_build_object('ended', 0);
  end if;
  select u.id into login from auth.users u where lower(u.email) = lower(target.email) limit 1;
  if login is null then
    return jsonb_build_object('ended', 0);
  end if;
  begin
    delete from auth.sessions where user_id = login;
    get diagnostics ended = row_count;
  exception when insufficient_privilege or undefined_table then
    raise exception 'This project does not let the app end sessions. Block the account instead, or sign them out from Authentication → Users.';
  end;
  insert into public.activity_log (id, type, staff_name, description, subject, at)
    values (nextval('private.workshop_id_seq'), 'account', me.name,
      format('%s was signed out everywhere', target.name), target.name, now());
  return jsonb_build_object('ended', ended);
end;
$fn$;
revoke all on function public.sign_out_staff(bigint) from public, anon;
grant execute on function public.sign_out_staff(bigint) to authenticated;
