-- Run in Supabase SQL Editor when ring_invites pile up (keep newest pending per haven).
-- Safe: only touches unconsumed, uncancelled rows.

UPDATE public.ring_invites AS ri
SET cancelled_at = now()
WHERE ri.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY haven_id
        ORDER BY created_at DESC
      ) AS rn
    FROM public.ring_invites
    WHERE consumed_at IS NULL
      AND cancelled_at IS NULL
  ) ranked
  WHERE ranked.rn > 1
);

-- Verify (expect 0 or 1 pending row per haven):
-- SELECT haven_id, count(*) FROM ring_invites
-- WHERE consumed_at IS NULL AND cancelled_at IS NULL
-- GROUP BY haven_id;
