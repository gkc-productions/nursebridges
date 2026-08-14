export const visitCheckpointOrder = ["pre_visit_confirmed", "en_route", "arrived", "patient_met", "facility_check_in", "appointment_started", "appointment_ended", "return_started", "patient_handoff", "visit_completed"] as const;

export function nextVisitCheckpoint(events: Array<{ event_type: string }>) {
  return visitCheckpointOrder.find((checkpoint) => !events.some((event) => event.event_type === checkpoint));
}

export function nurseReadiness(profile: { verification_status?: string; onboarding_step?: string } | null) {
  if (!profile) return { ready: false, next: "profile" };
  if (profile.verification_status === "approved") return { ready: true, next: "opportunities" };
  if (profile.onboarding_step === "review" || profile.onboarding_step === "complete") return { ready: false, next: "review" };
  return { ready: false, next: profile.onboarding_step || "profile" };
}

export function partitionNurseJobs<T extends { status: string; assigned_nurse_user_id?: string | null }>(jobs: T[], nurseUserId: string) {
  return {
    opportunities: jobs.filter((job) => job.status === "open"),
    assigned: jobs.filter((job) => job.assigned_nurse_user_id === nurseUserId && !["completed", "cancelled"].includes(job.status))
  };
}
