-- Plus cloud backup object storage (chunked uploads; 50 GB quota enforced in API).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cloud-backup',
  'cloud-backup',
  false,
  16777216,
  array['application/octet-stream']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
