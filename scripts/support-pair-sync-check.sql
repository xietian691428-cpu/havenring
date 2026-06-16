-- Pair sync diagnostics — run in Supabase SQL Editor
-- Pair sync does NOT use a pair_bundles table; it reads public.moments.

-- 1) Per-haven member + ring counts (expect ONE haven with members=2, rings=2)
select
  h.id as haven_id,
  count(distinct hm.user_id) as members,
  count(distinct unr.id) filter (where unr.is_active) as active_rings
from public.havens h
left join public.haven_members hm on hm.haven_id = h.id
left join public.user_nfc_rings unr on unr.haven_id = h.id
group by h.id
order by members desc, active_rings desc;

-- 2) Sealed moments available for Pair import (what /api/sync/pair-bundles returns)
select
  m.id,
  m.haven_id,
  m.created_by_user_id,
  m.ring_id,
  m.is_sealed,
  m.created_at,
  length(m.encrypted_vault) as vault_bytes
from public.moments m
where m.is_sealed = true
  and m.haven_id is not null
order by m.created_at desc
limit 20;

-- 3) Same rows via ops view (if migration 0025 applied)
-- select * from public.pair_bundles order by created_at desc limit 20;

-- 4) Users in multiple havens (often blocks pairActive)
select
  hm.user_id,
  count(distinct hm.haven_id) as haven_count,
  array_agg(distinct hm.haven_id) as haven_ids
from public.haven_members hm
group by hm.user_id
having count(distinct hm.haven_id) > 1;
