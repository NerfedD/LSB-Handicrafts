-- Notifications, in the app.
--
-- Each person chooses which events they hear about (Settings · Notifications);
-- what they may choose from follows their role, so nobody is told about
-- records their role cannot open. An alert is a row in `notifications` for
-- one person, shown under the bell in the top bar until they read it.
--
-- WHO RAISES THEM. Events that happen at a moment -- an order is taken or
-- called off, a shelf crosses its warning level, a batch reaches quality
-- check, a delivery arrives, an account is blocked -- are raised by triggers,
-- so no path that makes the change can forget. Events that happen by the
-- clock -- a delivery past its promised day, a payment past its due date --
-- are raised by refresh_alerts(), which the app calls while anyone is signed
-- in; there is no scheduler to keep running. Each alert carries a key, so the
-- same thing is never announced to the same person twice.
--
-- Email and text messages are drawn on the settings page but not sent: they
-- need an outside sending service, chosen later.
--
-- Additive: two tables and their functions and triggers. Safe to re-run.
-- Apply after 20261031120000_payment_terms.sql.
-- Mirrored at the end of schema.sql (schemaInstall.test.js checks the copy).

-- ============================================================
-- Which events each role can hear about
-- ============================================================
create or replace function private.notification_events_for(p_role text)
returns text[] language sql immutable set search_path = '' as $fn$
  select case p_role
    when 'Admin' then array['order_new','order_cancelled','payment_overdue','stock_low','material_low',
      'batch_qc','delivery_late','delivery_arrived','account_blocked']
    when 'Manager' then array['order_new','order_cancelled','payment_overdue','stock_low','material_low',
      'batch_qc','delivery_late','delivery_arrived']
    when 'Sales Staff' then array['order_new','order_cancelled','payment_overdue','stock_low',
      'delivery_late','delivery_arrived']
    when 'Production Staff' then array['order_new','order_cancelled','stock_low','material_low','batch_qc']
    when 'Delivery Staff' then array['delivery_late','delivery_arrived']
    else array[]::text[]
  end;
$fn$;
revoke all on function private.notification_events_for(text) from public, anon;
grant execute on function private.notification_events_for(text) to authenticated;

