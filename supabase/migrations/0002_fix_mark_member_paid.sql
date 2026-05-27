-- =============================================================================
-- Fix: mark_member_paid hit "column reference 'paid' is ambiguous" at runtime.
--
-- Cause: in plpgsql, RETURNS TABLE OUT parameters become variables in scope
-- inside the function body. The original function declared
--   RETURNS TABLE (member_id uuid, paid boolean, paid_at timestamptz)
-- so `paid` and `paid_at` shadowed the same-named columns on bill_members
-- inside the RETURN QUERY clause — even with `bm.` qualification the resolver
-- couldn't disambiguate. SQL-language functions (get_member_by_token,
-- get_public_bill, ...) don't have this problem because they don't expose
-- OUT params as variables.
--
-- Fix: the markPaid server action only needs the paid_at timestamp. Drop the
-- TABLE return and return a single timestamptz instead — sidesteps the
-- shadowing entirely and simplifies the JS-side parsing.
--
-- Bonus: tg_set_updated_at had a mutable search_path flagged by Supabase's
-- security advisor. SET search_path = public, same as the other functions.
-- =============================================================================

drop function if exists public.mark_member_paid(text);

create or replace function public.mark_member_paid(p_token text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id    uuid;
  v_already_paid boolean;
  v_paid_at      timestamptz;
begin
  select id, paid, paid_at
    into v_member_id, v_already_paid, v_paid_at
  from public.bill_members
  where member_token = p_token;

  if v_member_id is null then
    raise exception 'member not found' using errcode = '22023';
  end if;

  if not v_already_paid then
    update public.bill_members
       set paid = true, paid_at = now()
     where id = v_member_id
    returning paid_at into v_paid_at;

    insert into public.payment_events (bill_member_id, event_type)
    values (v_member_id, 'paid');
  end if;

  return v_paid_at;
end;
$$;

grant execute on function public.mark_member_paid(text) to anon, authenticated;

-- Resolve function_search_path_mutable advisor warning on this trigger fn.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
