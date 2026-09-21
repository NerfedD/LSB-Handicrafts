-- Staff rows carry privilege, so a lost update here is not just a lost edit.
--
-- Admin screens save a WHOLE row: App.updateSelectedAccount sends
-- { ...current, ...changes }, where `current` is this browser's copy. That copy
-- is refreshed on a 30-second timer, but a screen opened before a change still
-- holds the old status and role. So one administrator blocking a departing
-- employee could be undone by another administrator saving a name correction
-- from a screen opened a minute earlier -- it writes back status = 'Active' and
-- nothing reports it. The block evaporates silently.
--
-- staff was given an audit trigger by 20260921122520 but no revision, the one
-- audited table without one. This closes that gap. The bump function and the
-- update predicate are the same ones the other six tables already use.
alter table public.staff add column if not exists revision bigint not null default 0;
drop trigger if exists staff_revision on public.staff;
create trigger staff_revision before update on public.staff
  for each row execute function private.bump_record_revision();

-- update_own_profile deliberately does NOT take a revision, and its arity is
-- not changed: it is granted by exact signature, so a new parameter would
-- revoke the grant from every client still calling the old shape. It writes two
-- columns -- your own name and contact number -- on your own row, chosen
-- server-side, so it cannot carry another screen's stale status or role. The
-- trigger above still bumps the revision, which is what makes an administrator
-- screen held open over your own profile edit go stale rather than overwrite it.
