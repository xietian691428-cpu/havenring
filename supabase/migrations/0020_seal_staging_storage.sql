-- Seal staging: inline DB for small payloads, object storage for large media.

alter table public.seal_staging
  alter column ciphertext drop not null;

alter table public.seal_staging
  add column if not exists storage_path text null,
  add column if not exists byte_size integer not null default 0,
  add column if not exists storage_backend text not null default 'db';

alter table public.seal_staging
  drop constraint if exists seal_staging_storage_backend_check;

alter table public.seal_staging
  add constraint seal_staging_storage_backend_check
  check (storage_backend in ('db', 'object'));

create index if not exists seal_staging_storage_path_idx
  on public.seal_staging (storage_path)
  where storage_path is not null;

alter table public.seal_telemetry_events
  add column if not exists byte_size integer null;

alter table public.seal_telemetry_events
  drop constraint if exists seal_telemetry_events_endpoint_check;

-- Allow staging telemetry endpoint (application-enforced historically).
comment on column public.seal_staging.storage_backend is 'db = ciphertext column; object = Supabase Storage blob';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seal-staging',
  'seal-staging',
  false,
  2097152,
  array['application/octet-stream']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Optional DB-side expiry purge (rows only; storage objects cleaned by cron API).
create or replace function public.purge_expired_seal_staging_rows()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.seal_staging where expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_expired_seal_staging_rows() from public;
grant execute on function public.purge_expired_seal_staging_rows() to service_role;
