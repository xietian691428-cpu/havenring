create or replace function public.seal_finalize_atomic(
  p_user_id uuid,
  p_ticket_hash text,
  p_draft_ids jsonb,
  p_draft_payloads jsonb
)
returns table(saved_ids jsonb, sealed_by_ring_uid text, consumed_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ticket public.seal_tickets%rowtype;
  v_ring_id uuid;
  v_haven_id uuid;
  v_item jsonb;
  v_item_id text;
  v_now timestamptz := now();
  v_expected_ids text;
  v_input_ids text;
  v_payload_ids text;
begin
  if p_user_id is null or coalesce(p_ticket_hash, '') = '' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if jsonb_typeof(p_draft_ids) <> 'array' or jsonb_array_length(p_draft_ids) = 0 then
    raise exception 'missing_draft_ids' using errcode = '22023';
  end if;

  if jsonb_typeof(p_draft_payloads) <> 'array'
    or jsonb_array_length(p_draft_payloads) <> jsonb_array_length(p_draft_ids) then
    raise exception 'missing_draft_payloads' using errcode = '22023';
  end if;

  select *
  into v_ticket
  from public.seal_tickets st
  where st.ticket_hash = p_ticket_hash
    and st.user_id = p_user_id
  for update;

  if v_ticket.id is null then
    raise exception 'invalid_ticket' using errcode = 'P0001';
  end if;
  if v_ticket.consumed_at is not null then
    raise exception 'ticket_already_used' using errcode = 'P0001';
  end if;
  if v_ticket.expires_at <= v_now then
    raise exception 'ticket_expired' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(value order by value)::text, '[]')
  into v_expected_ids
  from jsonb_array_elements_text(v_ticket.draft_ids);

  select coalesce(jsonb_agg(value order by value)::text, '[]')
  into v_input_ids
  from jsonb_array_elements_text(p_draft_ids);

  if v_expected_ids <> v_input_ids then
    raise exception 'draft_set_mismatch' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(value order by value)::text, '[]')
  into v_payload_ids
  from (
    select (elem->>'id') as value
    from jsonb_array_elements(p_draft_payloads) elem
  ) s;

  if v_payload_ids <> v_input_ids then
    raise exception 'draft_payload_mismatch' using errcode = 'P0001';
  end if;

  select r.id, r.haven_id
  into v_ring_id, v_haven_id
  from public.rings r
  where r.owner_id = p_user_id
    and r.status = 'active'
  order by r.claimed_at desc nulls last, r.created_at desc
  limit 1;

  if v_ring_id is null then
    raise exception 'no_active_ring' using errcode = 'P0001';
  end if;

  for v_item in select value from jsonb_array_elements(p_draft_payloads)
  loop
    v_item_id := coalesce(v_item->>'id', '');
    if v_item_id = '' then
      raise exception 'invalid_payload_id' using errcode = 'P0001';
    end if;

    insert into public.moments (
      id,
      haven_id,
      ring_id,
      created_by_user_id,
      text,
      image_url,
      audio_url,
      encrypted_vault,
      iv,
      is_sealed,
      sealed_at,
      release_at,
      content_sha256
    )
    values (
      v_item_id::uuid,
      v_haven_id,
      v_ring_id,
      p_user_id,
      null,
      null,
      null,
      encode(convert_to(v_item::text, 'utf8'), 'base64'),
      replace(gen_random_uuid()::text, '-', ''),
      true,
      v_now,
      case
        when coalesce((v_item->>'releaseAt')::bigint, 0) > 0
          then to_timestamp(((v_item->>'releaseAt')::bigint)::double precision / 1000.0)
        else null
      end,
      encode(digest(v_item::text, 'sha256'), 'hex')
    )
    on conflict (id) do update
      set haven_id = excluded.haven_id,
          ring_id = excluded.ring_id,
          created_by_user_id = excluded.created_by_user_id,
          encrypted_vault = excluded.encrypted_vault,
          iv = excluded.iv,
          is_sealed = true,
          sealed_at = excluded.sealed_at,
          release_at = excluded.release_at,
          content_sha256 = excluded.content_sha256;
  end loop;

  update public.seal_tickets st
  set consumed_at = v_now
  where st.id = v_ticket.id
    and st.consumed_at is null;

  if not found then
    raise exception 'ticket_commit_race' using errcode = 'P0001';
  end if;

  return query
  select p_draft_ids, coalesce(v_ticket.ring_uid_hash, ''), v_now;
end
$$;
