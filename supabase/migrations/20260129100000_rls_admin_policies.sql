-- RLS + admin policies (idempotent)

-- Enable RLS on core tables
alter table if exists public.profiles enable row level security;
alter table if exists public.nurse_profiles enable row level security;
alter table if exists public.jobs enable row level security;
alter table if exists public.applications enable row level security;

-- Profiles: admin can select all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_admin'
  ) THEN
    CREATE POLICY profiles_select_admin
      ON public.profiles
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      );
  END IF;
END $$;

-- Nurse profiles: nurse can select/update own; admin can select all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nurse_profiles'
      AND policyname = 'nurse_profiles_select_own'
  ) THEN
    CREATE POLICY nurse_profiles_select_own
      ON public.nurse_profiles
      FOR SELECT
      USING (nurse_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nurse_profiles'
      AND policyname = 'nurse_profiles_update_own'
  ) THEN
    CREATE POLICY nurse_profiles_update_own
      ON public.nurse_profiles
      FOR UPDATE
      USING (nurse_id = auth.uid())
      WITH CHECK (nurse_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nurse_profiles'
      AND policyname = 'nurse_profiles_select_admin'
  ) THEN
    CREATE POLICY nurse_profiles_select_admin
      ON public.nurse_profiles
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      );
  END IF;
END $$;

-- Jobs: admin can read all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_select_admin'
  ) THEN
    CREATE POLICY jobs_select_admin
      ON public.jobs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      );
  END IF;
END $$;

-- Applications: admin can read all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'applications'
      AND policyname = 'applications_select_admin'
  ) THEN
    CREATE POLICY applications_select_admin
      ON public.applications
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      );
  END IF;
END $$;
