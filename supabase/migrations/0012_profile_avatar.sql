-- 0012_profile_avatar.sql
--
-- Adds avatar_url to profiles, sourced from Google OAuth's
-- raw_user_meta_data on signup. Surfaces in /b/[slug] header so
-- recipients see who's billing them (small but personalizes the
-- transactional flow). Backfills existing rows from auth.users.
--
-- get_public_bill RPC also gets a new column so anonymous /b/[slug]
-- reads pick up the avatar via the same call.

alter table public.profiles
  add column if not exists avatar_url text;

-- Backfill existing profiles from Google's stored metadata.
update public.profiles p
   set avatar_url = coalesce(
         u.raw_user_meta_data->>'avatar_url',
         u.raw_user_meta_data->>'picture'
       )
  from auth.users u
 where p.id = u.id
   and p.avatar_url is null
   and (
     u.raw_user_meta_data ? 'avatar_url'
     or u.raw_user_meta_data ? 'picture'
   );

-- Updated trigger picks up avatar_url on new signups alongside display_name.
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  );
  return new;
end;
$$;

-- Refresh get_public_bill to include the avatar.
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
  organizer_avatar_url    text,
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
         b.due_date, b.status, p.display_name, p.duitnow_id, p.avatar_url,
         b.created_at, b.split_mode, b.items, b.tax_cents, b.discount_cents
  from public.bills b
  join public.profiles p on p.id = b.organizer_id
  where b.slug = p_slug;
$$;
