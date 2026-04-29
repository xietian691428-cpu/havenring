-- Enforce created_by_user_id on insert when the session has auth.uid() (client / RPC under user JWT).
-- Service-role inserts without a user session may still leave null until backfilled.

create or replace function public.set_moment_created_by()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.created_by_user_id is null then
    new.created_by_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists moments_set_created_by on public.moments;

create trigger moments_set_created_by
  before insert on public.moments
  for each row
  execute procedure public.set_moment_created_by();

comment on function public.set_moment_created_by() is
  'Sets moments.created_by_user_id from auth.uid() when omitted.';
