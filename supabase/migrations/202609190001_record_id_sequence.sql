-- Record ids come from the database, not from a clock.
--
-- See the matching block in schema.sql for the full reasoning. In short: every
-- id on the eight original tables was a Date.now() picked in the browser, which
-- is only unique while one person uses the system at a time. Two testers saving
-- in the same millisecond collided on the primary key, and the loser was told
-- their correctly-filled form was a duplicate.
--
-- Safe to re-run, and additive: no existing row is touched.

create sequence if not exists private.record_id_seq start 2000000000000;

-- authenticated already holds USAGE on `private` (anon deliberately does not);
-- nextval additionally needs it on the sequence itself.
grant usage, select on sequence private.record_id_seq to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'inventory', 'deliveries', 'orders', 'activity_log',
    'staff', 'customers', 'products', 'suppliers'
  ] loop
    execute format(
      'alter table public.%I alter column id set default nextval(''private.record_id_seq'')', t
    );
  end loop;
end $$;

-- The staff provisioning trigger picked its own id the same way, a microsecond
-- epoch rather than a millisecond one -- a narrower window to collide in, not a
-- closed one, and two administrators adding accounts during the same class
-- session is exactly the case this is being hardened for. It now omits the
-- column and lets the default above supply it. Everything else is unchanged.
create or replace function public.provision_staff_from_auth()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare details jsonb := new.raw_app_meta_data -> 'lsb_staff';
begin
  if details is null then return new; end if;
  insert into public.staff (name, role, contact_number, status, email, username)
  values (
    details ->> 'name', details ->> 'role', coalesce(details ->> 'contactNumber', ''),
    'Active', lower(new.email), nullif(trim(details ->> 'username'), '')
  );
  return new;
end;
$fn$;
revoke all on function public.provision_staff_from_auth() from public, anon, authenticated;
