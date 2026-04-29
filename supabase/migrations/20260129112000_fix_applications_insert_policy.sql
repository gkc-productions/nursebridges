-- Ensure nurse must be verified to apply to jobs

DROP POLICY IF EXISTS "applications_insert_nurse_or_admin" ON public.applications;

CREATE POLICY "applications_insert_nurse_or_admin" ON public.applications
FOR INSERT
WITH CHECK (
  public.is_admin()
  OR (
    nurse_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'nurse'::public.user_role
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = applications.job_id AND j.status = 'open'::public.job_status
    )
    AND EXISTS (
      SELECT 1
      FROM public.nurse_profiles np
      WHERE np.nurse_id = auth.uid() AND np.verification_status = 'approved'
    )
  )
);
