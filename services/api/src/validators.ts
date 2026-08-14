import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const optionalDateTime = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (typeof normalized !== "string") return normalized;

  const date = new Date(normalized.trim());
  if (Number.isNaN(date.getTime())) return normalized;
  return date.toISOString();
}, z.string().datetime().optional());

const optionalHourlyRate = z.preprocess((value) => {
  const normalized = emptyToUndefined(value);
  if (typeof normalized !== "string") return normalized;

  const hourlyRate = Number(normalized.trim());
  return Number.isFinite(hourlyRate) ? hourlyRate : normalized;
}, z.number().nonnegative().optional());

const optionalTrimmedString = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const stateCode = z.string().trim().length(2).transform((value) => value.toUpperCase());

const prohibitedAccessSecret = /\b(?:door|gate|alarm|lockbox|keypad|entry)\s*(?:code|pin)\b|\bcode\s*(?:is|:)\s*[a-z0-9#*]{3,}\b/i;

const privateArrivalInstructions = optionalTrimmedString(500).refine(
  (value) => !value || !prohibitedAccessSecret.test(value),
  "Do not include door, gate, alarm, keypad, or lockbox codes. Share time-limited access details by phone after assignment."
);

export const jobLogisticsSchema = z.object({
  residence_type: z.enum(["house", "apartment", "assisted_living", "other"]),
  street_address: z.string().trim().min(3).max(200),
  unit: optionalTrimmedString(50),
  building_name: optionalTrimmedString(120),
  city: z.string().trim().min(2).max(100),
  state: stateCode,
  postal_code: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/, "Enter a valid ZIP code."),
  stairs: z.enum(["none", "entrance", "interior", "both", "unknown"]).default("none"),
  elevator_available: z.boolean().optional(),
  meeting_point: optionalTrimmedString(300),
  parking_notes: optionalTrimmedString(500),
  arrival_instructions: privateArrivalInstructions,
  mobility_aids: z.array(z.enum(["none", "cane", "walker", "wheelchair", "scooter", "other"]))
    .max(6)
    .default([]),
  mobility_notes: optionalTrimmedString(1000),
  onsite_contact_name: optionalTrimmedString(120),
  onsite_contact_relationship: optionalTrimmedString(80),
  onsite_contact_phone: optionalTrimmedString(30),
  transportation_mode: z.enum([
    "patient_arranged",
    "family_friend",
    "rideshare",
    "medical_transport",
    "public_transit",
    "other",
    "not_arranged"
  ]),
  transportation_provider: optionalTrimmedString(120),
  pickup_time: optionalDateTime,
  return_plan: z.enum(["round_trip", "one_way", "family_pickup", "other", "not_arranged"]),
  transportation_notes: optionalTrimmedString(1000)
});

export const createJobSchema = z.object({
  title: z.string().trim().min(3).transform((value) => value.slice(0, 120)),
  description: z.preprocess(emptyToUndefined, z.string().trim().optional().default(""))
    .transform((value) => value.slice(0, 4000)),
  address: z.preprocess(emptyToUndefined, z.string().trim().optional().default(""))
    .transform((value) => value.slice(0, 255)),
  start_time: optionalDateTime,
  hourly_rate: optionalHourlyRate,
  logistics: jobLogisticsSchema
}).superRefine((value, context) => {
  if (value.logistics.residence_type === "apartment" && !value.logistics.unit) {
    context.addIssue({
      code: "custom",
      path: ["logistics", "unit"],
      message: "Apartment or unit number is required for an apartment residence."
    });
  }
  if (value.logistics.stairs !== "none" && value.logistics.elevator_available === undefined) {
    context.addIssue({
      code: "custom",
      path: ["logistics", "elevator_available"],
      message: "Confirm whether an elevator is available."
    });
  }
});

export const applyJobSchema = z.object({
  note: z.string().min(0).max(2000).optional().default("")
});

export const updateJobSchema = z.object({
  status: z.enum(["open", "assigned", "completed", "cancelled"]).optional(),
  description: z.string().min(0).max(4000).optional(),
  address: z.string().min(0).max(255).optional(),
  start_time: z.string().datetime().optional(),
  hourly_rate: z.number().nonnegative().optional()
});

export const decideApplicationSchema = z.object({
  decision: z.enum(["accept", "reject"])
});

