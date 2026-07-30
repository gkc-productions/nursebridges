import type { ApplicationStatus, JobStatus } from "./workflow";

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
