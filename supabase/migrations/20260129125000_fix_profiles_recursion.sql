-- Fix RLS recursion for profiles admin policies (idempotent)

-- Helper: check admin without RLS recursion
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

DO $$
BEGIN
  execute 'drop policy if exists "profiles_select_admin" on public.profiles';
  execute 'drop policy if exists "profiles_update_admin" on public.profiles';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_admin'
  ) then
    create policy profiles_select_admin
      on public.profiles
      for select
      using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_admin'
  ) then
    create policy profiles_update_admin
      on public.profiles
      for update
      using (public.is_admin());
  end if;
END $$;
