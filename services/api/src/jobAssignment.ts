import { supabaseAdmin } from "./supabase.js";
import { isApprovedNurseWithClient, markJobAssignedWithClient } from "./jobAssignmentCore.js";

export async function isApprovedNurse(nurseUserId: string) {
  return isApprovedNurseWithClient(supabaseAdmin, nurseUserId);
}

export async function markJobAssigned(jobId: string, nurseUserId: string) {
  return markJobAssignedWithClient(supabaseAdmin, jobId, nurseUserId);
}
