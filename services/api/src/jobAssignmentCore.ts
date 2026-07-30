export type SupabaseAdminLike = {
  from(table: string): any;
};

export async function isApprovedNurseWithClient(client: SupabaseAdminLike | null, nurseUserId: string) {
  if (!client) return false;

  const { data } = await client
    .from("nurse_profiles")
    .select("verification_status")
    .eq("nurse_id", nurseUserId)
    .maybeSingle();

  return data?.verification_status === "approved";
}

export async function markJobAssignedWithClient(client: SupabaseAdminLike | null, jobId: string, nurseUserId: string) {
  if (!client) return { error: new Error("Admin client not configured") };

  const withAssignedColumn = await client
    .from("jobs")
    .update({ status: "assigned", assigned_nurse_user_id: nurseUserId })
    .eq("id", jobId)
    .eq("status", "open")
    .select("id")
    .single();

  if (!withAssignedColumn.error) return { error: null };

  const code = (withAssignedColumn.error as any).code;
  if (code !== "PGRST204" && code !== "42703") {
    return { error: withAssignedColumn.error };
  }

  const statusOnly = await client
    .from("jobs")
    .update({ status: "assigned" })
    .eq("id", jobId)
    .eq("status", "open")
    .select("id")
    .single();

  return { error: statusOnly.error };
}
