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

export function groupAssignedJobs<T extends { start_time?: string | null }>(jobs: T[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const sorted = [...jobs].sort((left, right) => {
    if (!left.start_time) return 1;
    if (!right.start_time) return -1;
    return new Date(left.start_time).getTime() - new Date(right.start_time).getTime();
  });
  return {
    today: sorted.filter((job) => job.start_time && new Date(job.start_time).getTime() >= startOfToday && new Date(job.start_time).getTime() < startOfTomorrow),
    upcoming: sorted.filter((job) => job.start_time && new Date(job.start_time).getTime() >= startOfTomorrow),
    needsScheduling: sorted.filter((job) => !job.start_time || new Date(job.start_time).getTime() < startOfToday)
  };
}

export type AvailabilityWindowInput = {
  starts_at: string;
  ends_at: string;
  timezone: string;
  recurrence: "none" | "weekly";
};

export function validateAvailabilityWindow(
  candidate: AvailabilityWindowInput,
  existing: AvailabilityWindowInput[],
  now = Date.now()
) {
  const startsAt = new Date(candidate.starts_at).getTime();
  const endsAt = new Date(candidate.ends_at).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return "Choose a valid start and end time.";
  if (startsAt < now - 60_000) return "Availability cannot start in the past.";
  if (endsAt <= startsAt) return "End time must be after start time.";
  if (endsAt - startsAt > 31 * 24 * 60 * 60 * 1000) return "An availability window cannot exceed 31 days.";
  const overlaps = existing.some((window) => {
    const existingStart = new Date(window.starts_at).getTime();
    const existingEnd = new Date(window.ends_at).getTime();
    return startsAt < existingEnd && endsAt > existingStart;
  });
  return overlaps ? "This window overlaps existing availability." : null;
}

export function defaultAvailabilityWindow(now = new Date()) {
  const start = new Date(now);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
  if (start.getTime() <= now.getTime()) start.setMinutes(start.getMinutes() + 15);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  return { start, end };
}
