begin;

-- A blocked caller may read their own status, without seeing other staff.
drop policy if exists "Active staff can read staff" on public.staff;
create policy "Active staff can read staff" on public.staff for select
  using (private.is_active_staff() or lower(email) = lower((select auth.jwt()) ->> 'email'));

-- Provisioning metadata is supplied only by the Auth Admin API. Public sign-up
-- cannot write raw_app_meta_data. A failing staff insert rolls back Auth creation.
create or replace function public.provision_staff_from_auth()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare details jsonb := new.raw_app_meta_data -> 'lsb_staff';
begin
  if details is null then return new; end if;
  insert into public.staff (id, name, role, contact_number, status, email, username)
  values (
    (extract(epoch from clock_timestamp()) * 1000000)::bigint,
    details ->> 'name', details ->> 'role', coalesce(details ->> 'contactNumber', ''),
    'Active', lower(new.email), nullif(trim(details ->> 'username'), '')
  );
  return new;
end;
$fn$;
revoke all on function public.provision_staff_from_auth() from public, anon, authenticated;
drop trigger if exists provision_lsb_staff on auth.users;
create trigger provision_lsb_staff after insert on auth.users
  for each row execute function public.provision_staff_from_auth();

-- RLS authorizes deletion of the staff row first. Removing credentials in the
-- same transaction prevents partial deletion and refresh-token resurrection.
create or replace function public.remove_staff_credentials()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  delete from auth.users where lower(email) = lower(old.email);
  return old;
end;
$fn$;
revoke all on function public.remove_staff_credentials() from public, anon, authenticated;
drop trigger if exists remove_lsb_credentials on public.staff;
create trigger remove_lsb_credentials after delete on public.staff
  for each row execute function public.remove_staff_credentials();

alter table public.orders add column if not exists priority_position integer not null default 0;

create or replace function public.reorder_orders(p_ids bigint[])
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if not private.is_active_staff() then
    raise exception 'You do not have permission to reorder orders.' using errcode = '42501';
  end if;
  -- Serializes priority writes while preserving independent stock/money writes.
  perform pg_advisory_xact_lock(7140914);
  if cardinality(p_ids) is distinct from (select count(distinct id) from unnest(p_ids) id)
    or exists (select 1 from unnest(p_ids) id where id is null)
    or exists (select 1 from unnest(p_ids) as requested(order_id) where not exists (select 1 from public.orders o where o.id = requested.order_id)) then
    raise exception 'The order list changed. Refresh it and try again.';
  end if;
  update public.orders o set priority_position = ranked.position::integer
    from unnest(p_ids) with ordinality as ranked(id, position) where o.id = ranked.id;
end;
$fn$;
revoke all on function public.reorder_orders(bigint[]) from public, anon;
grant execute on function public.reorder_orders(bigint[]) to authenticated;
commit;
