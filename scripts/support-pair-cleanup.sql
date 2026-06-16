-- Haven Pair support cleanup (run in Supabase SQL Editor).
-- Use after failed Join tests left split Havens or piled-up ring_invites.
-- Safe order: diagnose → cancel duplicate invites → remove stray memberships → verify.

-- ── 1. Diagnose ─────────────────────────────────────────────────────────────

SELECT h.id AS haven_id,
  (SELECT count(*) FROM haven_members hm WHERE hm.haven_id = h.id) AS members,
  (SELECT count(*) FROM user_nfc_rings r WHERE r.haven_id = h.id AND r.is_active) AS active_rings
FROM havens h
ORDER BY h.created_at DESC
LIMIT 10;

SELECT haven_id, count(*) AS pending_invites
FROM ring_invites
WHERE consumed_at IS NULL AND cancelled_at IS NULL
GROUP BY haven_id
ORDER BY pending_invites DESC;

-- Users stuck in more than one Haven (partial join failure)
SELECT hm.user_id, count(DISTINCT hm.haven_id) AS haven_count, array_agg(DISTINCT hm.haven_id) AS haven_ids
FROM haven_members hm
GROUP BY hm.user_id
HAVING count(DISTINCT hm.haven_id) > 1;

-- ── 2. Cancel duplicate pending invites (keep newest per haven) ───────────

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

-- ── 3. Remove stray memberships (ring lives in a different Haven) ─────────
-- Keeps membership only where the user's active ring is bound.

DELETE FROM public.haven_members hm
WHERE EXISTS (
  SELECT 1
  FROM public.user_nfc_rings r
  WHERE r.user_id = hm.user_id
    AND r.is_active = true
    AND r.haven_id IS DISTINCT FROM hm.haven_id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.user_nfc_rings r
  WHERE r.user_id = hm.user_id
    AND r.is_active = true
    AND r.haven_id = hm.haven_id
);

-- ── 4. Verify (expect ≤1 pending invite per haven; no multi-haven users) ──

SELECT haven_id, count(*) AS pending_invites
FROM ring_invites
WHERE consumed_at IS NULL AND cancelled_at IS NULL
GROUP BY haven_id;

SELECT hm.user_id, count(DISTINCT hm.haven_id) AS haven_count
FROM haven_members hm
GROUP BY hm.user_id
HAVING count(DISTINCT hm.haven_id) > 1;

SELECT h.id,
  (SELECT count(*) FROM haven_members hm WHERE hm.haven_id = h.id) AS members,
  (SELECT count(*) FROM user_nfc_rings r WHERE r.haven_id = h.id AND r.is_active) AS active_rings
FROM havens h
ORDER BY h.created_at DESC
LIMIT 10;
