-- Structured residence and transportation intake for care requests.
-- Exact residence/access details live outside public.jobs so an approved nurse
-- browsing open work cannot see them before assignment.

alter table public.jobs
  add column if not exists service_city text,
  add column if not exists service_state text;

create table if not exists public.job_logistics (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  residence_type text not null,
  street_address text not null,
  unit text,
  building_name text,
  city text not null,
  state text not null,
  postal_code text not null,
  stairs text not null default 'none',
  elevator_available boolean,
  meeting_point text,
  parking_notes text,
  arrival_instructions text,
  mobility_aids text[] not null default '{}',
  mobility_notes text,
  onsite_contact_name text,
  onsite_contact_relationship text,
  onsite_contact_phone text,
  transportation_mode text not null,
  transportation_provider text,
  pickup_time timestamptz,
  return_plan text not null,
  transportation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_logistics_residence_type_check
    check (residence_type in ('house', 'apartment', 'assisted_living', 'other')),
  constraint job_logistics_stairs_check
    check (stairs in ('none', 'entrance', 'interior', 'both', 'unknown')),
  constraint job_logistics_transportation_mode_check
    check (transportation_mode in ('patient_arranged', 'family_friend', 'rideshare', 'medical_transport', 'public_transit', 'other', 'not_arranged')),
  constraint job_logistics_return_plan_check
    check (return_plan in ('round_trip', 'one_way', 'family_pickup', 'other', 'not_arranged')),
  constraint job_logistics_state_check check (char_length(state) = 2),
  constraint job_logistics_mobility_aids_check
    check (mobility_aids <@ array['none', 'cane', 'walker', 'wheelchair', 'scooter', 'other']::text[]),
  constraint job_logistics_field_lengths_check check (
    char_length(street_address) <= 200
    and char_length(coalesce(unit, '')) <= 50
    and char_length(coalesce(building_name, '')) <= 120
    and char_length(city) <= 100
    and char_length(postal_code) <= 10
    and char_length(coalesce(meeting_point, '')) <= 300
    and char_length(coalesce(parking_notes, '')) <= 500
    and char_length(coalesce(arrival_instructions, '')) <= 500
    and char_length(coalesce(mobility_notes, '')) <= 1000
    and char_length(coalesce(onsite_contact_name, '')) <= 120
    and char_length(coalesce(onsite_contact_relationship, '')) <= 80
    and char_length(coalesce(onsite_contact_phone, '')) <= 30
    and char_length(coalesce(transportation_provider, '')) <= 120
    and char_length(coalesce(transportation_notes, '')) <= 1000
  )
);

create index if not exists idx_jobs_service_area
  on public.jobs(service_state, service_city);

create index if not exists idx_job_logistics_transportation_mode
  on public.job_logistics(transportation_mode);

alter table public.job_logistics enable row level security;

revoke all on table public.job_logistics from anon;
grant select, insert, update on table public.job_logistics to authenticated;

drop policy if exists job_logistics_select_patient on public.job_logistics;
create policy job_logistics_select_patient
  on public.job_logistics
  for select
  using (public.patient_owns_job(job_id));

drop policy if exists job_logistics_select_assigned_nurse on public.job_logistics;
create policy job_logistics_select_assigned_nurse
  on public.job_logistics
  for select
  using (public.nurse_assigned_to_job(job_id));

drop policy if exists job_logistics_select_admin on public.job_logistics;
create policy job_logistics_select_admin
  on public.job_logistics
  for select
  using (public.is_admin());

drop policy if exists job_logistics_insert_patient on public.job_logistics;
create policy job_logistics_insert_patient
  on public.job_logistics
  for insert
  with check (public.patient_owns_job(job_id));

drop policy if exists job_logistics_update_patient on public.job_logistics;
create policy job_logistics_update_patient
  on public.job_logistics
  for update
  using (public.patient_owns_job(job_id))
  with check (public.patient_owns_job(job_id));

