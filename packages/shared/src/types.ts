export type UserRole = "nurse" | "recruiter" | "admin";

export type Shift = {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
};

export type JobStatus = "open" | "assigned" | "completed" | "cancelled";

export type Job = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  shift: Shift | null;
  pay_rate: number | null;
  status: JobStatus;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};
