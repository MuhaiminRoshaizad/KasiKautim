-- =============================================================================
-- Item-claim split mode.
--
-- New flow: organizer creates a bill with line-items + members; each recipient
-- opens the link, picks the items they ordered, and pays only their share.
-- Tax/discount is allocated proportionally to each member's pre-tax subtotal.
-- Shared items split equally among everyone who claims them.
--
-- "Real money is real": paid_amount_cents snapshots at the moment a member
-- taps "I've paid", and never changes — even if other people's claims shift
-- later. amount_owed_cents continues to recompute live for non-paid members.
-- The gap is recoverable later by a settle-up UI; for now it's just stored.
-- =============================================================================

drop function if exists public.get_public_bill(text);
drop function if exists public.get_public_bill_members(text);
drop function if exists public.get_member_by_token(text);

-- Schema additions ----------------------------------------------------------

alter table public.bills
  add column if not exists split_mode text not null default 'equal'
    check (split_mode in ('equal', 'item')),
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists tax_cents bigint not null default 0 check (tax_cents >= 0),
  add column if not exists discount_cents bigint not null default 0 check (discount_cents >= 0);

alter table public.bill_members
  add column if not exists claimed_item_ids jsonb not null default '[]'::jsonb,
  add column if not exists paid_amount_cents bigint
    check (paid_amount_cents is null or paid_amount_cents >= 0);

-- bills.items shape:        [{"id":"abc123","name":"NASI PUTIH","price_cents":330}, ...]
-- bill_members.claimed_item_ids shape: ["abc123","def456"]

-- Public RPCs --------------------------------------------------------------

create or replace function public.get_public_bill(p_slug text)
returns table (
  bill_id                 uuid,
  slug                    text,
  title                   text,
  description             text,
  total_cents             bigint,
  currency                text,
  due_date                date,
  status                  text,
  organizer_display_name  text,
  organizer_duitnow_id    text,
  created_at              timestamptz,
  split_mode              text,
  items                   jsonb,
  tax_cents               bigint,
  discount_cents          bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select b.id, b.slug, b.title, b.description, b.total_cents, b.currency,
         b.due_date, b.status, p.display_name, p.duitnow_id, b.created_at,
         b.split_mode, b.items, b.tax_cents, b.discount_cents
  from public.bills b
  join public.profiles p on p.id = b.organizer_id
  where b.slug = p_slug;
$$;

create or replace function public.get_public_bill_members(p_slug text)
returns table (
  member_id           uuid,
  name                text,
  amount_owed_cents   bigint,
  paid                boolean,
  paid_at             timestamptz,
  claimed             boolean,
  claimed_item_ids    jsonb,
  paid_amount_cents   bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select bm.id, bm.name, bm.amount_owed_cents, bm.paid, bm.paid_at,
         (bm.claimed_device_hash is not null) as claimed,
         bm.claimed_item_ids, bm.paid_amount_cents
  from public.bill_members bm
  join public.bills b on b.id = bm.bill_id
  where b.slug = p_slug
  order by bm.created_at asc;
$$;

create or replace function public.get_member_by_token(p_token text)
returns table (
  member_id           uuid,
  bill_id             uuid,
  bill_slug           text,
  name                text,
  amount_owed_cents   bigint,
  paid                boolean,
  paid_at             timestamptz,
  claimed_item_ids    jsonb,
  paid_amount_cents   bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select bm.id, bm.bill_id, b.slug, bm.name, bm.amount_owed_cents,
         bm.paid, bm.paid_at, bm.claimed_item_ids, bm.paid_amount_cents
  from public.bill_members bm
  join public.bills b on b.id = bm.bill_id
  where bm.member_token = p_token;
$$;

-- Internal: recompute amount_owed_cents for every non-paid member of a bill.
-- Per-item share: floor(price / claimers); remainder absorbed by first claimer
-- (ordered by member.id) so per-item totals reconcile exactly. Tax/discount
-- net is then allocated proportionally to each member's pre-tax subtotal.

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

  update public.bill_members bm
     set amount_owed_cents = ms.subtotal_cents +
       case
         when v_total_subtotal > 0
         then (ms.subtotal_cents * v_net_charge) / v_total_subtotal
         else 0
       end
    from _tmp_member_subtotals ms
   where bm.id = ms.member_id
     and bm.paid = false;

  update public.bill_members
     set amount_owed_cents = 0
   where bill_id = p_bill_id
     and paid = false
     and id not in (select member_id from _tmp_member_subtotals);
end;
$$;

-- Public RPC: recipient toggles an item claim (own row only via token) -----

create or replace function public.toggle_item_claim(p_token text, p_item_id text)
returns table (
  member_id           uuid,
  claimed             boolean,
  amount_owed_cents   bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id     uuid;
  v_bill_id       uuid;
  v_split_mode    text;
  v_items         jsonb;
  v_was_paid      boolean;
  v_current       jsonb;
  v_was_claimed   boolean;
  v_new_claims    jsonb;
begin
  select bm.id, bm.bill_id, bm.paid, bm.claimed_item_ids
    into v_member_id, v_bill_id, v_was_paid, v_current
  from public.bill_members bm
  where bm.member_token = p_token;

  if v_member_id is null then
    raise exception 'member not found' using errcode = '22023';
  end if;

  if v_was_paid then
    raise exception 'member already paid' using errcode = '22023';
  end if;

  select b.split_mode, b.items into v_split_mode, v_items
  from public.bills b where b.id = v_bill_id;

  if v_split_mode <> 'item' then
    raise exception 'bill is not in item-mode' using errcode = '22023';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(v_items) as it
    where it->>'id' = p_item_id
  ) then
    raise exception 'item not in bill' using errcode = '22023';
  end if;

  v_was_claimed := v_current ? p_item_id;
  if v_was_claimed then
    v_new_claims := v_current - p_item_id;
  else
    v_new_claims := coalesce(v_current, '[]'::jsonb) || to_jsonb(p_item_id);
  end if;

  update public.bill_members
     set claimed_item_ids = v_new_claims
   where id = v_member_id;

  perform public._recompute_item_shares(v_bill_id);

  return query
    select bm.id, (bm.claimed_item_ids ? p_item_id), bm.amount_owed_cents
    from public.bill_members bm
    where bm.id = v_member_id;
end;
$$;

-- mark_member_paid now snapshots paid_amount_cents from current amount_owed.

create or replace function public.mark_member_paid(p_token text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id    uuid;
  v_already_paid boolean;
  v_amount_owed  bigint;
  v_paid_at      timestamptz;
begin
  select id, paid, amount_owed_cents, paid_at
    into v_member_id, v_already_paid, v_amount_owed, v_paid_at
  from public.bill_members
  where member_token = p_token;

  if v_member_id is null then
    raise exception 'member not found' using errcode = '22023';
  end if;

  if not v_already_paid then
    update public.bill_members
       set paid              = true,
           paid_at           = now(),
           paid_amount_cents = v_amount_owed
     where id = v_member_id
    returning paid_at into v_paid_at;

    insert into public.payment_events (bill_member_id, event_type)
    values (v_member_id, 'paid');
  end if;

  return v_paid_at;
end;
$$;

grant execute on function public.get_public_bill(text)         to anon, authenticated;
grant execute on function public.get_public_bill_members(text) to anon, authenticated;
grant execute on function public.get_member_by_token(text)     to anon, authenticated;
grant execute on function public.toggle_item_claim(text, text) to anon, authenticated;
