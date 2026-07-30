export type UserRole = "patient" | "nurse" | "admin";

export type JobRow = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  start_time: string | null;
  hourly_rate: number | null;
  status: string;
  created_at: string;
  patient_user_id?: string | null;
  assigned_nurse_user_id?: string | null;
  assigned_nurse_name?: string | null;
};

export type ApplicationRow = {
  id: string;
  job_id: string;
  nurse_user_id: string;
  status: string;
  created_at: string;
};

export type NurseProfile = {
  verification_status: "pending" | "approved" | "rejected";
  verified_at: string | null;
};

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type VerificationDocumentRow = {
  id: string;
  document_type: string;
  status: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export type JobListResponse = {
  jobs: JobRow[];
};

export type ApplicationListResponse = {
  applications: ApplicationRow[];
};

export type NotificationListResponse = {
  notifications: NotificationRow[];
};

export type VerificationDocumentListResponse = {
  documents: VerificationDocumentRow[];
};

export type VerificationDocumentUploadUrlResponse = {
  bucket: string;
  path: string;
  token: string;
};

export type ApiIssue = {
  path?: string;
  message: string;
};

export type ApiErrorResponse = {
  error?: string;
  issues?: ApiIssue[];
  requestId?: string;
};
