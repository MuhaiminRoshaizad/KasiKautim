-- =============================================================================
-- Payment audit: method, note, proof image upload.
--
-- "Vibes-based 'I've paid'" becomes a real audit record. Three new fields
-- snapshot at the moment of payment alongside paid_amount_cents:
--   payment_method     - cash / duitnow / tng / maybank2u / other
--   payment_note       - optional free-text reference (<=120 chars)
--   payment_proof_url  - relative path into the new private Storage bucket
--                        ('payment-proofs'); rendered via signed URLs only
-- All frozen with the rest at payment — later claim shifts don't rewrite.
--
-- Also adds payment_events to the supabase_realtime publication so the
-- report page's live activity timeline can subscribe to INSERT events.
-- =============================================================================

-- New columns ------------------------------------------------------------------

alter table public.bill_members
  add column if not exists payment_method text
    check (payment_method is null or payment_method in
      ('cash', 'duitnow', 'tng', 'maybank2u', 'other')),
  add column if not exists payment_note text
    check (payment_note is null or char_length(payment_note) <= 120);
-- payment_proof_url already exists from 0001_init.sql; finally used.

-- Realtime publication for payment_events --------------------------------------

alter publication supabase_realtime add table public.payment_events;

-- Extended mark_member_paid ----------------------------------------------------

drop function if exists public.mark_member_paid(text);

create or replace function public.mark_member_paid(
  p_token      text,
  p_method     text default null,
  p_note       text default null,
  p_proof_url  text default null
)
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
           paid_amount_cents = v_amount_owed,
           payment_method    = p_method,
           payment_note      = p_note,
           payment_proof_url = p_proof_url
     where id = v_member_id
    returning paid_at into v_paid_at;

    insert into public.payment_events (bill_member_id, event_type)
    values (v_member_id, 'paid');
  end if;

  return v_paid_at;
end;
$$;

grant execute on function public.mark_member_paid(text, text, text, text)
  to anon, authenticated;

-- Storage bucket for payment proofs --------------------------------------------
-- Private bucket. Uploads go through the server action (service-role); reads
-- happen via short-lived signed URLs generated server-side on the report
-- page. No anon/authenticated SELECT or INSERT policy is needed because all
-- access flows through our server-side code.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
