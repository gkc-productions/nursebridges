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
    address: null,
    service_city: body.logistics.city,
    service_state: body.logistics.state,
    start_time: body.start_time ?? null,
    hourly_rate: null,
    status: "open" as const
  };
}

export function buildCreateCareRequestRpcPayload(body: CreateJobInput) {
  return {
    title: body.title,
    description: body.description || null,
    start_time: body.start_time ?? null,
    logistics: {
      ...body.logistics,
      unit: body.logistics.unit ?? null,
      building_name: body.logistics.building_name ?? null,
      elevator_available: body.logistics.elevator_available ?? null,
      meeting_point: body.logistics.meeting_point ?? null,
      parking_notes: body.logistics.parking_notes ?? null,
      arrival_instructions: body.logistics.arrival_instructions ?? null,
      mobility_notes: body.logistics.mobility_notes ?? null,
      onsite_contact_name: body.logistics.onsite_contact_name ?? null,
      onsite_contact_relationship: body.logistics.onsite_contact_relationship ?? null,
      onsite_contact_phone: body.logistics.onsite_contact_phone ?? null,
      transportation_provider: body.logistics.transportation_provider ?? null,
      pickup_time: body.logistics.pickup_time ?? null,
      transportation_notes: body.logistics.transportation_notes ?? null
    }
  };
}
