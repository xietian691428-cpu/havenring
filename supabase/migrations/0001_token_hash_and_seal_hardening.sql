-- Haven Ring hardening migration (incremental, safe to re-run)
-- Focus:
-- 1) pgcrypto hashing path for ring token verification
-- 2) seal_moment(moment_id, token) as canonical seal RPC
-- 3) non-recursive haven_members RLS
-- 4) zero-knowledge compatibility for moments.text

create extension if not exists pgcrypto;

-- Zero-knowledge compatible: plaintext column must not be required.
alter table public.moments
  alter column text drop not null;

-- ---------------------------------------------------------------------------
-- RLS: prevent self-recursive policy loops on haven_members
-- ---------------------------------------------------------------------------
alter table public.haven_members enable row level security;

drop policy if exists "members_can_read_membership" on public.haven_members;
create policy "members_can_read_membership"
  on public.haven_members
  for select
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC: resolve ring by plaintext token (hash in DB at query time)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_ring_by_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_ring_id uuid;
begin
  select r.id
    into v_ring_id
  from public.rings r
  where r.token_hash = encode(extensions.digest(p_token::text, 'sha256'::text), 'hex')
    and r.status = 'active'
  limit 1;

  if v_ring_id is null then
    raise exception 'ring_not_found_or_inactive' using errcode = '42501';
  end if;

  return v_ring_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- RPC: seal by ring_id, picks earliest pending row
-- ---------------------------------------------------------------------------
create or replace function public.seal_moment(p_moment_id uuid, p_token text)
returns public.moments
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_target_moment_id uuid;
  v_moment public.moments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.rings r
    where r.id = p_moment_id
      and r.status = 'active'
      and r.owner_id = auth.uid()
      and r.token_hash = encode(extensions.digest(p_token::text, 'sha256'::text), 'hex')
  ) then
    raise exception 'ring_not_authorized' using errcode = '42501';
  end if;

  select m.id
    into v_target_moment_id
  from public.moments m
  where m.ring_id = p_moment_id
    and m.is_sealed = false
  order by m.created_at asc
  limit 1;

  if v_target_moment_id is null then
    raise exception 'no_pending_moment' using errcode = 'P0001';
  end if;

  with matched as (
    select m.id
    from public.moments m
    where m.id = v_target_moment_id
      and m.is_sealed = false
    limit 1
  )
  update public.moments m
  set is_sealed = true,
      sealed_at = now()
  where m.id in (select id from matched)
  returning m.* into v_moment;

  if v_moment.id is null then
    raise exception 'moment_not_sealable' using errcode = '42501';
  end if;

  return v_moment;
end;
$function$;
