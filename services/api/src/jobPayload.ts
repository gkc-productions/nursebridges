import type { createJobSchema } from "./validators.js";
import type { z } from "zod";

type CreateJobInput = z.infer<typeof createJobSchema>;

export function buildCreateJobPayload(patientUserId: string, body: CreateJobInput) {
  return {
    created_by: patientUserId,
    patient_user_id: patientUserId,
    patient_id: patientUserId,
    title: body.title,
    description: body.description || null,
    address: body.address || null,
    start_time: body.start_time ?? null,
    hourly_rate: body.hourly_rate ?? null,
    status: "open" as const
  };
}
