-- 0014_bill_member_is_organizer.sql
--
-- Marks the tukang bayar (organizer) as a member of their own bill so
-- the system can reflect the reality that in ~90% of cases the person
-- paying the restaurant is also a diner. Today the only link between a
-- bill and its organizer is bills.organizer_id; bill_members is a
-- separate freeform list of names. Users who want their own share
-- tracked have to type their own name, which then shows up in the
-- "chase" list with no auto-paid signal.
--
-- This migration adds is_organizer as an opt-in flag that the create
-- action sets when the "Include myself in the split" checkbox is on.
-- Existing rows stay false — old bills render exactly as before.
--
-- Refreshes get_public_bill_members RPC to surface the flag so /b/[slug]
-- can filter the organizer row out of the claim-your-name picker (no
-- one else should be able to claim the organizer's slot).

alter table public.bill_members
  add column if not exists is_organizer boolean not null default false;

-- Enforce at most one organizer member row per bill. Partial unique
-- index on (bill_id) where is_organizer = true — old rows with
-- is_organizer = false are unaffected.
create unique index if not exists bill_members_one_organizer_per_bill
  on public.bill_members (bill_id)
  where is_organizer = true;

-- Refresh the public RPC to include is_organizer. Drop + recreate
-- because the return signature changes — anon clients reading the old
-- shape would error if we just added the column without re-publishing.
drop function if exists public.get_public_bill_members(text);

create or replace function public.get_public_bill_members(p_slug text)
returns table (
  member_id           uuid,
  name                text,
  amount_owed_cents   bigint,
  paid                boolean,
  paid_at             timestamptz,
  claimed             boolean,
  claimed_item_ids    jsonb,
  paid_amount_cents   bigint,
  is_organizer        boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select bm.id, bm.name, bm.amount_owed_cents, bm.paid, bm.paid_at,
         (bm.claimed_device_hash is not null) as claimed,
         bm.claimed_item_ids, bm.paid_amount_cents, bm.is_organizer
  from public.bill_members bm
  join public.bills b on b.id = bm.bill_id
  where b.slug = p_slug
  order by bm.is_organizer desc, bm.created_at asc;
$$;

grant execute on function public.get_public_bill_members(text) to anon, authenticated;
