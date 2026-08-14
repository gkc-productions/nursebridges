export type UserRole = "patient" | "nurse" | "admin";

export type JobLogistics = {
  job_id: string;
  residence_type: "house" | "apartment" | "assisted_living" | "other";
  street_address: string;
  unit: string | null;
  building_name: string | null;
  city: string;
  state: string;
  postal_code: string;
  stairs: "none" | "entrance" | "interior" | "both" | "unknown";
  elevator_available: boolean | null;
  meeting_point: string | null;
  parking_notes: string | null;
  arrival_instructions: string | null;
  mobility_aids: string[];
  mobility_notes: string | null;
  onsite_contact_name: string | null;
  onsite_contact_relationship: string | null;
  onsite_contact_phone: string | null;
  transportation_mode: string;
  transportation_provider: string | null;
  pickup_time: string | null;
  return_plan: string;
  transportation_notes: string | null;
};

export type JobRow = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  start_time: string | null;
  hourly_rate: number | null;
  service_city?: string | null;
  service_state?: string | null;
  logistics?: JobLogistics | null;
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

export type VisitEventType =
  | "pre_visit_confirmed"
  | "en_route"
  | "arrived"
  | "patient_met"
  | "facility_check_in"
  | "appointment_started"
  | "appointment_ended"
  | "return_started"
  | "patient_handoff"
  | "visit_completed"
  | "escalation_requested";

export type VisitEventRow = {
  id: string;
  job_id: string;
  nurse_user_id: string;
  event_type: VisitEventType;
  occurred_at: string;
  patient_visible: boolean;
  note: string | null;
};

export type VisitReportRow = {
  id: string;
  job_id: string;
  nurse_user_id: string;
  status: "draft" | "submitted" | "amended";
  visit_summary: string | null;
  provider_instructions: string | null;
  follow_up_tasks: string | null;
  transportation_outcome: string | null;
  submitted_at: string | null;
  updated_at: string;
};

export type VisitCoordinationResponse = {
  events: VisitEventRow[];
  report: VisitReportRow | null;
  feedback: PatientVisitFeedbackRow | null;
};

export type CareCircleRecipientRow = {
  id: string;
  job_id: string | null;
  display_name: string;
  relationship: string;
  email: string | null;
  phone: string | null;
  receive_milestones: boolean;
  receive_summary: boolean;
  consented_at: string;
  invitation_status: "pending" | "accepted" | "expired" | "revoked";
  invitation_expires_at: string;
  accepted_at: string | null;
  last_invited_at: string | null;
  delivery_status: "not_sent" | "queued" | "sent" | "failed";
};

export type CareCircleListResponse = {
  recipients: CareCircleRecipientRow[];
};

export type JobMessageRow = {
  id: string;
  job_id: string;
  sender_user_id: string;
  sender_label: string;
  body: string;
  created_at: string;
};

export type JobMessageListResponse = {
  messages: JobMessageRow[];
};

export type TrustedNurse = {
  id: string;
  display_name: string;
  specialty: string | null;
  years_experience: number | null;
  bio: string | null;
  license_state: string | null;
  verification_status: "approved";
  verified_at: string | null;
};

export type TrustedNurseResponse = {
  nurse: TrustedNurse | null;
};

export type PatientVisitFeedbackRow = {
  id: string;
  job_id: string;
  rating: number;
  comments: string | null;
  would_rebook: boolean | null;
  prefer_same_nurse: boolean;
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
