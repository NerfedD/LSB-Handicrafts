-- Who added each raw material, taken from the signed-in account so nobody types it.
alter table public.raw_materials
  add column if not exists created_by_staff_id bigint references public.staff(id);

create or replace function private.raw_materials_set_creator()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  if new.created_by_staff_id is null and auth.jwt() is not null then
    select id into new.created_by_staff_id from public.staff
    where lower(email) = lower(auth.jwt() ->> 'email') and status = 'Active';
  end if;
  return new;
end;
$fn$;

drop trigger if exists raw_materials_set_creator on public.raw_materials;
create trigger raw_materials_set_creator before insert on public.raw_materials
  for each row execute function private.raw_materials_set_creator();