drop policy if exists job_logistics_update_admin on public.job_logistics;
create policy job_logistics_update_admin
  on public.job_logistics
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists job_logistics_set_updated_at on public.job_logistics;
create trigger job_logistics_set_updated_at
before update on public.job_logistics
for each row execute function public.set_updated_at();

create or replace function public.create_care_request(p_request jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job_id uuid;
  v_mobility_aids text[];
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'patient'::public.user_role
  ) then
    raise exception 'patient role required' using errcode = '42501';
  end if;

  select coalesce(array_agg(value), '{}'::text[])
    into v_mobility_aids
  from jsonb_array_elements_text(coalesce(p_request->'logistics'->'mobility_aids', '[]'::jsonb));

  insert into public.jobs (
    created_by,
    patient_user_id,
    patient_id,
    title,
    description,
    address,
    service_city,
    service_state,
    start_time,
    hourly_rate,
    status
  ) values (
    auth.uid(),
    auth.uid(),
    auth.uid(),
    nullif(trim(p_request->>'title'), ''),
    nullif(trim(p_request->>'description'), ''),
    null,
    nullif(trim(p_request->'logistics'->>'city'), ''),
    upper(nullif(trim(p_request->'logistics'->>'state'), '')),
    nullif(p_request->>'start_time', '')::timestamptz,
    null,
    'open'::public.job_status
  ) returning id into v_job_id;

  insert into public.job_logistics (
    job_id,
    residence_type,
    street_address,
    unit,
    building_name,
    city,
    state,
    postal_code,
    stairs,
    elevator_available,
    meeting_point,
    parking_notes,
    arrival_instructions,
    mobility_aids,
    mobility_notes,
    onsite_contact_name,
    onsite_contact_relationship,
    onsite_contact_phone,
    transportation_mode,
    transportation_provider,
    pickup_time,
    return_plan,
    transportation_notes
  ) values (
    v_job_id,
    p_request->'logistics'->>'residence_type',
    trim(p_request->'logistics'->>'street_address'),
    nullif(trim(p_request->'logistics'->>'unit'), ''),
    nullif(trim(p_request->'logistics'->>'building_name'), ''),
    trim(p_request->'logistics'->>'city'),
    upper(trim(p_request->'logistics'->>'state')),
    trim(p_request->'logistics'->>'postal_code'),
    coalesce(nullif(p_request->'logistics'->>'stairs', ''), 'none'),
    case
      when p_request->'logistics' ? 'elevator_available'
        then (p_request->'logistics'->>'elevator_available')::boolean
      else null
    end,
    nullif(trim(p_request->'logistics'->>'meeting_point'), ''),
    nullif(trim(p_request->'logistics'->>'parking_notes'), ''),
    nullif(trim(p_request->'logistics'->>'arrival_instructions'), ''),
    v_mobility_aids,
    nullif(trim(p_request->'logistics'->>'mobility_notes'), ''),
    nullif(trim(p_request->'logistics'->>'onsite_contact_name'), ''),
    nullif(trim(p_request->'logistics'->>'onsite_contact_relationship'), ''),
    nullif(trim(p_request->'logistics'->>'onsite_contact_phone'), ''),
    p_request->'logistics'->>'transportation_mode',
    nullif(trim(p_request->'logistics'->>'transportation_provider'), ''),
    nullif(p_request->'logistics'->>'pickup_time', '')::timestamptz,
    p_request->'logistics'->>'return_plan',
    nullif(trim(p_request->'logistics'->>'transportation_notes'), '')
  );

  return v_job_id;
end;
$$;

revoke all on function public.create_care_request(jsonb) from public;
grant execute on function public.create_care_request(jsonb) to authenticated;

comment on table public.job_logistics is
  'Assignment-gated residence, access, mobility, contact, and transportation details for a care request.';

comment on column public.job_logistics.arrival_instructions is
  'Private arrival guidance. Door, gate, alarm, and lockbox codes must not be stored here.';
