-- 0013_scan_receipt_quota.sql
--
-- Per-user daily quota for the AI receipt scanner.
--
-- The scanner calls a billed external API (Gemini 2.5 Flash). On the free
-- tier the project-wide cap is 15 req/min and 1500 req/day. Without a
-- per-user gate any single authenticated user can loop scanReceipt and
-- exhaust the day's quota for every other user — cheap DoS.
--
-- Counter lives on profiles so we don't need a new table or external
-- store. consume_scan_quota() is the single atomic UPDATE: it rolls the
-- day forward when needed, increments the counter, and returns false
-- when the per-day cap is exceeded. SECURITY DEFINER + search_path
-- lock so RLS doesn't block the write.
--
-- Cap chosen: 20/day. Real users scan a receipt at a time, not in
-- loops; 20 is generous for a heavy day. Tune later if needed.

alter table public.profiles
  add column if not exists scan_count_day date not null default current_date,
  add column if not exists scan_count_today integer not null default 0;

create or replace function public.consume_scan_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_cap constant integer := 20;
  v_new_count integer;
begin
  update public.profiles
     set scan_count_today = case
           when scan_count_day < current_date then 1
           else scan_count_today + 1
         end,
         scan_count_day = current_date
   where id = p_user_id
   returning scan_count_today into v_new_count;

  if v_new_count is null then
    -- Profile row missing — shouldn't happen post-onboarding, but
    -- refuse rather than allow an unauthenticated scan slip through.
    return false;
  end if;

  return v_new_count <= v_daily_cap;
end;
$$;

-- Action calls this with the user's auth.uid(); never expose to anon.
revoke all on function public.consume_scan_quota(uuid) from public, anon;
grant execute on function public.consume_scan_quota(uuid) to authenticated;