export const createVerificationDocumentSchema = z.object({
  storage_path: z.string().min(3).max(1024),
  document_type: z.string().min(2).max(80)
});

export const createVerificationDocumentUploadUrlSchema = z.object({
  storage_path: z.string().min(3).max(1024)
});

export const verifyNurseSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  rejection_reason: z.string().max(1000).optional()
});

export const visitEventSchema = z.object({
  event_type: z.enum(["pre_visit_confirmed", "en_route", "arrived", "patient_met", "facility_check_in", "appointment_started", "appointment_ended", "return_started", "patient_handoff", "visit_completed", "escalation_requested"]),
  occurred_at: optionalDateTime,
  note: optionalTrimmedString(500)
});

export const visitReportSchema = z.object({
  status: z.enum(["draft", "submitted"]),
  visit_summary: optionalTrimmedString(4000),
  provider_instructions: optionalTrimmedString(4000),
  follow_up_tasks: optionalTrimmedString(2000),
  transportation_outcome: optionalTrimmedString(1000)
});

export const patientFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comments: optionalTrimmedString(2000),
  would_rebook: z.boolean().optional(),
  prefer_same_nurse: z.boolean().default(false)
});

export const careCircleRecipientSchema = z.object({
  job_id: z.string().uuid().optional(),
  display_name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254).optional(),
  phone: optionalTrimmedString(30),
  receive_milestones: z.boolean().default(false),
  receive_summary: z.boolean().default(false)
}).superRefine((value, context) => {
  if (!value.email && !value.phone) context.addIssue({ code: "custom", path: ["email"], message: "Provide an email or phone number." });
  if (!value.receive_milestones && !value.receive_summary) context.addIssue({ code: "custom", path: ["receive_milestones"], message: "Select at least one update category." });
});

export const jobMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  client_message_id: z.string().uuid().optional()
});

export const nurseWorkspaceProfileSchema = z.object({
  professional_summary: optionalTrimmedString(1200),
  years_experience: z.number().int().min(0).max(70).optional(),
  service_radius_miles: z.number().int().min(1).max(250).optional(),
  availability_status: z.enum(["available", "limited", "unavailable"]),
  onboarding_step: z.enum(["profile", "credentials", "availability", "review", "complete"])
});

export const nurseAvailabilitySchema = z.object({
  windows: z.array(z.object({
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    timezone: z.string().trim().min(1).max(80).default("America/New_York"),
    recurrence: z.enum(["none", "weekly"]).default("none")
  }).superRefine((value, context) => {
    const startsAt = new Date(value.starts_at).getTime();
    const endsAt = new Date(value.ends_at).getTime();
    if (endsAt <= startsAt) context.addIssue({ code: "custom", path: ["ends_at"], message: "End time must be after start time." });
    if (endsAt - startsAt > 31 * 24 * 60 * 60 * 1000) context.addIssue({ code: "custom", path: ["ends_at"], message: "Availability windows cannot exceed 31 days." });
  })).max(50)
});

export const supportCaseSchema = z.object({
  case_type: z.enum(["support", "incident"]),
  subject_type: z.enum(["job", "account", "credential"]),
  subject_id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(180),
  description: optionalTrimmedString(4000),
  priority: z.enum(["normal", "high", "urgent"]).default("normal")
});

export const preferredNurseSchema = z.object({
  nurse_user_id: z.string().uuid(),
  source_job_id: z.string().uuid().optional(),
  status: z.enum(["preferred", "do_not_match", "inactive"]).default("preferred")
});

export const recurringCarePlanSchema = z.object({
  source_job_id: z.string().uuid().optional(),
  preferred_nurse_user_id: z.string().uuid().optional(),
  cadence: z.enum(["weekly", "biweekly", "monthly"]),
  starts_on: z.string().date(),
  ends_on: z.string().date().optional(),
  local_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  timezone: z.string().trim().min(1).max(80).default("America/New_York"),
  occurrences_limit: z.number().int().min(1).max(52).optional()
}).superRefine((value, context) => {
  if (value.ends_on && value.ends_on < value.starts_on) {
    context.addIssue({ code: "custom", path: ["ends_on"], message: "End date must be on or after the start date." });
  }
});

export const arrivalPinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, "Enter the six-digit arrival PIN.")
});
