-- Explicit Data API grants for Supabase policy change (May/Oct 2026).
-- Table-level GRANT decides whether PostgREST / supabase-js may call a table;
-- RLS policies (existing migrations + docs/database-schema.md) still gate rows.
-- Safe to re-run: GRANT/REVOKE are idempotent; RLS enable is idempotent.

-- ---------------------------------------------------------------------------
-- Server-only tables: RLS on, no client policies, service_role only
-- ---------------------------------------------------------------------------
alter table if exists public.seal_tickets enable row level security;
alter table if exists public.seal_telemetry_events enable row level security;
alter table if exists public.first_run_events enable row level security;

revoke all on table public.seal_tickets from anon, authenticated;
revoke all on table public.seal_telemetry_events from anon, authenticated;
revoke all on table public.first_run_events from anon, authenticated;

grant all on table public.seal_tickets to service_role;
grant all on table public.seal_telemetry_events to service_role;
grant all on table public.first_run_events to service_role;

-- ---------------------------------------------------------------------------
-- Authenticated user tables (RLS must remain enabled in production)
-- ---------------------------------------------------------------------------
grant select on table public.havens to authenticated;
grant select on table public.haven_members to authenticated;

grant select, update on table public.rings to authenticated;

grant select, insert, update on table public.moments to authenticated;

grant select, insert, update, delete on table public.user_nfc_rings to authenticated;

grant select, insert, update on table public.user_entitlements to authenticated;

-- Audit log written only from API routes using service_role.
revoke all on table public.ring_events from anon, authenticated;
grant select, insert on table public.ring_events to service_role;

-- Invites are created/consumed via security-definer RPCs; keep direct API closed.
revoke all on table public.ring_invites from anon, authenticated;
grant select, insert, update on table public.ring_invites to service_role;

-- ---------------------------------------------------------------------------
-- service_role: full access for Route Handlers / admin client
-- ---------------------------------------------------------------------------
grant all on table public.havens to service_role;
grant all on table public.haven_members to service_role;
grant all on table public.rings to service_role;
grant all on table public.moments to service_role;
grant all on table public.user_nfc_rings to service_role;
grant all on table public.user_entitlements to service_role;

-- ---------------------------------------------------------------------------
-- anon: no direct public-table access (auth + RLS-backed reads use authenticated)
-- ---------------------------------------------------------------------------
revoke all on table public.havens from anon;
revoke all on table public.haven_members from anon;
revoke all on table public.rings from anon;
revoke all on table public.moments from anon;
revoke all on table public.user_nfc_rings from anon;
revoke all on table public.user_entitlements from anon;
revoke all on table public.ring_events from anon;
revoke all on table public.ring_invites from anon;

-- ---------------------------------------------------------------------------
-- Sequences (uuid defaults / serial columns)
-- ---------------------------------------------------------------------------
grant usage, select on all sequences in schema public to authenticated;
grant all on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- RPC execute grants (only functions that exist in this project)
-- ---------------------------------------------------------------------------
do $grant_client_rpc$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'resolve_ring_by_token',
        'seal_moment',
        'wipe_ring',
        'claim_ring_by_token',
        'rotate_ring_token',
        'revoke_ring_token',
        'issue_ring_invite',
        'link_ring_by_invite',
        'resolve_haven_by_token'
      )
  loop
    execute format('grant execute on function %s to authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$grant_client_rpc$;

do $grant_server_rpc$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'seal_finalize_atomic'
  loop
    execute format('grant execute on function %s to service_role', fn);
    execute format('revoke execute on function %s from anon, authenticated', fn);
  end loop;
end;
$grant_server_rpc$;
