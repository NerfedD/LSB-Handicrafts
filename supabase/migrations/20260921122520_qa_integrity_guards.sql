-- Apply before deploying the matching client; refresh existing browser tabs.
-- Catalogue and contact forms carry the revision at the time editing began.
create or replace function private.bump_record_revision()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  new.revision := old.revision + 1;
  return new;
end;
$fn$;
revoke all on function private.bump_record_revision() from public, anon, authenticated;

do $migration$
declare target text;
begin
  foreach target in array array['customers', 'suppliers', 'products', 'inventory'] loop
    execute format('alter table public.%I add column if not exists revision bigint not null default 0', target);
    execute format('drop trigger if exists %I on public.%I', target || '_revision', target);
    execute format('create trigger %I before update on public.%I for each row execute function private.bump_record_revision()', target || '_revision', target);
  end loop;
end;
$migration$;

-- Existing events cannot retrospectively be authenticated. New events are
-- written only by trusted database code, in the same transaction as the change.
alter table public.activity_log add column if not exists source text not null default 'legacy';
alter table public.activity_log alter column source set default 'server';
alter table public.activity_log add column if not exists actor_staff_id bigint;
drop policy if exists "Active staff insert activity_log" on public.activity_log;
revoke insert, update, delete, truncate on public.activity_log from public, anon, authenticated;

create or replace function private.audit_record_change()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  actor_id bigint;
  actor_name text;
  before_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  after_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  item jsonb;
  event_kind text;
  event_subject text;
  event_description text;
  change_amount numeric;
  changed_fields text;
begin
  if tg_op = 'UPDATE' and (before_row - 'revision' - 'updated_at') = (after_row - 'revision' - 'updated_at') then
    return new;
  end if;
  select id, name into actor_id, actor_name from public.staff
    where lower(email) = lower(auth.jwt()->>'email') and status = 'Active' limit 1;
  -- System operations and self-deletion still have a truthful actor label.
  actor_name := coalesce(actor_name, nullif(auth.jwt()->>'email', ''), 'System');
  item := case when tg_op = 'DELETE' then before_row else after_row end;
  event_kind := case tg_table_name
    when 'customers' then 'customer' when 'suppliers' then 'supplier'
    when 'products' then 'product' when 'inventory' then 'stock'
    when 'orders' then 'order' when 'deliveries' then 'delivery' else 'account' end;
  event_subject := case tg_table_name
    when 'products' then item->>'item_code'
    when 'inventory' then item->>'sku'
    else event_kind || ':' || (item->>'id') end;
  event_description := case tg_op when 'INSERT' then 'added ' when 'DELETE' then 'removed ' else 'updated ' end
    || event_kind || ' ' || coalesce(nullif(item->>'name', ''), '#' || (item->>'id'));
  if tg_op = 'UPDATE' then
    select string_agg(k, ', ' order by k) into changed_fields
      from jsonb_object_keys(after_row) as fields(k)
      where k not in ('revision', 'updated_at') and before_row->k is distinct from after_row->k;
    event_description := event_description || ' (changed: ' || coalesce(changed_fields, 'record') || ')';
    if tg_table_name = 'inventory' then
      change_amount := (after_row->>'stock')::numeric - (before_row->>'stock')::numeric;
    elsif tg_table_name = 'orders' and before_row->'total_amount' is distinct from after_row->'total_amount' then
      event_kind := 'price';
      change_amount := (after_row->>'total_amount')::numeric - (before_row->>'total_amount')::numeric;
      event_description := event_description || ': ' || coalesce(before_row->>'total_amount', '0') || ' to ' || coalesce(after_row->>'total_amount', '0');
    end if;
  end if;
  insert into public.activity_log(type, staff_name, actor_staff_id, description, subject, amount, at, source)
    values(event_kind, actor_name, actor_id, event_description, event_subject, change_amount, clock_timestamp(), 'server');
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$fn$;
revoke all on function private.audit_record_change() from public, anon, authenticated;

do $migration$
declare target text;
begin
  foreach target in array array['customers', 'suppliers', 'products', 'inventory', 'orders', 'deliveries', 'staff'] loop
    execute format('drop trigger if exists audit_record_change on public.%I', target);
    execute format('create trigger audit_record_change after insert or update or delete on public.%I for each row execute function private.audit_record_change()', target);
  end loop;
end;
$migration$;

-- One sign-in entry per authenticated session. No caller-supplied actor,
-- description, timestamp, or event kind is accepted by this endpoint.
create table if not exists private.audited_sessions (session_id uuid primary key);
revoke all on private.audited_sessions from public, anon, authenticated;
create or replace function public.record_session_activity()
returns void language plpgsql security definer set search_path = '' as $fn$
declare actor_id bigint; actor_name text; session_key uuid; inserted_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  session_key := nullif(auth.jwt()->>'session_id', '')::uuid;
  select id, name into actor_id, actor_name from public.staff
    where lower(email) = lower(auth.jwt()->>'email') and status = 'Active' limit 1;
  if actor_id is null or session_key is null then
    raise exception 'An active staff session is needed.' using errcode = '42501';
  end if;
  insert into private.audited_sessions values(session_key) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then
    insert into public.activity_log(type, staff_name, actor_staff_id, description, at, source)
      values('sign-in', actor_name, actor_id, 'signed in', clock_timestamp(), 'server');
  end if;
end;
$fn$;
revoke all on function public.record_session_activity() from public, anon;
grant execute on function public.record_session_activity() to authenticated;
