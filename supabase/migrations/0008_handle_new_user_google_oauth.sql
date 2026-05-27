-- 0008_handle_new_user_google_oauth.sql
--
-- The new-user trigger in 0001_init.sql checked raw_user_meta_data->>'name'
-- which is the standard JWT name claim — but Supabase normalizes Google
-- OAuth profile data under 'full_name' (with 'name' as fallback). After
-- switching to Google sign-in (commit d63f80d), new users were silently
-- falling through to the email-prefix branch ("aminmuhaimin192" instead
-- of "Muhaimin Roshaizad").
--
-- Update the trigger to coalesce both keys, then backfill any existing
-- profile that still has the email-prefix display name AND whose auth
-- row has the richer metadata available.

create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

-- Backfill: if a profile's display_name still matches the email prefix
-- AND the auth row has a richer 'full_name'/'name' in metadata, lift it.
-- Safe because the user can still override via /dashboard/settings.
update public.profiles p
   set display_name = coalesce(
         u.raw_user_meta_data->>'full_name',
         u.raw_user_meta_data->>'name',
         p.display_name
       )
  from auth.users u
 where p.id = u.id
   and p.display_name = split_part(u.email, '@', 1)
   and (
     u.raw_user_meta_data ? 'full_name'
     or u.raw_user_meta_data ? 'name'
   );
