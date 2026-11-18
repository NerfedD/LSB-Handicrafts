-- Remarks on a batch's quality check: what the maker says when sending it to
-- check, and what the checker says when finishing it. Set by their own
-- function after the step itself, like set_supplier_payment, so
-- workshop_command stays as it is.
alter table public.production_batches
  add column if not exists handoff_remarks text check (char_length(handoff_remarks) <= 1000),
  add column if not exists check_remarks text check (char_length(check_remarks) <= 1000);

create or replace function public.set_batch_remarks(p_batch_id bigint, p_stage text, p_remarks text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  who text := private.caller_role();
  actor text;
  batch public.production_batches;
  v_remarks text := nullif(btrim(coalesce(p_remarks, '')), '');
begin
  if who is null or who not in ('Admin', 'Manager', 'Production Staff') then
    raise exception 'Only production staff, managers or administrators can add remarks to a batch.';
  end if;
  if p_stage is null or p_stage not in ('handoff', 'check') then
    raise exception 'Which remarks these are is not clear.';
  end if;
  if char_length(v_remarks) > 1000 then
    raise exception 'Keep the remarks to 1000 characters or fewer.';
  end if;
  select * into batch from public.production_batches where id = p_batch_id for update;
  if not found then raise exception 'That batch no longer exists.'; end if;
  if p_stage = 'handoff' and batch.status <> 'Quality Check' then
    raise exception 'Remarks for the check can only be added once the batch is sent to check.';
  end if;
  if p_stage = 'check' and batch.status <> 'Completed' then
    raise exception 'Checker remarks can only be added once the batch is finished.';
  end if;
  if p_stage = 'handoff' then
    update public.production_batches set handoff_remarks = v_remarks where id = batch.id returning * into batch;
  else
    update public.production_batches set check_remarks = v_remarks where id = batch.id returning * into batch;
  end if;
  if v_remarks is not null then
    select s.name into actor from public.staff s
      where lower(s.email) = lower((select auth.jwt()) ->> 'email') limit 1;
    insert into public.activity_log (id, type, staff_name, description, subject, at)
      values (nextval('private.workshop_id_seq'), 'stock', coalesce(actor, 'System'),
        format('%s %s remarks: %s', batch.batch_code, case p_stage when 'check' then 'quality check' else 'hand-off' end, v_remarks),
        batch.batch_code, now());
  end if;
  return to_jsonb(batch);
end;
$fn$;
revoke all on function public.set_batch_remarks(bigint, text, text) from public, anon;
grant execute on function public.set_batch_remarks(bigint, text, text) to authenticated;
