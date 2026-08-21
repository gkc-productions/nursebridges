-- Replace a nurse's complete availability calendar in one transaction. If any
-- proposed window is invalid, PostgreSQL rolls the delete back automatically.
create or replace function public.replace_my_nurse_availability(p_windows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  window_count integer;
  result jsonb;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = caller_id and role = 'nurse'
  ) then
    raise exception 'nurse account required' using errcode = '42501';
  end if;

  if jsonb_typeof(p_windows) <> 'array' then
    raise exception 'availability windows must be an array' using errcode = '22023';
  end if;

  window_count := jsonb_array_length(p_windows);
  if window_count > 50 then
    raise exception 'no more than 50 availability windows are allowed' using errcode = '22023';
  end if;

  delete from public.nurse_availability_windows
  where nurse_user_id = caller_id;

  insert into public.nurse_availability_windows (
    nurse_user_id,
    starts_at,
    ends_at,
    timezone,
    recurrence
  )
  select
    caller_id,
    proposed.starts_at,
    proposed.ends_at,
    proposed.timezone,
    proposed.recurrence
  from jsonb_to_recordset(p_windows) as proposed(
    starts_at timestamptz,
    ends_at timestamptz,
    timezone text,
    recurrence text
  );

  update public.nurse_profiles
  set
    availability_status = case when window_count > 0 then 'available' else 'unavailable' end,
    onboarding_step = case
      when onboarding_step in ('profile', 'credentials', 'availability') and window_count > 0 then 'review'
      else onboarding_step
    end,
    updated_at = now()
  where nurse_id = caller_id;

  select coalesce(jsonb_agg(to_jsonb(saved) order by saved.starts_at), '[]'::jsonb)
  into result
  from (
    select id, starts_at, ends_at, timezone, recurrence
    from public.nurse_availability_windows
    where nurse_user_id = caller_id
  ) saved;

  return result;
end;
$$;

revoke all on function public.replace_my_nurse_availability(jsonb) from public, anon;
grant execute on function public.replace_my_nurse_availability(jsonb) to authenticated;
