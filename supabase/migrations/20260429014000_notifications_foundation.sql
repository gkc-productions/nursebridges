-- Notifications foundation: in-app only, no email/SMS/push.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id
  on public.notifications(user_id);

create index if not exists idx_notifications_read_at
  on public.notifications(read_at);

create index if not exists idx_notifications_created_at_desc
  on public.notifications(created_at desc);

alter table public.notifications enable row level security;

create or replace function public.enforce_notification_read_only_update()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.entity_type is distinct from old.entity_type
    or new.entity_id is distinct from old.entity_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only read_at can be updated on notifications';
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_read_only_update on public.notifications;
create trigger notifications_read_only_update
before update on public.notifications
for each row
execute function public.enforce_notification_read_only_update();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_select_own'
  ) then
    create policy notifications_select_own
      on public.notifications
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_update_own_read_at'
  ) then
    create policy notifications_update_own_read_at
      on public.notifications
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_select_admin'
  ) then
    create policy notifications_select_admin
      on public.notifications
      for select
      using (public.is_admin());
  end if;
end $$;
