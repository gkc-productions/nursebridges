export type SupabaseWriteClient = {
  from(table: string): any;
};

export async function markJobCancelledWithClient(client: SupabaseWriteClient, jobId: string, currentStatus: string) {
  const { data, error } = await client
    .from("jobs")
    .update({ status: "cancelled" })
    .eq("id", jobId)
    .eq("status", currentStatus)
    .select("*")
    .single();

  return { data, error };
}

export async function markJobCompletedWithClient(client: SupabaseWriteClient, jobId: string, currentStatus: string) {
  const { data, error } = await client
    .from("jobs")
    .update({ status: "completed" })
    .eq("id", jobId)
    .eq("status", currentStatus)
    .select("*")
    .single();

  return { data, error };
}
