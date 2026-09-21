-- Staff accounts could never be created through admin-accounts.
--
-- The Edge Function calls auth.admin.createUser() with the new person's details
-- in app_metadata, and its comment says "the database trigger inserts staff in
-- the same transaction as auth.users". That is the assumption that was wrong.
-- GoTrue does not carry custom app_metadata into the INSERT; it writes it in a
-- follow-up UPDATE of raw_app_meta_data. The trigger fired AFTER INSERT only,
-- read `new.raw_app_meta_data -> 'lsb_staff'` as null, and took its no-op path.
--
-- Nothing raised, so nothing appeared in the Postgres logs to explain it. The
-- function then looked for the staff row it was promised, did not find it,
-- correctly refused to leave an orphaned sign-in behind, deleted the auth user
-- and returned 503 -- whose message blames a missing migration. The migration
-- was installed the whole time. Account creation through this path had never
-- once completed.
--
-- The fix is to provision on whichever write actually carries the details, and
-- to make the insert idempotent so that being called twice is harmless. The
-- existence check is on the same lower(email) the insert writes, which is also
-- what the Edge Function selects on afterwards.
create or replace function public.provision_staff_from_auth()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare details jsonb := new.raw_app_meta_data -> 'lsb_staff';
begin
  if details is null then return new; end if;
  -- Fires on the INSERT and on the metadata UPDATE GoTrue makes straight after.
  -- Whichever one carries lsb_staff provisions the row; the other finds it
  -- already there and does nothing. An account created some other way -- by
  -- hand in the dashboard, or by the seed -- carries no lsb_staff at all and
  -- still takes the no-op path above, exactly as before.
  if exists (select 1 from public.staff where lower(email) = lower(new.email)) then
    return new;
  end if;
  insert into public.staff (name, role, contact_number, status, email, username)
  values (
    details ->> 'name', details ->> 'role', coalesce(details ->> 'contactNumber', ''),
    'Active', lower(new.email), nullif(trim(details ->> 'username'), '')
  );
  return new;
end;
$fn$;
revoke all on function public.provision_staff_from_auth() from public, anon, authenticated;

drop trigger if exists provision_lsb_staff on auth.users;
create trigger provision_lsb_staff
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function public.provision_staff_from_auth();
