-- Audit: which account created each moment (E2EE vault payload unchanged).
alter table public.moments
  add column if not exists created_by_user_id uuid references auth.users (id) on delete set null;

comment on column public.moments.created_by_user_id is
  'Auth user that created this row; optional for legacy rows.';

update public.moments m
set created_by_user_id = r.owner_id
from public.rings r
where m.ring_id = r.id
  and m.created_by_user_id is null
  and r.owner_id is not null;
