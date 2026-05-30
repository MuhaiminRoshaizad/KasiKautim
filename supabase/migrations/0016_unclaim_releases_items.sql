-- 0016_unclaim_releases_items.sql
--
-- Closes a UX leak surfaced by real user testing: a recipient who
-- picks the wrong name, taps a few items, then hits browser BACK
-- (instead of "Not you?") leaves their tapped items glued to the
-- abandoned member row. The slot itself goes back to "open" via the
-- old unclaim_member, but claimed_item_ids was never cleared, so
-- amount_owed_cents stayed inflated and the items showed as already-
-- claimed to the next person who tried to pick the same name.
--
-- Fix:
--   1. Also reset claimed_item_ids to '[]' on unclaim so the slot is
--      fully fresh for the next claimer.
--   2. Recompute the bill's per-member shares after clearing, so
--      amount_owed_cents drops back to 0 for the released member and
--      other members' shares reflect the freed item.
--
-- The fix only addresses the "Not you?" path — back-button-mid-pick
-- still leaks until the user actively unclaims. UX nudge banner copy
-- handles that side in the app code.

create or replace function public.unclaim_member(
  p_token       text,
  p_device_hash text default null  -- kept for backwards-compat, ignored
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_bill_id   uuid;
begin
  update public.bill_members
     set claimed_device_hash = null,
         claimed_at          = null,
         claimed_item_ids    = '[]'::jsonb
   where member_token = p_token
     and paid = false
  returning id, bill_id into v_member_id, v_bill_id;

  if v_member_id is null then
    return false;
  end if;

  -- Recompute every member's fair share so the released items free
  -- up correctly. Without this, amount_owed_cents stays at the
  -- stale snapshot and other members' shares don't reflect the
  -- freed-up item until someone else triggers a recompute.
  perform public._recompute_item_shares(v_bill_id);

  return true;
end;
$$;
