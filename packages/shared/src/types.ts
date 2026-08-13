import type { ApplicationStatus, JobStatus, VisitEventType } from "./workflow";

export type UserRole = "patient" | "nurse" | "admin";

export type VerificationStatus = "pending" | "approved" | "rejected";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at?: string | null;
};

export type NurseProfile = {
  nurse_id: string;
  license_number: string | null;
  license_state?: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
  is_active?: boolean | null;
  created_at: string;
};

export type Job = {
  id: string;
  patient_user_id: string;
  title: string;
  description: string | null;
  address: string | null;
  start_time: string | null;
  hourly_rate: number | null;
  service_city?: string | null;
  service_state?: string | null;
  status: JobStatus;
  assigned_nurse_user_id?: string | null;
  created_at: string;
};

export type Application = {
  id: string;
  job_id: string;
  nurse_user_id: string;
  status: ApplicationStatus;
  note?: string | null;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type CareCircleRecipient = { id: string; patient_user_id: string; job_id: string | null; display_name: string; relationship: string; email: string | null; phone: string | null; receive_milestones: boolean; receive_summary: boolean; consented_at: string; revoked_at: string | null };
export type VisitEvent = { id: string; job_id: string; nurse_user_id: string; event_type: VisitEventType; occurred_at: string; patient_visible: boolean; note: string | null };
export type VisitReport = { id: string; job_id: string; nurse_user_id: string; status: "draft" | "submitted" | "amended"; visit_summary: string | null; provider_instructions: string | null; follow_up_tasks: string | null; transportation_outcome: string | null; submitted_at: string | null };
export type PatientVisitFeedback = { id: string; job_id: string; patient_user_id: string; rating: number; comments: string | null; would_rebook: boolean | null; prefer_same_nurse: boolean };
