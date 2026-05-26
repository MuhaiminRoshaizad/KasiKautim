-- =============================================================================
-- JomSplit — initial schema, triggers, RLS, and public RPC surface.
-- Paste into Supabase SQL editor and run once.
--
-- Access model:
--   * Organizer (authenticated) reads/writes own rows via standard RLS.
--   * Public (anon) NEVER touches tables directly. All public reads/writes go
--     through SECURITY DEFINER RPCs that take a slug or member_token as the
--     access credential. This way the access surface is enumerable
--     (grep "grant execute") and we can't accidentally leak rows via RLS.
-- =============================================================================

create extension if not exists "pgcrypto" with schema public;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  duitnow_id      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.bills (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  organizer_id    uuid not null references public.profiles(id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 100),
  description     text check (description is null or char_length(description) <= 500),
  total_cents     bigint not null check (total_cents >= 0),
  currency        text not null default 'MYR',
  due_date        date,
  status          text not null default 'open'
                    check (status in ('open', 'settled', 'archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index bills_organizer_idx on public.bills(organizer_id, created_at desc);

create table public.bill_members (
  id                    uuid primary key default gen_random_uuid(),
  bill_id               uuid not null references public.bills(id) on delete cascade,
  name                  text not null check (char_length(name) between 1 and 50),
  amount_owed_cents     bigint not null check (amount_owed_cents >= 0),
  member_token          text not null unique,
  paid                  boolean not null default false,
  paid_at               timestamptz,
  last_viewed_at        timestamptz,
  payment_proof_url     text,
  claimed_at            timestamptz,
  claimed_device_hash   text,
  created_at            timestamptz not null default now()
);

create index bill_members_bill_idx on public.bill_members(bill_id);

create table public.payment_events (
  id              uuid primary key default gen_random_uuid(),
  bill_member_id  uuid not null references public.bill_members(id) on delete cascade,
  event_type      text not null check (event_type in ('viewed', 'claimed', 'paid')),
  occurred_at     timestamptz not null default now()
);

create index payment_events_member_idx
  on public.payment_events(bill_member_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bills_set_updated_at
  before update on public.bills
  for each row execute function public.tg_set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- New-user trigger: auto-create profiles row on auth.users insert
-- -----------------------------------------------------------------------------

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
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- -----------------------------------------------------------------------------
-- Row-Level Security — organizer-only direct access. Anon cannot touch tables.
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.bills enable row level security;
alter table public.bill_members enable row level security;
alter table public.payment_events enable row level security;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy bills_select_own on public.bills
  for select using (auth.uid() = organizer_id);
create policy bills_insert_own on public.bills
  for insert with check (auth.uid() = organizer_id);
create policy bills_update_own on public.bills
  for update using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);
create policy bills_delete_own on public.bills
  for delete using (auth.uid() = organizer_id);

create policy bill_members_select_own on public.bill_members
  for select using (
    exists (
      select 1 from public.bills b
      where b.id = bill_members.bill_id and b.organizer_id = auth.uid()
    )
  );
create policy bill_members_insert_own on public.bill_members
  for insert with check (
    exists (
      select 1 from public.bills b
      where b.id = bill_members.bill_id and b.organizer_id = auth.uid()
    )
  );
create policy bill_members_update_own on public.bill_members
  for update using (
    exists (
      select 1 from public.bills b
      where b.id = bill_members.bill_id and b.organizer_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.bills b
      where b.id = bill_members.bill_id and b.organizer_id = auth.uid()
    )
  );
create policy bill_members_delete_own on public.bill_members
  for delete using (
    exists (
      select 1 from public.bills b
      where b.id = bill_members.bill_id and b.organizer_id = auth.uid()
    )
  );

create policy payment_events_select_own on public.payment_events
  for select using (
    exists (
      select 1
      from public.bill_members bm
      join public.bills b on b.id = bm.bill_id
      where bm.id = payment_events.bill_member_id and b.organizer_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Public RPC surface — anon-callable. slug / member_token are credentials.
-- Never returns the member_token to a non-claimer.
-- -----------------------------------------------------------------------------

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
  created_at              timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select b.id, b.slug, b.title, b.description, b.total_cents, b.currency,
         b.due_date, b.status, p.display_name, p.duitnow_id, b.created_at
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
  claimed             boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select bm.id, bm.name, bm.amount_owed_cents, bm.paid, bm.paid_at,
         (bm.claimed_device_hash is not null) as claimed
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
  paid_at             timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select bm.id, bm.bill_id, b.slug, bm.name, bm.amount_owed_cents,
         bm.paid, bm.paid_at
  from public.bill_members bm
  join public.bills b on b.id = bm.bill_id
  where bm.member_token = p_token;
$$;

-- Idempotent. Double-tap and retries land on the same row state.
create or replace function public.mark_member_paid(p_token text)
returns table (member_id uuid, paid boolean, paid_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_already_paid boolean;
begin
  select id, paid into v_member_id, v_already_paid
  from public.bill_members
  where member_token = p_token;

  if v_member_id is null then
    raise exception 'member not found' using errcode = '22023';
  end if;

  if not v_already_paid then
    update public.bill_members
       set paid = true, paid_at = now()
     where id = v_member_id;

    insert into public.payment_events (bill_member_id, event_type)
    values (v_member_id, 'paid');
  end if;

  return query
    select bm.id, bm.paid, bm.paid_at
    from public.bill_members bm
    where bm.id = v_member_id;
end;
$$;

create or replace function public.touch_member_viewed(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  update public.bill_members
     set last_viewed_at = now()
   where member_token = p_token
  returning id into v_member_id;

  if v_member_id is not null then
    insert into public.payment_events (bill_member_id, event_type)
    values (v_member_id, 'viewed');
  end if;
end;
$$;

-- Atomic claim. Returns the member_token only on success; null if the slot
-- was just claimed by another device (race-loser sees "pick another name").
create or replace function public.claim_member(
  p_slug        text,
  p_member_id   uuid,
  p_device_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  update public.bill_members bm
     set claimed_device_hash = p_device_hash,
         claimed_at = now()
    from public.bills b
   where bm.id = p_member_id
     and bm.bill_id = b.id
     and b.slug = p_slug
     and (bm.claimed_device_hash is null or bm.claimed_device_hash = p_device_hash)
  returning bm.member_token into v_token;

  if v_token is not null then
    insert into public.payment_events (bill_member_id, event_type)
    values (p_member_id, 'claimed');
  end if;

  return v_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants — anon can call the public RPCs, nothing else.
-- -----------------------------------------------------------------------------

grant execute on function public.get_public_bill(text)         to anon, authenticated;
grant execute on function public.get_public_bill_members(text) to anon, authenticated;
grant execute on function public.get_member_by_token(text)     to anon, authenticated;
grant execute on function public.mark_member_paid(text)        to anon, authenticated;
grant execute on function public.touch_member_viewed(text)     to anon, authenticated;
grant execute on function public.claim_member(text, uuid, text) to anon, authenticated;
