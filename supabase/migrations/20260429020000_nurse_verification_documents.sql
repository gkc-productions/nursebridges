-- Nurse verification document metadata and private storage policies.

insert into storage.buckets (id, name, public)
values ('nurse-verification', 'nurse-verification', false)
on conflict (id) do update set public = false;

create table if not exists public.nurse_verification_documents (
  id uuid primary key default gen_random_uuid(),
  nurse_user_id uuid not null references public.profiles(id) on delete cascade,
  storage_bucket text not null default 'nurse-verification',
  storage_path text not null,
  document_type text not null,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique (nurse_user_id, storage_path)
);

create index if not exists idx_nurse_verification_documents_nurse_user_id
  on public.nurse_verification_documents(nurse_user_id);

create index if not exists idx_nurse_verification_documents_status
  on public.nurse_verification_documents(status);

create index if not exists idx_nurse_verification_documents_created_at_desc
  on public.nurse_verification_documents(created_at desc);

alter table public.nurse_verification_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nurse_verification_documents_status_check'
      and conrelid = 'public.nurse_verification_documents'::regclass
  ) then
    alter table public.nurse_verification_documents
      add constraint nurse_verification_documents_status_check
      check (status in ('pending','approved','rejected'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nurse_verification_documents'
      and policyname = 'nurse_verification_documents_select_own'
  ) then
    create policy nurse_verification_documents_select_own
      on public.nurse_verification_documents
      for select
      using (nurse_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nurse_verification_documents'
      and policyname = 'nurse_verification_documents_insert_own_pending'
  ) then
    create policy nurse_verification_documents_insert_own_pending
      on public.nurse_verification_documents
      for insert
      with check (
        nurse_user_id = auth.uid()
        and storage_bucket = 'nurse-verification'
        and storage_path like auth.uid()::text || '/%'
        and status = 'pending'
        and reviewed_by is null
        and reviewed_at is null
        and rejection_reason is null
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nurse_verification_documents'
      and policyname = 'nurse_verification_documents_select_admin'
  ) then
    create policy nurse_verification_documents_select_admin
      on public.nurse_verification_documents
      for select
      using (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nurse_verification_documents'
      and policyname = 'nurse_verification_documents_update_admin'
  ) then
    create policy nurse_verification_documents_update_admin
      on public.nurse_verification_documents
      for update
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'nurse_verification_upload_own'
  ) then
    create policy nurse_verification_upload_own
      on storage.objects
      for insert
      with check (
        bucket_id = 'nurse-verification'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'nurse_verification_read_own'
  ) then
    create policy nurse_verification_read_own
      on storage.objects
      for select
      using (
        bucket_id = 'nurse-verification'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'nurse_verification_read_admin'
  ) then
    create policy nurse_verification_read_admin
      on storage.objects
      for select
      using (
        bucket_id = 'nurse-verification'
        and public.is_admin()
      );
  end if;
end $$;
