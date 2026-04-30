alter table public.moments
  add column if not exists release_at timestamptz;

comment on column public.moments.release_at is
  'Optional unlock timestamp for time capsule memories. Content remains locked before this time.';
