-- Phase B: Profiles -> auth.users alignment
-- Goal: profiles.id becomes the user id (FK to auth.users.id) and auto-creates on signup
-- Safe / idempotent where possible.

-- 1) Ensure pgcrypto (uuid helpers)
create extension if not exists pgcrypto;

-- 2) Ensure profiles.id is uuid + primary key already (your dump shows it is)
-- 3) Add FK: profiles.id references auth.users(id)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users(id)
      on delete cascade;
  end if;
end $$;

-- 4) Helpful updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'profiles_set_updated_at'
  ) then
    create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- 5) Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    'patient',
    coalesce(new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'phone', null)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
  end if;
end $$;

-- 6) RLS baseline (optional but recommended)
alter table public.profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Profiles are viewable by owner') then
    create policy "Profiles are viewable by owner"
      on public.profiles
      for select
      using (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='Profiles are updatable by owner') then
    create policy "Profiles are updatable by owner"
      on public.profiles
      for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;
