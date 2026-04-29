-- Expo push token registration. Push delivery is best-effort and builds on
-- public.notifications; no email or SMS is involved.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text,
  device_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists idx_push_tokens_user_id
  on public.push_tokens(user_id);

create index if not exists idx_push_tokens_last_seen_at
  on public.push_tokens(last_seen_at);

alter table public.push_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_select_own'
  ) then
    create policy push_tokens_select_own
      on public.push_tokens
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_insert_own'
  ) then
    create policy push_tokens_insert_own
      on public.push_tokens
      for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_update_own'
  ) then
    create policy push_tokens_update_own
      on public.push_tokens
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_delete_own'
  ) then
    create policy push_tokens_delete_own
      on public.push_tokens
      for delete
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_select_admin'
  ) then
    create policy push_tokens_select_admin
      on public.push_tokens
      for select
      using (public.is_admin());
  end if;
end $$;
