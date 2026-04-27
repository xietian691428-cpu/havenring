-- Allow one pinned moment per ring for vault highlighting.
alter table public.rings
  add column if not exists pinned_moment_id uuid references public.moments (id) on delete set null;

create index if not exists rings_pinned_moment_idx on public.rings (pinned_moment_id);
