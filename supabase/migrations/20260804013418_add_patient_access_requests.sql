create table public.patient_access_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 80),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) between 7 and 32),
  service_area text not null check (char_length(service_area) between 2 and 80),
  requester_type text not null default 'patient_or_family'
    check (requester_type in ('patient', 'family', 'patient_or_family')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'invited', 'closed')),
  source text not null default 'patient_ios_app'
    check (char_length(source) between 2 and 64),
  contact_consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patient_access_requests is
  'Minimal closed-beta contact requests. Care details and medical information are prohibited.';

create index patient_access_requests_status_created_at_idx
  on public.patient_access_requests (status, created_at desc);

create unique index patient_access_requests_open_email_idx
  on public.patient_access_requests (lower(email))
  where status in ('new', 'contacted', 'invited');

alter table public.patient_access_requests enable row level security;

revoke all on table public.patient_access_requests from public, anon, authenticated;
grant select, insert, update on table public.patient_access_requests to service_role;