-- A person's choice. No row means every event their role can hear about.
create table if not exists public.notification_settings (
  staff_id bigint primary key references public.staff(id) on delete cascade,
  in_app text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from public, anon, authenticated;
grant select on public.notification_settings to authenticated;
drop policy if exists "Staff read their own notification settings" on public.notification_settings;
create policy "Staff read their own notification settings" on public.notification_settings for select
  to authenticated using (staff_id = (select s.id from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active' limit 1));

-- Saves the caller's own choice. Anything their role cannot hear about is dropped.
create or replace function public.save_notification_settings(p_in_app text[])
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  me public.staff;
  kept text[];
begin
  select * into me from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active' limit 1;
  if me.id is null then raise exception 'Please sign in again.'; end if;
  kept := array(select distinct e from unnest(coalesce(p_in_app, '{}'::text[])) e
    where e = any(private.notification_events_for(me.role)) order by 1);
  insert into public.notification_settings (staff_id, in_app, updated_at) values (me.id, kept, now())
  on conflict (staff_id) do update set in_app = excluded.in_app, updated_at = excluded.updated_at;
  return jsonb_build_object('in_app', kept);
end;
$fn$;
revoke all on function public.save_notification_settings(text[]) from public, anon;
grant execute on function public.save_notification_settings(text[]) to authenticated;

-- ============================================================
-- The alerts
-- ============================================================
create table if not exists public.notifications (
  id bigint primary key default nextval('private.record_id_seq'),
  staff_id bigint not null references public.staff(id) on delete cascade,
  event text not null,
  title text not null,
  body text,
  view text,
  record_id bigint,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (staff_id, dedupe_key)
);
create index if not exists notifications_staff_idx on public.notifications (staff_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
-- Marking read is the only change a person makes, and only to their own.
grant update (read_at) on public.notifications to authenticated;
drop policy if exists "Staff read their own notifications" on public.notifications;
create policy "Staff read their own notifications" on public.notifications for select
  to authenticated using (staff_id = (select s.id from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active' limit 1));
drop policy if exists "Staff mark their own notifications read" on public.notifications;
create policy "Staff mark their own notifications read" on public.notifications for update
  to authenticated
  using (staff_id = (select s.id from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active' limit 1))
  with check (staff_id = (select s.id from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active' limit 1));

-- Sends one alert to everyone who chose this event and whose role may see
-- it. The person whose action raised it is left out -- they know already --
-- unless p_include_actor (the clock-driven alerts have no actor).
create or replace function private.notify(
  p_event text, p_title text, p_body text, p_view text, p_record bigint, p_key text,
  p_include_actor boolean default false
) returns void language plpgsql security definer set search_path = '' as $fn$
declare
  actor bigint;
begin
  if not p_include_actor then
    select s.id into actor from public.staff s
      where lower(s.email) = lower((select auth.jwt()) ->> 'email') limit 1;
  end if;
  insert into public.notifications (staff_id, event, title, body, view, record_id, dedupe_key)
  select s.id, p_event, left(p_title, 200), left(p_body, 400), p_view, p_record, p_key
  from public.staff s
  left join public.notification_settings ns on ns.staff_id = s.id
  where s.status = 'Active'
    and p_event = any(private.notification_events_for(s.role))
    and p_event = any(coalesce(ns.in_app, private.notification_events_for(s.role)))
    and s.id is distinct from actor
  on conflict (staff_id, dedupe_key) do nothing;
end;
$fn$;
revoke all on function private.notify(text, text, text, text, bigint, text, boolean) from public, anon, authenticated;

-- ---- raised at the moment something happens ----

create or replace function private.notify_order_change()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if tg_op = 'INSERT' then
    perform private.notify('order_new', format('New order #%s for %s', new.id, new.customer_name),
      format('₱%s', to_char(new.total_amount, 'FM999,999,999,990.00')), 'order-detail', new.id,
      format('order_new:%s', new.id));
  elsif new.status = 'Cancelled' and old.status is distinct from 'Cancelled' then
    perform private.notify('order_cancelled', format('Order #%s for %s was cancelled', new.id, new.customer_name),
      'Stock it held goes back on the shelf.', 'order-detail', new.id, format('order_cancelled:%s', new.id));
  end if;
  return new;
end;
$fn$;
revoke all on function private.notify_order_change() from public, anon, authenticated;
drop trigger if exists orders_notify on public.orders;
create trigger orders_notify after insert or update of status on public.orders
  for each row execute function private.notify_order_change();

-- A shelf crossing its warning level, once per crossing: it is raised again
-- only after the stock has gone back above the level and fallen once more.
create or replace function private.notify_stock_low()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  product_id bigint;
begin
  if new.stock <= new.low_stock_threshold and old.stock > old.low_stock_threshold then
    select p.id into product_id from public.products p where lower(p.item_code) = lower(new.sku) limit 1;
    perform private.notify('stock_low', format('%s is running low', new.name),
      format('%s left; the warning level is %s.', new.stock, new.low_stock_threshold),
      case when product_id is null then 'products' else 'product-detail' end, product_id,
      format('stock_low:%s:%s', new.id, extract(epoch from clock_timestamp())::bigint));
  end if;
  return new;
end;
$fn$;
revoke all on function private.notify_stock_low() from public, anon, authenticated;
drop trigger if exists inventory_notify_low on public.inventory;
create trigger inventory_notify_low after update of stock, low_stock_threshold on public.inventory
  for each row execute function private.notify_stock_low();

create or replace function private.notify_material_low()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.stock <= new.low_stock_threshold and old.stock > old.low_stock_threshold then
    perform private.notify('material_low', format('%s needs ordering', new.name),
      format('%s %s on hand; order more below %s.', new.stock, new.unit, new.low_stock_threshold),
      'raw-material-detail', new.id,
      format('material_low:%s:%s', new.id, extract(epoch from clock_timestamp())::bigint));
  end if;
  return new;
end;
$fn$;
revoke all on function private.notify_material_low() from public, anon, authenticated;
drop trigger if exists raw_materials_notify_low on public.raw_materials;
create trigger raw_materials_notify_low after update of stock, low_stock_threshold on public.raw_materials
  for each row execute function private.notify_material_low();

create or replace function private.notify_batch_qc()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.status = 'Quality Check' and old.status is distinct from 'Quality Check' then
    perform private.notify('batch_qc', format('Batch #%s is ready for quality check', new.id),
      'Count the good pieces and finish it.', 'production', null,
      format('batch_qc:%s:%s', new.id, extract(epoch from clock_timestamp())::bigint));
  end if;
  return new;
end;
$fn$;
revoke all on function private.notify_batch_qc() from public, anon, authenticated;
drop trigger if exists production_batches_notify on public.production_batches;
create trigger production_batches_notify after update of status on public.production_batches
  for each row execute function private.notify_batch_qc();

create or replace function private.notify_delivery_arrived()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.status = 'Delivered' and old.status is distinct from 'Delivered' then
    perform private.notify('delivery_arrived', format('Delivery #%s arrived', new.id),
      coalesce(new.product, '') || coalesce(' · ' || new.location, ''), 'delivery-detail', new.id,
      format('delivery_arrived:%s', new.id));
  end if;
  return new;
end;
$fn$;
revoke all on function private.notify_delivery_arrived() from public, anon, authenticated;
drop trigger if exists deliveries_notify on public.deliveries;
create trigger deliveries_notify after update of status on public.deliveries
  for each row execute function private.notify_delivery_arrived();

create or replace function private.notify_account_blocked()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.status = 'Blocked' and old.status is distinct from 'Blocked' then
    perform private.notify('account_blocked', format('%s can no longer sign in', new.name),
      'Their account was suspended.', 'manage-account', new.id,
      format('account_blocked:%s:%s', new.id, extract(epoch from clock_timestamp())::bigint));
  end if;
  return new;
end;
$fn$;
revoke all on function private.notify_account_blocked() from public, anon, authenticated;
drop trigger if exists staff_notify_blocked on public.staff;
create trigger staff_notify_blocked after update of status on public.staff
  for each row execute function private.notify_account_blocked();

-- ---- raised by the clock ----

-- Late deliveries and overdue payments, raised once each (per promised day,
-- so a delivery moved to a new day and missed again is raised again). Called
-- by the app while anyone is signed in; cheap enough to call every few
-- minutes. Also clears the caller's own read alerts older than 60 days.
create or replace function public.refresh_alerts()
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  me public.staff;
  today date := private.shop_today();
  d record;
  o record;
begin
  select * into me from public.staff s
    where lower(s.email) = lower((select auth.jwt()) ->> 'email') and s.status = 'Active' limit 1;
  if me.id is null then raise exception 'Please sign in again.'; end if;

  for d in
    select x.id, x.product, x.due_on from public.deliveries x
    where x.status <> 'Delivered' and x.due_on is not null and x.due_on < today
  loop
    perform private.notify('delivery_late', format('Delivery #%s is late', d.id),
      format('%s · promised %s', coalesce(d.product, 'Delivery'), to_char(d.due_on, 'Mon FMDD')),
      'delivery-detail', d.id, format('delivery_late:%s:%s', d.id, d.due_on), true);
  end loop;

  for o in
    select x.id, x.customer_name,
      ((x.stock_committed_at at time zone 'Asia/Manila')::date + x.payment_term_days) as due,
      greatest(0, x.total_amount - x.refunded_amount
        - coalesce((select sum(p.amount) from public.order_payments p where p.order_id = x.id), 0)) as owed
    from public.orders x
    where x.payment_term_days is not null and x.stock_committed_at is not null and x.status <> 'Cancelled'
  loop
    continue when o.owed <= 0 or o.due >= today;
    perform private.notify('payment_overdue', format('Order #%s is overdue', o.id),
      format('%s owes ₱%s, due %s', o.customer_name, to_char(o.owed, 'FM999,999,999,990.00'), to_char(o.due, 'Mon FMDD')),
      'order-detail', o.id, format('payment_overdue:%s', o.id), true);
  end loop;

  delete from public.notifications
    where staff_id = me.id and read_at is not null and created_at < now() - interval '60 days';
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.refresh_alerts() from public, anon;
grant execute on function public.refresh_alerts() to authenticated;
