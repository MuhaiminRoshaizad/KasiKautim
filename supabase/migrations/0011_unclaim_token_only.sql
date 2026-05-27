-- 0011_unclaim_token_only.sql
--
-- The original unclaim_member RPC (0007) required the caller's
-- claimed_device_hash to match — meant to protect against a random
-- visitor with the slug booting someone else who had claimed via the
-- public picker.
--
-- But the device_hash cookie is ONLY minted during the picker-claim
-- code path (claim_member in actions/members.ts). Recipients who
-- arrive via a per-member shared link (?m=token) — the dominant
-- private-share flow — never went through the picker, so they don't
-- have the cookie. When they tap "Not you?", the action sees no
-- cookie and aborts with "Can't verify your claim on this device".
--
-- Resolution: the member_token IS the credential. Anyone holding the
-- token IS the legitimate recipient (96 bits of nanoid entropy
-- treated as a bearer secret per the original plan). Drop the
-- device_hash check entirely; trust the token.
--
-- Trade-off: someone who forwards their per-member link to another
-- person could see them unclaim. But that's the same trust model as
-- the link itself — if you share the link, you share the identity.
-- Acceptable.

create or replace function public.unclaim_member(
  p_token       text,
  p_device_hash text default null  -- kept for compatibility, ignored
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
     and paid = false
  returning id into v_member_id;

  return v_member_id is not null;
end;
$$;
