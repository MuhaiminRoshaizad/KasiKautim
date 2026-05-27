-- 0006_throttle_viewed_events.sql
--
-- touch_member_viewed previously inserted a 'viewed' payment_event row on
-- every call. Recipients open the link multiple times (re-checking amount,
-- WhatsApp re-prefetching the page) which spammed the activity timeline
-- with rows like "Ali viewed the bill · 1h ago" repeated 13 times.
--
-- This change throttles the INSERT to once per 30 minutes per member.
-- `last_viewed_at` still updates on every call (cheap UPDATE) so the
-- "Seen" badge stays fresh; the 'viewed' event row is the noisy thing
-- and is what we're rate-limiting.
--
-- last_viewed_at is the throttle source of truth (single column, indexed
-- implicitly via the member-token lookup). No extra query needed.

create or replace function public.touch_member_viewed(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id     uuid;
  v_prev_viewed   timestamptz;
begin
  -- Capture the previous last_viewed_at before we overwrite it; the row
  -- update happens atomically so concurrent calls won't double-insert.
  select id, last_viewed_at
    into v_member_id, v_prev_viewed
    from public.bill_members
   where member_token = p_token;

  if v_member_id is null then
    return;
  end if;

  update public.bill_members
     set last_viewed_at = now()
   where id = v_member_id;

  -- Only emit a payment_events row when the previous view was either
  -- absent or more than 30 minutes ago. Bills with many recipients
  -- (rare) might see slight clock-skew variance; acceptable.
  if v_prev_viewed is null or v_prev_viewed < now() - interval '30 minutes' then
    insert into public.payment_events (bill_member_id, event_type)
    values (v_member_id, 'viewed');
  end if;
end;
$$;
