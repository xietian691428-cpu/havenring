-- Pair join must move a member's ring from their solo Haven into the partner Haven.
-- The original trigger blocked ANY haven_id change on UPDATE, which broke joinExistingRingToInviteHaven.

create or replace function public.enforce_haven_pair_ring_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_count integer;
begin
  if new.haven_id is null then
    raise exception 'haven_required' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if old.nfc_uid_hash <> new.nfc_uid_hash
      or old.user_id <> new.user_id
    then
      raise exception 'ring_binding_is_non_transferable' using errcode = '23514';
    end if;

    if old.haven_id is distinct from new.haven_id then
      if not exists (
        select 1
        from public.haven_members hm
        where hm.haven_id = new.haven_id
          and hm.user_id = new.user_id
      ) then
        raise exception 'ring_binding_is_non_transferable' using errcode = '23514';
      end if;
    end if;
  end if;

  if new.is_active = true then
    if not exists (
      select 1
      from public.haven_members hm
      where hm.haven_id = new.haven_id
        and hm.user_id = new.user_id
    ) then
      raise exception 'ring_user_not_haven_member' using errcode = '23514';
    end if;

    select count(*)
    into v_active_count
    from public.user_nfc_rings unr
    where unr.haven_id = new.haven_id
      and unr.is_active = true
      and (tg_op <> 'UPDATE' or unr.id <> new.id);

    if v_active_count >= 2 then
      raise exception 'haven_ring_limit_reached' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;
