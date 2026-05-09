# Supabase Schema (Group-safe Haven)

> Apply these in Supabase SQL Editor. Keep in sync with `lib/supabase/types.ts`.

## 1) Extensions

```sql
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
```

## 2) Tables

```sql
create table if not exists public.havens (
  id          uuid primary key default uuid_generate_v4(),
  created_by  uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table if not exists public.haven_members (
  id          uuid primary key default uuid_generate_v4(),
  haven_id    uuid not null references public.havens (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  unique (haven_id, user_id)
);

create table if not exists public.rings (
  id          uuid primary key default uuid_generate_v4(),
  haven_id    uuid references public.havens (id) on delete set null,
  owner_id    uuid references auth.users (id) on delete set null,
  status      varchar not null default 'unclaimed'
              check (status in ('unclaimed', 'active', 'revoked')),
  token_hash  text not null,
  pinned_moment_id uuid,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz
);

create table if not exists public.ring_invites (
  id           uuid primary key default uuid_generate_v4(),
  haven_id     uuid not null references public.havens (id) on delete cascade,
  created_by   uuid not null references auth.users (id) on delete cascade,
  invite_hash  text not null,
  expires_at   timestamptz not null,
  consumed_by  uuid references auth.users (id) on delete set null,
  consumed_at  timestamptz,
  cancelled_at timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.moments (
  id               uuid primary key default uuid_generate_v4(),
  haven_id         uuid references public.havens (id) on delete cascade,
  ring_id          uuid not null references public.rings (id) on delete cascade,
  -- Zero-knowledge invariant:
  -- user plaintext must never be stored in relational columns.
  text             text,
  image_url        text,
  audio_url        text,
  encrypted_vault  text not null,
  iv               text not null,
  is_sealed        boolean not null default false,
  created_at       timestamptz not null default now(),
  sealed_at        timestamptz
);

create table if not exists public.ring_events (
  id            uuid primary key default uuid_generate_v4(),
  ring_id       uuid not null references public.rings (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action        text not null check (
    action in (
      'claim',
      'ring_link_request',
      'ring_link_approved',
      'ring_link_rejected',
      'token_issue',
      'token_revoke',
      'wipe'
    )
  ),
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rings_pinned_moment_id_fkey'
  ) then
    alter table public.rings
      add constraint rings_pinned_moment_id_fkey
      foreign key (pinned_moment_id)
      references public.moments (id)
      on delete set null;
  end if;
end $$;
```

## 3) Compatibility migration (single-user -> group)

```sql
alter table public.rings add column if not exists haven_id uuid references public.havens (id) on delete set null;
alter table public.moments add column if not exists haven_id uuid references public.havens (id) on delete cascade;
alter table public.moments add column if not exists text text not null default '';
alter table public.moments add column if not exists image_url text;
alter table public.moments add column if not exists audio_url text;

-- Backfill one-person haven per existing owner.
insert into public.havens (created_by)
select distinct r.owner_id
from public.rings r
where r.owner_id is not null
  and not exists (
    select 1 from public.havens h where h.created_by = r.owner_id
  );

insert into public.haven_members (haven_id, user_id, role)
select h.id, h.created_by, 'owner'
from public.havens h
where not exists (
  select 1 from public.haven_members hm
  where hm.haven_id = h.id and hm.user_id = h.created_by
);

update public.rings r
set haven_id = h.id
from public.havens h
where h.created_by = r.owner_id
  and r.haven_id is null
  and r.owner_id is not null;

update public.moments m
set haven_id = r.haven_id
from public.rings r
where m.ring_id = r.id
  and m.haven_id is null;
```

## 4) Indexes

```sql
create index if not exists rings_owner_idx on public.rings (owner_id);
create index if not exists rings_haven_idx on public.rings (haven_id);
create index if not exists rings_pinned_moment_idx on public.rings (pinned_moment_id);
create index if not exists moments_haven_pending_idx on public.moments (haven_id) where is_sealed = false;
create index if not exists ring_invites_haven_expires_idx on public.ring_invites (haven_id, expires_at desc);
create index if not exists ring_events_ring_created_idx on public.ring_events (ring_id, created_at desc);
```

## 5) RLS (member-gated)

```sql
alter table public.havens enable row level security;
alter table public.haven_members enable row level security;
alter table public.rings enable row level security;
alter table public.ring_invites enable row level security;
alter table public.moments enable row level security;
alter table public.ring_events enable row level security;

create policy "haven_members_can_read_havens"
  on public.havens for select
  using (
    exists (
      select 1 from public.haven_members hm
      where hm.haven_id = id and hm.user_id = auth.uid()
    )
  );

create policy "members_can_read_membership"
  on public.haven_members for select
  using (
    exists (
      select 1 from public.haven_members hm
      where hm.haven_id = haven_id and hm.user_id = auth.uid()
    )
  );

create policy "members_can_read_rings"
  on public.rings for select
  using (
    haven_id is not null and exists (
      select 1 from public.haven_members hm
      where hm.haven_id = rings.haven_id and hm.user_id = auth.uid()
    )
  );

create policy "members_can_insert_moments"
  on public.moments for insert
  with check (
    haven_id is not null and exists (
      select 1 from public.haven_members hm
      where hm.haven_id = moments.haven_id and hm.user_id = auth.uid()
    )
  );

create policy "members_can_read_moments"
  on public.moments for select
  using (
    haven_id is not null and exists (
      select 1 from public.haven_members hm
      where hm.haven_id = moments.haven_id and hm.user_id = auth.uid()
    )
  );
```

## 6) Security-sensitive RPCs (requires explicit authorization)

