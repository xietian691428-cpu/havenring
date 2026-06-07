-- Dual-account Haven pair foundation.
--
-- Product invariant:
-- - A Haven pair is shared by at most two independent authenticated accounts.
-- - Each member may have at most one active NFC ring in the Haven.
-- - A Haven may have at most two active NFC rings.
-- - A physical ring UID is not reassigned across accounts/Havens in normal flows.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.havens (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.haven_members (
  id uuid primary key default uuid_generate_v4(),
  haven_id uuid not null references public.havens (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (haven_id, user_id)
);

create table if not exists public.ring_invites (
  id uuid primary key default uuid_generate_v4(),
  haven_id uuid not null references public.havens (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  invite_hash text not null,
  expires_at timestamptz not null,
  consumed_by uuid references auth.users (id) on delete set null,
  consumed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.haven_member_keys (
  haven_id uuid not null references public.havens (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  public_key_jwk jsonb not null,
  wrapped_haven_key jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (haven_id, user_id)
);

alter table public.user_nfc_rings
  add column if not exists haven_id uuid references public.havens (id) on delete restrict,
  add column if not exists retired_at timestamptz,
  add column if not exists retired_reason text;

alter table public.seal_tickets
  add column if not exists haven_id uuid references public.havens (id) on delete cascade,
  add column if not exists ring_id uuid;

create index if not exists user_nfc_rings_haven_idx
  on public.user_nfc_rings (haven_id);

create index if not exists ring_invites_hash_active_idx
  on public.ring_invites (invite_hash, expires_at desc)
  where consumed_at is null and cancelled_at is null;

create index if not exists haven_member_keys_user_idx
  on public.haven_member_keys (user_id);

-- Backfill: every existing user with a ring becomes a one-person Haven.
insert into public.havens (created_by)
select distinct unr.user_id
from public.user_nfc_rings unr
where unr.user_id is not null
  and not exists (
    select 1
    from public.havens h
    where h.created_by = unr.user_id
  );

insert into public.haven_members (haven_id, user_id, role)
select h.id, h.created_by, 'owner'
from public.havens h
where not exists (
  select 1
  from public.haven_members hm
  where hm.haven_id = h.id
    and hm.user_id = h.created_by
);

update public.user_nfc_rings unr
set haven_id = h.id
from public.havens h
where unr.haven_id is null
  and h.created_by = unr.user_id;

-- Legacy safety: the old single-account model could contain two active rings
-- under one user. Keep the oldest active credential, retire extras, and require
-- the partner to join with their own account via invite.
with ranked as (
  select
    id,
    row_number() over (
      partition by haven_id, user_id
      order by bound_at nulls last, created_at nulls last, id
    ) as rn
  from public.user_nfc_rings
  where haven_id is not null
    and user_id is not null
    and is_active = true
)
update public.user_nfc_rings unr
set
  is_active = false,
  retired_at = coalesce(unr.retired_at, now()),
  retired_reason = coalesce(unr.retired_reason, 'legacy_single_account_extra_ring')
from ranked
where ranked.id = unr.id
  and ranked.rn > 1;

create unique index if not exists user_nfc_rings_haven_user_active_uniq
  on public.user_nfc_rings (haven_id, user_id)
  where is_active = true;

-- Bridge dynamic NFC bindings into the legacy rings table so moments.ring_id
-- and older RPCs keep a stable FK-compatible identifier.
insert into public.rings (id, haven_id, owner_id, status, token_hash, claimed_at)
select unr.id, unr.haven_id, unr.user_id, 'active', unr.nfc_uid_hash, unr.bound_at
from public.user_nfc_rings unr
where unr.haven_id is not null
  and unr.is_active = true
  and not exists (
    select 1
    from public.rings r
    where r.id = unr.id
  );

-- Membership-aware RLS. API routes still use service_role for sensitive writes.
alter table public.havens enable row level security;
alter table public.haven_members enable row level security;
alter table public.ring_invites enable row level security;
alter table public.haven_member_keys enable row level security;
alter table public.user_nfc_rings enable row level security;
alter table public.moments enable row level security;

drop policy if exists "haven_members_can_read_havens" on public.havens;
create policy "haven_members_can_read_havens"
  on public.havens for select
  using (
    exists (
      select 1
      from public.haven_members hm
      where hm.haven_id = havens.id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "members_can_read_membership" on public.haven_members;
create policy "members_can_read_membership"
  on public.haven_members for select
  using (
    exists (
      select 1
      from public.haven_members viewer
      where viewer.haven_id = haven_members.haven_id
        and viewer.user_id = auth.uid()
    )
  );

drop policy if exists "members_can_read_haven_nfc_rings" on public.user_nfc_rings;
create policy "members_can_read_haven_nfc_rings"
  on public.user_nfc_rings for select
  using (
    user_id = auth.uid()
    or (
      haven_id is not null
      and exists (
        select 1
        from public.haven_members hm
        where hm.haven_id = user_nfc_rings.haven_id
          and hm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "members_can_read_own_haven_key" on public.haven_member_keys;
create policy "members_can_read_own_haven_key"
  on public.haven_member_keys for select
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.haven_members hm
      where hm.haven_id = haven_member_keys.haven_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "members_can_read_moments" on public.moments;
create policy "members_can_read_moments"
  on public.moments for select
  using (
    haven_id is not null
    and exists (
      select 1
      from public.haven_members hm
      where hm.haven_id = moments.haven_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "members_can_insert_moments" on public.moments;
create policy "members_can_insert_moments"
  on public.moments for insert
  with check (
    haven_id is not null
    and exists (
      select 1
      from public.haven_members hm
      where hm.haven_id = moments.haven_id
        and hm.user_id = auth.uid()
    )
  );

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
      or (old.haven_id is distinct from new.haven_id)
    then
      raise exception 'ring_binding_is_non_transferable' using errcode = '23514';
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

drop trigger if exists user_nfc_rings_haven_pair_limits on public.user_nfc_rings;
create trigger user_nfc_rings_haven_pair_limits
  before insert or update on public.user_nfc_rings
  for each row
  execute procedure public.enforce_haven_pair_ring_limits();

create or replace function public.issue_partner_invite(p_haven_id uuid)
returns table(invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := encode(extensions.gen_random_bytes(16), 'hex');
  v_active_rings integer;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.haven_members hm
    where hm.haven_id = p_haven_id
      and hm.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*)
  into v_active_rings
  from public.user_nfc_rings unr
  where unr.haven_id = p_haven_id
    and unr.is_active = true;

  if v_active_rings >= 2 then
    raise exception 'haven_pair_full' using errcode = '23514';
  end if;

  insert into public.ring_invites (haven_id, created_by, invite_hash, expires_at)
  values (
    p_haven_id,
    auth.uid(),
    encode(extensions.digest(v_code, 'sha256'), 'hex'),
    now() + interval '24 hours'
  )
  returning ring_invites.expires_at into expires_at;

  invite_code := v_code;
  return next;
end;
$$;

grant execute on function public.issue_partner_invite(uuid) to authenticated, service_role;
grant all on table public.havens to service_role;
grant all on table public.haven_members to service_role;
grant all on table public.ring_invites to service_role;
grant all on table public.haven_member_keys to service_role;
grant all on table public.user_nfc_rings to service_role;

create or replace function public.seal_finalize_atomic(
  p_user_id uuid,
  p_ticket_hash text,
  p_draft_ids jsonb,
  p_draft_payloads jsonb
)
returns table(saved_ids jsonb, sealed_by_ring_uid text, consumed_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ticket public.seal_tickets%rowtype;
  v_ring_id uuid;
  v_haven_id uuid;
  v_item jsonb;
  v_item_id text;
  v_now timestamptz := now();
  v_expected_ids text;
  v_input_ids text;
  v_payload_ids text;
begin
  if p_user_id is null or coalesce(p_ticket_hash, '') = '' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if jsonb_typeof(p_draft_ids) <> 'array' or jsonb_array_length(p_draft_ids) = 0 then
    raise exception 'missing_draft_ids' using errcode = '22023';
  end if;

  if jsonb_typeof(p_draft_payloads) <> 'array'
    or jsonb_array_length(p_draft_payloads) <> jsonb_array_length(p_draft_ids) then
    raise exception 'missing_draft_payloads' using errcode = '22023';
  end if;

  select *
  into v_ticket
  from public.seal_tickets st
  where st.ticket_hash = p_ticket_hash
    and st.user_id = p_user_id
  for update;

  if v_ticket.id is null then
    raise exception 'invalid_ticket' using errcode = 'P0001';
  end if;
  if v_ticket.consumed_at is not null then
    raise exception 'ticket_already_used' using errcode = 'P0001';
  end if;
  if v_ticket.expires_at <= v_now then
    raise exception 'ticket_expired' using errcode = 'P0001';
  end if;

  v_ring_id := v_ticket.ring_id;
  v_haven_id := v_ticket.haven_id;

  if v_ring_id is null or v_haven_id is null then
    select unr.id, unr.haven_id
    into v_ring_id, v_haven_id
    from public.user_nfc_rings unr
    where unr.nfc_uid_hash = v_ticket.ring_uid_hash
      and unr.is_active = true
    limit 1;
  end if;

  if v_ring_id is null or v_haven_id is null then
    raise exception 'no_active_ring' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.haven_members hm
    where hm.haven_id = v_haven_id
      and hm.user_id = p_user_id
  ) then
    raise exception 'not_haven_member' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.user_nfc_rings unr
    where unr.id = v_ring_id
      and unr.haven_id = v_haven_id
      and unr.is_active = true
  ) then
    raise exception 'no_active_ring' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(value order by value)::text, '[]')
  into v_expected_ids
  from jsonb_array_elements_text(v_ticket.draft_ids);

  select coalesce(jsonb_agg(value order by value)::text, '[]')
  into v_input_ids
  from jsonb_array_elements_text(p_draft_ids);

  if v_expected_ids <> v_input_ids then
    raise exception 'draft_set_mismatch' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(value order by value)::text, '[]')
  into v_payload_ids
  from (
    select (elem->>'id') as value
    from jsonb_array_elements(p_draft_payloads) elem
  ) s;

  if v_payload_ids <> v_input_ids then
    raise exception 'draft_payload_mismatch' using errcode = 'P0001';
  end if;

  insert into public.rings (id, haven_id, owner_id, status, token_hash, claimed_at)
  values (v_ring_id, v_haven_id, p_user_id, 'active', v_ticket.ring_uid_hash, v_now)
  on conflict (id) do update
    set haven_id = excluded.haven_id,
        status = 'active',
        claimed_at = coalesce(public.rings.claimed_at, excluded.claimed_at);

  for v_item in select value from jsonb_array_elements(p_draft_payloads)
  loop
    v_item_id := coalesce(v_item->>'id', '');
    if v_item_id = '' then
      raise exception 'invalid_payload_id' using errcode = 'P0001';
    end if;

    insert into public.moments (
      id,
      haven_id,
      ring_id,
      created_by_user_id,
      text,
      image_url,
      audio_url,
      encrypted_vault,
      iv,
      is_sealed,
      sealed_at,
      release_at,
      content_sha256
    )
    values (
      v_item_id::uuid,
      v_haven_id,
      v_ring_id,
      p_user_id,
      null,
      null,
      null,
      encode(convert_to(v_item::text, 'utf8'), 'base64'),
      replace(gen_random_uuid()::text, '-', ''),
      true,
      v_now,
      case
        when coalesce((v_item->>'releaseAt')::bigint, 0) > 0
          then to_timestamp(((v_item->>'releaseAt')::bigint)::double precision / 1000.0)
        else null
      end,
      encode(digest(v_item::text, 'sha256'), 'hex')
    )
    on conflict (id) do update
      set haven_id = excluded.haven_id,
          ring_id = excluded.ring_id,
          created_by_user_id = excluded.created_by_user_id,
          encrypted_vault = excluded.encrypted_vault,
          iv = excluded.iv,
          is_sealed = true,
          sealed_at = excluded.sealed_at,
          release_at = excluded.release_at,
          content_sha256 = excluded.content_sha256;
  end loop;

  update public.seal_tickets st
  set consumed_at = v_now
  where st.id = v_ticket.id
    and st.consumed_at is null;

  if not found then
    raise exception 'ticket_commit_race' using errcode = 'P0001';
  end if;

  return query
  select p_draft_ids, coalesce(v_ticket.ring_uid_hash, ''), v_now;
end
$$;

grant execute on function public.seal_finalize_atomic(uuid, text, jsonb, jsonb) to service_role;
revoke execute on function public.seal_finalize_atomic(uuid, text, jsonb, jsonb) from anon, authenticated;
