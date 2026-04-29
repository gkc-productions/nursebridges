-- Clean up permissive/duplicate RLS policies that bypass verification or role checks

-- profiles: remove overly-permissive legacy policies
DROP POLICY IF EXISTS "Profiles are updatable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON public.profiles;
DROP POLICY IF EXISTS "read own profile" ON public.profiles;

-- jobs: remove public read access
DROP POLICY IF EXISTS "public read jobs" ON public.jobs;

-- applications: remove legacy nurse-only policies that bypass verification
DROP POLICY IF EXISTS "nurse can create own applications" ON public.applications;
DROP POLICY IF EXISTS "nurse can read own applications" ON public.applications;
DROP POLICY IF EXISTS "nurse can update own applications" ON public.applications;
