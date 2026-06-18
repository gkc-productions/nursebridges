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

export const createJobSchema = z.object({
  title: z.string().trim().min(3).transform((value) => value.slice(0, 120)),
  description: z.preprocess(emptyToUndefined, z.string().trim().optional().default(""))
    .transform((value) => value.slice(0, 4000)),
  address: z.preprocess(emptyToUndefined, z.string().trim().optional().default(""))
    .transform((value) => value.slice(0, 255)),
  start_time: optionalDateTime,
  hourly_rate: optionalHourlyRate
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
