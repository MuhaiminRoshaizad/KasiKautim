-- 0015_recompute_includes_paid_members.sql
--
-- Fixes two related bugs surfaced by a real bill where the fair-share
-- column never updated after early payers got snapshotted:
--
--   1. _recompute_item_shares only updated members WHERE paid = false,
--      so any member who paid before all claims had settled stayed at a
--      stale snapshot. The report's "Δ Delta" column read 0 for everyone
--      because both fairShare and paid were just the same snapshot.
--
--   2. The organizer-as-diner flow snapshotted paid_amount_cents at
--      bill creation as if the organizer was the sole claimer of their
--      items. As soon as anyone else claimed the same items, the
--      organizer was overpaying on the books — but their amount_owed
--      never updated either (bug 1) so the gap was invisible.
--
-- Fix:
--   - Drop the paid = false filter on the UPDATE so amount_owed_cents
--     tracks live for every member, including paid ones. paid_amount_cents
--     for recipients still holds the snapshot from mark-paid time, so the
--     report's delta column finally surfaces the over/under.
--   - For is_organizer = true rows, also rewrite paid_amount_cents to
--     match the live amount_owed. Semantic justification: the organizer
--     paid the restaurant in one shot, not on a per-share basis — their
--     "personal contribution" floats with whatever their current fair
--     share works out to. This keeps their delta at 0 and prevents
--     phantom overpayment readings on the organizer row.
--
-- Also: grant execute on _recompute_item_shares to authenticated users
-- so the createBill action can call it directly after inserting the
-- organizer member row.

create or replace function public._recompute_item_shares(p_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tax_cents      bigint;
  v_discount_cents bigint;
  v_net_charge     bigint;
  v_total_subtotal bigint;
begin
  select tax_cents, discount_cents
    into v_tax_cents, v_discount_cents
  from public.bills where id = p_bill_id;

  v_net_charge := v_tax_cents - v_discount_cents;

  create temp table _tmp_member_subtotals on commit drop as
  with item_claimers as (
    select
      (it->>'id')                  as item_id,
      (it->>'price_cents')::bigint as item_price_cents,
      bm.id                        as member_id,
      row_number() over (partition by (it->>'id') order by bm.id) as rn,
      count(*)    over (partition by (it->>'id'))                 as claimer_count
    from public.bills b
    cross join lateral jsonb_array_elements(b.items) as it
    join public.bill_members bm on bm.bill_id = b.id
    where b.id = p_bill_id
      and bm.claimed_item_ids ? (it->>'id')
  ),
  per_item_split as (
    select
      member_id,
      case
        when rn = 1 then
          item_price_cents - ((claimer_count - 1) * (item_price_cents / claimer_count))
        else
          item_price_cents / claimer_count
      end as share_cents
    from item_claimers
  )
  select member_id, sum(share_cents)::bigint as subtotal_cents
  from per_item_split
  group by member_id;

  select coalesce(sum(subtotal_cents), 0) into v_total_subtotal
  from _tmp_member_subtotals;

  -- Update ALL members (paid + unpaid). amount_owed_cents tracks the
  -- live fair share regardless of payment status; recipients' paid
  -- snapshot lives in paid_amount_cents and stays put.
  -- Organizer's paid_amount_cents is special-cased to track the live
  -- share since they paid the restaurant, not a per-share transfer.
  update public.bill_members bm
     set amount_owed_cents = ms.subtotal_cents +
       case
         when v_total_subtotal > 0
         then (ms.subtotal_cents * v_net_charge) / v_total_subtotal
         else 0
       end,
       paid_amount_cents = case
         when bm.is_organizer then
           ms.subtotal_cents +
           case
             when v_total_subtotal > 0
             then (ms.subtotal_cents * v_net_charge) / v_total_subtotal
             else 0
           end
         else bm.paid_amount_cents
       end
    from _tmp_member_subtotals ms
   where bm.id = ms.member_id;

  -- Members with no current claims drop to 0 owed. Organizer's
  -- paid_amount also drops to 0 in this case (they currently contribute
  -- nothing item-wise; they may still owe for unclaimed items but that
  -- shows up in the bill-level "outstanding" line, not on their row).
  update public.bill_members
     set amount_owed_cents = 0,
         paid_amount_cents = case
           when is_organizer then 0
           else paid_amount_cents
         end
   where bill_id = p_bill_id
     and id not in (select member_id from _tmp_member_subtotals);
end;
$$;

-- Allow the createBill server action to call this directly after
-- inserting the organizer member, so the organizer's share is computed
-- by the same SQL logic that everyone else uses (no JS-side duplicate).
grant execute on function public._recompute_item_shares(uuid) to authenticated;
