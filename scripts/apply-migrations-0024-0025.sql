-- =============================================================================
-- Haven Ring — apply migrations 0024 + 0025 in Supabase SQL Editor (one shot)
-- =============================================================================
-- Use when `supabase db push` fails (e.g. CLI 401) but you have Dashboard access.
--
-- BEFORE RUNNING:
--   • Dashboard → SQL Editor → New query → paste this entire file → Run
--   • You need a role that can alter functions, tables, policies, and views.
--
-- AFTER RUNNING:
--   • Re-run `supabase migration list` locally (optional) — 0024/0025 should show
--     as applied on remote if version strings match your history table.
--   • Run scripts/support-pair-sync-check.sql to verify Pair sync.
-- =============================================================================

-- ── 0) Inspect current migration history (read-only) ─────────────────────────

select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 15;

-- ── 1) Migration 0024 — allow haven_id move during Pair join ─────────────────

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

-- ── 2) Migration 0025 — Pair sync / moments hardening ────────────────────────

alter table public.moments
  add column if not exists haven_id uuid references public.havens (id) on delete cascade,
  add column if not exists created_by_user_id uuid references auth.users (id) on delete set null,
  add column if not exists content_sha256 text,
  add column if not exists release_at timestamptz,
  add column if not exists sealed_at timestamptz;

comment on column public.moments.haven_id is
  'Haven scope for Pair sync; both members read sealed moments in this haven.';
comment on column public.moments.created_by_user_id is
  'Author account; used to label partner vs own memories on import.';
comment on column public.moments.encrypted_vault is
  'Base64 JSON draft at seal time; decoded client-side for Pair import.';

create index if not exists moments_haven_sealed_created_idx
  on public.moments (haven_id, created_at desc)
  where is_sealed = true and haven_id is not null;

create index if not exists moments_created_by_user_idx
  on public.moments (created_by_user_id)
  where is_sealed = true;

alter table public.moments enable row level security;

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

drop view if exists public.pair_bundles;

create view public.pair_bundles
with (security_invoker = true)
as
select
  m.id,
  m.haven_id,
  m.created_by_user_id,
  m.created_at,
  m.encrypted_vault as data,
  m.ring_id,
  m.iv,
  m.is_sealed,
  m.sealed_at,
  m.release_at,
  m.content_sha256
from public.moments m
where m.is_sealed = true
  and m.haven_id is not null;

comment on view public.pair_bundles is
  'Read-only projection of sealed moments for Pair sync diagnostics. '
  'Application code uses moments directly via service_role in /api/sync/pair-bundles.';

grant select on public.pair_bundles to authenticated;
grant select on public.pair_bundles to service_role;

-- ── 3) Record migrations so `supabase db push` skips them later ─────────────
-- Detects whether your project uses short versions (0024) or long filenames
-- (0024_pair_join_allow_haven_move) by inspecting existing rows.

do $$
declare
  uses_long_names boolean;
  v24 text;
  v25 text;
  has_name_col boolean;
begin
  create schema if not exists supabase_migrations;

  create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  );

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'supabase_migrations'
      and table_name = 'schema_migrations'
      and column_name = 'name'
  ) into has_name_col;

  select coalesce(
    (
      select bool_or(position('_' in version) > 0)
      from supabase_migrations.schema_migrations
      where version ~ '^[0-9]{4}'
    ),
    false
  ) into uses_long_names;

  if uses_long_names then
    v24 := '0024_pair_join_allow_haven_move';
    v25 := '0025_pair_sync_moments_hardening';
  else
    v24 := '0024';
    v25 := '0025';
  end if;

  if has_name_col then
    insert into supabase_migrations.schema_migrations (version, name)
    values
      (v24, 'pair_join_allow_haven_move'),
      (v25, 'pair_sync_moments_hardening')
    on conflict (version) do nothing;
  else
    insert into supabase_migrations.schema_migrations (version)
    values (v24), (v25)
    on conflict (version) do nothing;
  end if;
end $$;

-- ── 4) Post-checks ───────────────────────────────────────────────────────────

-- Migration rows (expect 0024 + 0025 in some form)
select version, name
from supabase_migrations.schema_migrations
where version like '0024%' or version like '0025%'
order by version;

-- Trigger function exists
select proname, prosrc like '%old.haven_id is distinct from new.haven_id%' as has_haven_move_fix
from pg_proc
where proname = 'enforce_haven_pair_ring_limits';

-- Pair sync index + view
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in ('moments_haven_sealed_created_idx', 'moments_created_by_user_idx');

select table_type
from information_schema.tables
where table_schema = 'public'
  and table_name = 'pair_bundles';