```sql
-- Issue one-time invite code for an existing haven member.
create or replace function public.issue_ring_invite(p_haven_id uuid)
returns table(invite_code text, expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_code text := encode(gen_random_bytes(16), 'hex');
begin
  if auth.uid() is null then raise exception 'unauthenticated' using errcode='42501'; end if;
  if not exists (
    select 1 from public.haven_members hm
    where hm.haven_id = p_haven_id and hm.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  insert into public.ring_invites (haven_id, created_by, invite_hash, expires_at)
  values (
    p_haven_id,
    auth.uid(),
    encode(digest(v_code, 'sha256'), 'hex'),
    now() + interval '10 minutes'
  )
  returning ring_invites.expires_at into expires_at;

  invite_code := v_code;
  return next;
end $$;

-- Link a ring into an existing haven only with valid invite + tap token.
create or replace function public.link_ring_by_invite(p_token text, p_invite_code text)
returns table(haven_id uuid, ring_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_token_hash text := encode(digest(p_token, 'sha256'), 'hex');
  v_invite_hash text := encode(digest(p_invite_code, 'sha256'), 'hex');
begin
  if auth.uid() is null then raise exception 'unauthenticated' using errcode='42501'; end if;

  select ri.haven_id into haven_id
  from public.ring_invites ri
  where ri.invite_hash = v_invite_hash
    and ri.cancelled_at is null
    and ri.consumed_at is null
    and ri.expires_at > now()
  order by ri.created_at desc
  limit 1;

  if haven_id is null then
    raise exception 'invalid_or_expired_invite' using errcode='42501';
  end if;

  update public.rings r
  set haven_id = haven_id,
      owner_id = auth.uid(),
      status = 'active',
      claimed_at = coalesce(r.claimed_at, now())
  where r.token_hash = v_token_hash
  returning r.id into ring_id;

  if ring_id is null then
    raise exception 'ring_not_found' using errcode='42501';
  end if;

  insert into public.haven_members (haven_id, user_id, role)
  values (haven_id, auth.uid(), 'member')
  on conflict (haven_id, user_id) do nothing;

  update public.ring_invites
  set consumed_by = auth.uid(), consumed_at = now()
  where invite_hash = v_invite_hash
    and consumed_at is null
    and cancelled_at is null;

  return next;
end $$;
```

## 7) Operational notes

- Invite codes are one-time, short-lived (default 10 minutes), and only stored as hashes.
- Ring tap token and invite code must both be present to link a new ring.
- Server still stores ciphertext only. Group sharing changes authorization, not plaintext handling.

## 8) Token hash validation invariant (critical)

All ring RPCs must accept **plaintext token input** (`p_token`) and hash it
inside Postgres at query-time. Never store or compare plaintext tokens.

```sql
-- Canonical comparison shape (must be preserved):
-- where rings.token_hash = encode(extensions.digest(p_token::text, 'sha256'::text), 'hex')

create or replace function public.resolve_ring_by_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
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
end $$;

create or replace function public.seal_moment(p_ring_id uuid, p_token text)
returns public.moments
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_moment public.moments%rowtype;
begin
  if not exists (
    select 1
    from public.rings r
    where r.id = p_ring_id
      and r.token_hash = encode(extensions.digest(p_token::text, 'sha256'::text), 'hex')
      and r.status = 'active'
      and r.owner_id = auth.uid()
  ) then
    raise exception 'ring_not_authorized' using errcode = '42501';
  end if;

  with next_moment as (
    select m.id
    from public.moments m
    where m.ring_id = p_ring_id
      and m.is_sealed = false
    order by m.created_at asc
    limit 1
  )
  update public.moments m
  set is_sealed = true,
      sealed_at = now()
  where m.id in (select id from next_moment)
  returning m.* into v_moment;

  if v_moment.id is null then
    raise exception 'no_pending_moment' using errcode = 'P0001';
  end if;

  return v_moment;
end $$;
```

Non-negotiable:
- `token_hash` must never be returned by public API responses.
- Frontend must never compute, store, or display `token_hash`.
- RPCs must never include decryption logic; they only authorize and flip state.

---

## `user_nfc_rings` (NFC bind checklist)

Applied via `supabase/migrations/0003_user_nfc_rings.sql`:

- `nfc_uid_hash`: SHA-256 hex of normalized UID (never store raw UID).
- Partial unique index on `(user_id, nfc_uid_hash) WHERE is_active` — max one active binding per fingerprint per user.
- SDM state from `supabase/migrations/0012_user_nfc_rings_sdm.sql`:
  `sdm_enabled`, `last_sdm_counter`, `last_sdm_verified_at`.
  `last_sdm_counter` is used by `/api/rings/sdm/resolve` and the compatibility
  `/api/sdm/verify` route to reject replayed dynamic NFC ring taps.

API: `/api/rings/sdm/resolve`, `/api/nfc/bind`, `/api/nfc/list`, `/api/nfc/revoke`; login bootstrap `/api/auth/nfc-login` (JWT requires `SUPABASE_JWT_SECRET`).

## `user_entitlements` (Free / Haven Plus)

Applied via `supabase/migrations/0013_user_entitlements.sql`:

- Free: 2 GB local-first storage, 1 active ring, Save Securely only.
- Haven Plus: 50 GB local + cloud storage, up to 5 active rings, Seal with Ring, family sharing up to 4 people, AI insights, priority support, and full backup.
- Successful hardware claim or NFC bind grants a one-time 30-day Plus trial via `plus_trial_start` and `plus_trial_end`.
- After `plus_trial_end`, the app computes the user as Free unless `plus_subscription_status = 'active'`.

## `moments.content_sha256`

Applied via `supabase/migrations/0004_moments_content_sha256.sql` — optional SHA-256 hex for sync integrity (`src/utils/memoryIntegrity.js`).
