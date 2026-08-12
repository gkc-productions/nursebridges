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
