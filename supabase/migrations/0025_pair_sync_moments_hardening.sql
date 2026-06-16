-- Pair sync hardening (2025-06)
--
-- IMPORTANT: There is NO separate `pair_bundles` storage table in Haven.
-- GET /api/sync/pair-bundles reads sealed rows from public.moments
-- (haven_id + encrypted_vault + is_sealed = true).
--
-- This migration:
-- 1. Ensures moments has all columns required for Pair import
-- 2. Adds a query index for partner bundle pulls
-- 3. Re-asserts RLS so haven members can read sealed moments
-- 4. Exposes read-only VIEW public.pair_bundles for Supabase dashboard / ops
--    (same data as moments — NOT a second source of truth)

-- ── moments columns (idempotent) ─────────────────────────────────────────────

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

-- ── index for GET /api/sync/pair-bundles ───────────────────────────────────

create index if not exists moments_haven_sealed_created_idx
  on public.moments (haven_id, created_at desc)
  where is_sealed = true and haven_id is not null;

create index if not exists moments_created_by_user_idx
  on public.moments (created_by_user_id)
  where is_sealed = true;

-- ── RLS (re-apply if an environment missed 0017) ───────────────────────────

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

-- ── ops view (NOT used by application writes) ──────────────────────────────
-- pair_imported_count is per-device client state (localStorage), not server.

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
