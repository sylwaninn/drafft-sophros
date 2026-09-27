-- Removes every demo row (scripts/demo.sh down). Triggers are off, like when the rows went in: nothing
-- reaches Stream, R2, APNs or an inbox. Foreign keys don't cascade then, so each table that points at an
-- account is cleared by hand, found from the catalogue.
set session_replication_role = replica;

create temp table demo_ids as
  select id from auth.users where email like '%@demo.sophros.test' or id::text like 'de000000-%';

do $$
declare
  v_ref record;
begin
  for v_ref in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
      and c.conrelid not in ('public.profiles'::regclass)
  loop
    execute format('delete from %s where %I in (select id from demo_ids)', v_ref.tbl, v_ref.col);
  end loop;
end;
$$;

delete from public.media_flags where key like 'u/de000000-%';
delete from private.identity_marks where user_id in (select id from demo_ids);
delete from private.support_requests where email like '%@demo.sophros.test';
delete from private.admin_audit where actor like '%@demo.sophros.test' or user_id in (select id from demo_ids);
delete from private.staff where email like '%@demo.sophros.test';
delete from public.profiles where id in (select id from demo_ids);
delete from auth.users where id in (select id from demo_ids);

set session_replication_role = origin;
