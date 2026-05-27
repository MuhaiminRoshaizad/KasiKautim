-- 0007_unclaim_member.sql
--
-- Recipients who tap the wrong name on /b/[slug] are currently locked
-- into that slot via claimed_device_hash; the real owner of that name
-- is locked OUT. There's no escape hatch in the UI.
--
-- This RPC clears claimed_device_hash so a different device (or the
-- same device, picking again) can re-claim. Three safety bars:
--   1. Only the device that originally claimed can unclaim (compare
--      hash) — stops a random visitor from booting someone else.
--   2. Already-paid slots cannot be unclaimed — the payment record
--      survives but the slot stays bound so the data stays consistent.
--      User-facing copy says "Contact tukang bayar to fix" for this case.
--   3. Inserts a 'claimed' event into payment_events with a tag-like
--      detail? Skip — payment_events.event_type is constrained to
--      {viewed, claimed, paid}; an 'unclaimed' event would require a
--      schema change. We just clear the row and let the timeline silently
--      reflect the absence.
--
-- Returns boolean: true if unclaim succeeded, false otherwise (race-lost,
-- paid, wrong device).

create or replace function public.unclaim_member(
  p_token       text,
  p_device_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  update public.bill_members
     set claimed_device_hash = null,
         claimed_at = null
   where member_token = p_token
     and claimed_device_hash = p_device_hash
     and paid = false
  returning id into v_member_id;

  return v_member_id is not null;
end;
$$;

grant execute on function public.unclaim_member(text, text) to anon, authenticated;
