-- 0010_payment_method_real_methods.sql
--
-- The original payment_method enum in 0005 mixed a national payment rail
-- (DuitNow), a specific e-wallet (TNG), and one bank's online portal
-- (Maybank2u) — confusing and excluded CIMB/Public/RHB users entirely.
-- User reported that in real Malaysian split-bill behavior, the actual
-- buckets are:
--
--   - Cash             handed over physically
--   - Online transfer  bank app to bank app (DuitNow rail under the hood)
--   - DuitNow QR       scanned a QR code
--   - E-wallet         TNG / GrabPay / Boost / etc.
--   - Other            anything else (cheque, foreign transfer, etc.)
--
-- This migration replaces the CHECK constraint, drops the old values from
-- existing rows, and remaps:
--   duitnow   -> online_transfer  (covered by both buckets; bank app is more common)
--   tng       -> ewallet
--   maybank2u -> online_transfer
--   cash, other -> unchanged

-- 1. Backfill existing rows BEFORE swapping the CHECK constraint, or the
--    constraint validation will block the update.
update public.bill_members
   set payment_method = case payment_method
         when 'duitnow'   then 'online_transfer'
         when 'tng'       then 'ewallet'
         when 'maybank2u' then 'online_transfer'
         else payment_method
       end
 where payment_method in ('duitnow', 'tng', 'maybank2u');

-- 2. Swap the CHECK constraint to the new value set. Postgres requires
--    dropping the existing constraint first (named auto by 0005 — we drop
--    by column-level constraint reference via alter table ... drop constraint).
do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
    from pg_constraint
   where conrelid = 'public.bill_members'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%payment_method%';

  if v_constraint_name is not null then
    execute format(
      'alter table public.bill_members drop constraint %I',
      v_constraint_name
    );
  end if;
end$$;

alter table public.bill_members
  add constraint bill_members_payment_method_check
  check (payment_method is null or payment_method in
    ('cash', 'online_transfer', 'duitnow_qr', 'ewallet', 'other'));
