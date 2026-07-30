import { hasSupabaseAdminConfig, supabaseAdmin } from "./supabaseAdmin";

export type AdminJobRow = {
  id: string;
  status: string;
  title: string | null;
  description: string | null;
  address: string | null;
  start_time: string | null;
  hourly_rate: number | null;
  patient_user_id: string | null;
  assigned_nurse_user_id?: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

export type AdminApplicationRow = {
  id?: string;
  job_id: string;
  nurse_user_id: string;
  status: string;
  created_at: string | null;
};

export type AdminNurseProfileRow = {
  nurse_id: string;
  verification_status: string;
  verified_at: string | null;
  is_active?: boolean | null;
};

export type AdminVerificationDocumentRow = {
  id: string;
  nurse_user_id: string;
  document_type: string | null;
  status: string;
  created_at: string | null;
};

export type AdminAuditRow = {
  id?: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_id: string | null;
  created_at: string | null;
};

export type AdminDashboardData = {
  configured: boolean;
  jobs: AdminJobRow[];
  applications: AdminApplicationRow[];
  nurseProfiles: AdminNurseProfileRow[];
  verificationDocuments: AdminVerificationDocumentRow[];
  auditEvents: AdminAuditRow[];
};

async function safeSelect<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>) {
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function loadAdminDashboardData(): Promise<AdminDashboardData> {
  if (!hasSupabaseAdminConfig()) {
    return {
      configured: false,
      jobs: [],
      applications: [],
      nurseProfiles: [],
      verificationDocuments: [],
      auditEvents: []
    };
  }

  const [jobs, applications, nurseProfiles, verificationDocuments, auditEvents] = await Promise.all([
    safeSelect<AdminJobRow>(
      supabaseAdmin
        .from("jobs")
        .select("id,status,title,description,address,start_time,hourly_rate,patient_user_id,assigned_nurse_user_id,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(50)
    ),
    safeSelect<AdminApplicationRow>(
      supabaseAdmin
        .from("applications")
        .select("id,job_id,nurse_user_id,status,created_at")
        .order("created_at", { ascending: false })
        .limit(200)
    ),
    safeSelect<AdminNurseProfileRow>(
      supabaseAdmin
        .from("nurse_profiles")
        .select("nurse_id,verification_status,verified_at,is_active")
        .order("verified_at", { ascending: false, nullsFirst: false })
        .limit(100)
    ),
    safeSelect<AdminVerificationDocumentRow>(
      supabaseAdmin
        .from("nurse_verification_documents")
        .select("id,nurse_user_id,document_type,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100)
    ),
    safeSelect<AdminAuditRow>(
      supabaseAdmin
        .from("admin_audit_logs")
        .select("id,action,entity_type,entity_id,actor_id,created_at")
        .order("created_at", { ascending: false })
        .limit(25)
    )
  ]);

  return {
    configured: true,
    jobs,
    applications,
    nurseProfiles,
    verificationDocuments,
    auditEvents
  };
}

export function applicationsByJob(applications: AdminApplicationRow[]) {
  const map = new Map<string, AdminApplicationRow[]>();
  for (const application of applications) {
    const current = map.get(application.job_id) ?? [];
    current.push(application);
    map.set(application.job_id, current);
  }
  return map;
}

export function verificationDocumentsByNurse(documents: AdminVerificationDocumentRow[]) {
  const map = new Map<string, AdminVerificationDocumentRow[]>();
  for (const document of documents) {
    const current = map.get(document.nurse_user_id) ?? [];
    current.push(document);
    map.set(document.nurse_user_id, current);
  }
  return map;
}
