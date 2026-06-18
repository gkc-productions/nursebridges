import React, { useEffect, useMemo, useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { loadApiConfig } from "./src/env";
import { addForegroundNotificationListener, registerForPushNotificationsAsync } from "./src/push";
import { getSupabaseClient } from "./src/supabase";

type UserRole = "patient" | "nurse" | "admin";

type JobRow = {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  start_time: string | null;
  hourly_rate: number | null;
  status: string;
  created_at: string;
  patient_user_id?: string | null;
  assigned_nurse_user_id?: string | null;
  assigned_nurse_name?: string | null;
};

type ApplicationRow = {
  id: string;
  job_id: string;
  nurse_user_id: string;
  status: string;
  created_at: string;
};

type NurseProfile = {
  verification_status: "pending" | "approved" | "rejected";
  verified_at: string | null;
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

type VerificationDocumentRow = {
  id: string;
  storage_path: string;
  document_type: string;
  status: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type JobListResponse = {
  jobs: JobRow[];
};

type ApplicationListResponse = {
  applications: ApplicationRow[];
};

type NotificationListResponse = {
  notifications: NotificationRow[];
};

type VerificationDocumentListResponse = {
  documents: VerificationDocumentRow[];
};

type VerificationDocumentUploadUrlResponse = {
  bucket: string;
  path: string;
  token: string;
};

type ApiIssue = {
  path?: string;
  message: string;
};

type ApiErrorResponse = {
  error?: string;
  issues?: ApiIssue[];
};

const emptyJobForm = {
  title: "",
  description: "",
  address: "",
  start_time: "",
  hourly_rate: ""
};

const VERIFICATION_BUCKET = "nurse-verification";

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatRate(value: number | null) {
  if (value === null || value === undefined) return "-";
  return `$${value}/hr`;
}

function safeFileName(name: string | null | undefined) {
  const fallback = "verification-document";
  const trimmed = (name ?? fallback).trim() || fallback;
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function buildVerificationStoragePath(userId: string, fileName: string) {
  return `${userId}/${Date.now()}-${safeFileName(fileName)}`;
}

function parseStartTimeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function parseHourlyRateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const hourlyRate = Number(trimmed);
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) return null;

  return hourlyRate;
}

function formatApiErrorMessage(fallback: string, err: unknown) {
  if (!(err instanceof ApiRequestError)) {
    return fallback;
  }

  const issueMessages = err.issues.map((issue) => {
    const path = issue.path?.trim();
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return [err.message, ...issueMessages].filter(Boolean).join("\n") || fallback;
}

function getUploadErrorMessage(message: string | undefined) {
  const text = message ?? "";
  if (/permission|not authorized|row-level security|rls|403/i.test(text)) {
    return "Permission denied while uploading the document.";
  }
  return "Unable to upload verification document.";
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

class ApiRequestError extends Error {
  status: number;
  issues: ApiIssue[];

  constructor(status: number, response: ApiErrorResponse) {
    super(response.error || "Request failed.");
    this.name = "ApiRequestError";
    this.status = status;
    this.issues = response.issues ?? [];
  }
}

export default function App() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [baseUrl, setBaseUrl] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [nurseProfile, setNurseProfile] = useState<NurseProfile | null>(null);

  const [bootLoading, setBootLoading] = useState(true);
  const [screenLoading, setScreenLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [patientJobs, setPatientJobs] = useState<JobRow[]>([]);
  const [nurseJobs, setNurseJobs] = useState<JobRow[]>([]);
  const [applicationsByJob, setApplicationsByJob] = useState<Record<string, ApplicationRow>>({});
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [verificationDocuments, setVerificationDocuments] = useState<VerificationDocumentRow[]>([]);

  const [jobForm, setJobForm] = useState(emptyJobForm);
  const [verificationDocumentType, setVerificationDocumentType] = useState("license");
  const lastAutoLoadKey = useRef<string | null>(null);

  const roleLabel = useMemo(() => role ?? "guest", [role]);
  const isApprovedNurse = nurseProfile?.verification_status === "approved";
  const unreadNotificationCount = notifications.filter((notification) => !notification.read_at).length;

  useEffect(() => {
    let active = true;

    async function loadInitialState() {
      if (!supabase) {
        setBootLoading(false);
        return;
      }

      const [apiConfig, sessionResult] = await Promise.all([
        loadApiConfig(),
        supabase.auth.getSession()
      ]);

      if (!active) return;
      setBaseUrl(apiConfig.baseUrl);
      setSession(sessionResult.data.session ?? null);
      setBootLoading(false);
    }

    void loadInitialState();

    if (!supabase) {
      return () => {
        active = false;
      };
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    async function loadProfile() {
      setError(null);
      setNotice(null);
      setPatientJobs([]);
      setNurseJobs([]);
      setApplicationsByJob({});
      setSelectedJob(null);
      setNotifications([]);
      setVerificationDocuments([]);

      if (!session) {
        lastAutoLoadKey.current = null;
        setRole(null);
        setNurseProfile(null);
        return;
      }

      setScreenLoading(true);

      if (!supabase) {
        setError("Mobile app is missing Supabase configuration.");
        setRole(null);
        setNurseProfile(null);
        setScreenLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id,role")
        .eq("id", session.user.id)
        .single();

      if (profileError || !data?.role) {
        setError("Unable to load profile.");
        setRole(null);
        setNurseProfile(null);
        setScreenLoading(false);
        return;
      }

      const nextRole = data.role as UserRole;
      setRole(nextRole);

      if (nextRole === "nurse") {
        const { data: nurseRow, error: nurseError } = await supabase
          .from("nurse_profiles")
          .select("verification_status,verified_at")
          .eq("nurse_id", session.user.id)
          .maybeSingle();

        if (nurseError) {
          setError("Unable to load nurse verification.");
          setNurseProfile({ verification_status: "pending", verified_at: null });
        } else {
          setNurseProfile((nurseRow as NurseProfile | null) ?? {
            verification_status: "pending",
            verified_at: null
          });
        }
      } else {
        setNurseProfile(null);
      }

      setScreenLoading(false);
    }

    void loadProfile();
  }, [session, supabase]);

  useEffect(() => {
    if (!session || !role || !baseUrl || screenLoading) return;

    const loadKey = `${session.user.id}:${role}:${baseUrl}:${nurseProfile?.verification_status ?? "none"}`;
    if (lastAutoLoadKey.current === loadKey) return;
    lastAutoLoadKey.current = loadKey;

    if (role === "patient") {
      void loadPatientJobs();
    }

    if (role === "nurse") {
      void loadNurseJobs();
      void loadVerificationDocuments();
    }

    void loadNotifications();
  }, [baseUrl, role, screenLoading, session, nurseProfile?.verification_status]);

  useEffect(() => {
    if (!session || !baseUrl) return;
    void registerForPushNotificationsAsync(session, baseUrl);
  }, [baseUrl, session]);

  useEffect(() => {
    const subscription = addForegroundNotificationListener();
    return () => subscription.remove();
  }, []);

  async function apiFetch<T>(path: string, init: RequestInit = {}) {
    if (!session) throw new Error("Sign in required.");
    if (!baseUrl) throw new Error("API URL is not configured.");

    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${session.access_token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const data = await readJson<T & ApiErrorResponse>(res);

    if (!res.ok) {
      const error = new ApiRequestError(res.status, data);
      console.warn("API request failed", {
        path,
        status: error.status,
        error: error.message,
        issues: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message
        }))
      });
      throw error;
    }

    return data as T;
  }

  async function loadPatientJobs() {
    if (!session) return;

    setScreenLoading(true);
    setError(null);

    try {
      const data = await apiFetch<JobListResponse>("/jobs");
      setPatientJobs(data.jobs ?? []);
    } catch {
      setError("Unable to load your jobs.");
    } finally {
      setScreenLoading(false);
    }
  }

  async function loadNurseJobs() {
    if (!session) return;

    setScreenLoading(true);
    setError(null);

    if (!isApprovedNurse) {
      setNurseJobs([]);
      setApplicationsByJob({});
      setScreenLoading(false);
      return;
    }

    try {
      const [jobsData, applicationData] = await Promise.all([
        apiFetch<JobListResponse>("/jobs"),
        apiFetch<ApplicationListResponse>("/v1/applications")
      ]);

      const applicationMap: Record<string, ApplicationRow> = {};
      for (const application of applicationData.applications ?? []) {
        applicationMap[application.job_id] = application;
      }

      setNurseJobs(jobsData.jobs ?? []);
      setApplicationsByJob(applicationMap);
    } catch {
      setError("Unable to load nurse jobs.");
    } finally {
      setScreenLoading(false);
    }
  }

  async function loadNotifications() {
    if (!session) return;

    try {
      const data = await apiFetch<NotificationListResponse>("/notifications");
      setNotifications(data.notifications ?? []);
    } catch {
      setError("Unable to load notifications.");
    }
  }

  async function loadVerificationDocuments() {
    if (!session || role !== "nurse") return;

    try {
      const data = await apiFetch<VerificationDocumentListResponse>("/nurse/verification-documents");
      setVerificationDocuments(data.documents ?? []);
    } catch {
      setError("Unable to load verification documents.");
    }
  }

  async function uploadVerificationDocument() {
    if (!session || role !== "nurse") return;
    if (!supabase) {
      setError("Mobile app is missing Supabase configuration.");
      return;
    }

    const documentType = verificationDocumentType.trim();
    if (!documentType) {
      setError("Enter a document type.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false
      });

      if (picked.canceled) {
        setError("No file selected.");
        return;
      }

      const file = picked.assets[0];
      if (!file?.uri) {
        setError("No file selected.");
        return;
      }

      const storagePath = buildVerificationStoragePath(session.user.id, file.name);
      const fileResponse = await fetch(file.uri);
      const fileBody = await fileResponse.arrayBuffer();
      const uploadUrl = await apiFetch<VerificationDocumentUploadUrlResponse>("/nurse/verification-documents/upload-url", {
        method: "POST",
        body: JSON.stringify({
          storage_path: storagePath
        })
      });
      const upload = await supabase.storage
        .from(VERIFICATION_BUCKET)
        .uploadToSignedUrl(uploadUrl.path, uploadUrl.token, fileBody, {
          contentType: file.mimeType ?? "application/octet-stream",
        });

      if (upload.error) {
        setError(getUploadErrorMessage(upload.error.message));
        return;
      }

      try {
        await apiFetch("/nurse/verification-documents", {
          method: "POST",
          body: JSON.stringify({
            storage_bucket: VERIFICATION_BUCKET,
            document_type: documentType,
            storage_path: storagePath
          })
        });
      } catch {
        void supabase.storage.from(VERIFICATION_BUCKET).remove([storagePath]);
        setError("File uploaded, but metadata could not be saved.");
        return;
      }

      setNotice("Verification document uploaded.");
      await loadVerificationDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload verification document.");
    } finally {
      setActionLoading(false);
    }
  }

  async function markNotificationRead(notificationId: string) {
    if (!session) return;

    setActionLoading(true);
    setError(null);

    try {
      await apiFetch(`/notifications/${notificationId}/read`, { method: "POST" });
      await loadNotifications();
    } catch {
      setError("Unable to update notification.");
    } finally {
      setActionLoading(false);
    }
  }

  async function markAllNotificationsRead() {
    if (!session) return;

    setActionLoading(true);
    setError(null);

    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
      await loadNotifications();
    } catch {
      setError("Unable to update notifications.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSignIn() {
    if (!supabase) {
      setError("Mobile app is missing Supabase configuration.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setNotice(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setActionLoading(false);
    if (signInError) {
      setError("Unable to sign in.");
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      setError("Mobile app is missing Supabase configuration.");
      return;
    }

    setActionLoading(true);
    await supabase.auth.signOut();
    setActionLoading(false);
  }

  async function handleCreateJob() {
    if (!session) return;

    const title = jobForm.title.trim().slice(0, 120);
    if (title.length < 3) {
      setError("Enter a job title with at least 3 characters.");
      return;
    }

    const startTime = parseStartTimeInput(jobForm.start_time);
    if (startTime === null) {
      setError("Enter a valid start time, for example 2026-05-01T14:00:00Z.");
      return;
    }

    const hourlyRate = parseHourlyRateInput(jobForm.hourly_rate);
    if (hourlyRate === null) {
      setError("Enter a valid hourly rate of 0 or more.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      await apiFetch("/jobs", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: jobForm.description.trim().slice(0, 4000),
          address: jobForm.address.trim().slice(0, 255),
          start_time: startTime,
          hourly_rate: hourlyRate
        })
      });

      setJobForm(emptyJobForm);
      setNotice("Job created.");
      await loadPatientJobs();
    } catch (err) {
      setError(formatApiErrorMessage("Unable to create job.", err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApply(job: JobRow) {
    if (!session) return;
    if (!isApprovedNurse) {
      setError("Verification is required to apply.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      await apiFetch(`/jobs/${job.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ note: "" })
      });

      setSelectedJob(job);
      setNotice("Application submitted.");
      await loadNurseJobs();
    } catch {
      setError("Unable to apply to job.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleJobTransition(job: JobRow, action: "cancel" | "complete") {
    if (!session) return;

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      await apiFetch(`/jobs/${job.id}/${action}`, { method: "PATCH" });
      setNotice(action === "cancel" ? "Job cancelled." : "Job completed.");
      if (role === "patient") {
        await loadPatientJobs();
      } else if (role === "nurse") {
        await loadNurseJobs();
      }
    } catch {
      setError(action === "cancel" ? "Unable to cancel job." : "Unable to complete job.");
    } finally {
      setActionLoading(false);
    }
  }

  if (bootLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1E6A5A" />
        <Text style={styles.meta}>Loading NurseBridge...</Text>
      </SafeAreaView>
    );
  }

  if (!supabase) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.error}>Mobile app is missing Supabase configuration.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>NurseBridge</Text>
          <Text style={styles.subTitle}>Role: {roleLabel}</Text>
          <Text style={styles.apiText}>API: {baseUrl || "Not configured"}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {!session ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sign in</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>Account</Text>
                  <Text style={styles.meta}>{session.user.email}</Text>
                  {role === "nurse" && nurseProfile ? (
                    <Text style={styles.meta}>Verification: {nurseProfile.verification_status}</Text>
                  ) : null}
                </View>
                <TouchableOpacity style={styles.smallButton} onPress={handleSignOut} disabled={actionLoading}>
                  <Text style={styles.smallButtonText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>

            {screenLoading ? (
              <View style={styles.card}>
                <ActivityIndicator color="#1E6A5A" />
                <Text style={styles.emptyText}>Loading latest workflow data...</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Notifications ({unreadNotificationCount})</Text>
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={loadNotifications} disabled={screenLoading || actionLoading}>
                    <Text style={styles.linkText}>Refresh</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={markAllNotificationsRead} disabled={actionLoading || unreadNotificationCount === 0}>
                    <Text style={styles.linkText}>Read All</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {notifications.length === 0 ? (
                <Text style={styles.emptyText}>No notifications yet.</Text>
              ) : (
                notifications.map((notification) => (
                  <View key={notification.id} style={styles.jobCard}>
                    <Text style={styles.jobTitle}>{notification.title}</Text>
                    {notification.body ? <Text style={styles.meta}>{notification.body}</Text> : null}
                    <Text style={styles.meta}>Created: {formatDate(notification.created_at)}</Text>
                    <Text style={styles.meta}>Status: {notification.read_at ? "Read" : "Unread"}</Text>
                    {!notification.read_at ? (
                      <TouchableOpacity
                        style={styles.smallButton}
                        onPress={() => markNotificationRead(notification.id)}
                        disabled={actionLoading}
                      >
                        <Text style={styles.smallButtonText}>Mark Read</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))
              )}
            </View>

            {role === "patient" ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Create Job</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Title"
                    value={jobForm.title}
                    onChangeText={(text) => setJobForm((prev) => ({ ...prev, title: text }))}
                  />
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="Description"
                    multiline
                    value={jobForm.description}
                    onChangeText={(text) => setJobForm((prev) => ({ ...prev, description: text }))}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Address"
                    value={jobForm.address}
                    onChangeText={(text) => setJobForm((prev) => ({ ...prev, address: text }))}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Start time, for example 2026-05-01T14:00:00Z"
                    autoCapitalize="none"
                    value={jobForm.start_time}
                    onChangeText={(text) => setJobForm((prev) => ({ ...prev, start_time: text }))}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Hourly rate"
                    keyboardType="numeric"
                    value={jobForm.hourly_rate}
                    onChangeText={(text) => setJobForm((prev) => ({ ...prev, hourly_rate: text }))}
                  />
                  <TouchableOpacity style={styles.button} onPress={handleCreateJob} disabled={actionLoading}>
                    {actionLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Create Job</Text>}
                  </TouchableOpacity>
                </View>

                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>My Jobs</Text>
                    <TouchableOpacity onPress={loadPatientJobs} disabled={screenLoading || actionLoading}>
                      <Text style={styles.linkText}>Refresh</Text>
                    </TouchableOpacity>
                  </View>
                  {patientJobs.length === 0 ? (
                    <Text style={styles.emptyText}>No jobs yet. Create one to start the workflow.</Text>
                  ) : (
                    patientJobs.map((job) => (
                      <View key={job.id} style={styles.jobCard}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <Text style={styles.meta}>Status: {job.status}</Text>
                        <Text style={styles.meta}>Assigned nurse: {job.assigned_nurse_name ?? job.assigned_nurse_user_id ?? "-"}</Text>
                        <Text style={styles.meta}>Start: {formatDate(job.start_time)}</Text>
                        <Text style={styles.meta}>Rate: {formatRate(job.hourly_rate)}</Text>
                        {job.status === "open" || job.status === "assigned" ? (
                          <TouchableOpacity
                            style={styles.smallButton}
                            onPress={() => handleJobTransition(job, "cancel")}
                            disabled={actionLoading}
                          >
                            <Text style={styles.smallButtonText}>Cancel Job</Text>
                          </TouchableOpacity>
                        ) : null}
                        {job.status === "assigned" ? (
                          <TouchableOpacity
                            style={styles.smallButton}
                            onPress={() => handleJobTransition(job, "complete")}
                            disabled={actionLoading}
                          >
                            <Text style={styles.smallButtonText}>Complete Job</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>
              </>
            ) : null}

            {role === "nurse" ? (
              <>
                {!isApprovedNurse ? (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Verification Required</Text>
                    <Text style={styles.emptyText}>Your nurse profile must be approved before you can view or apply to open jobs.</Text>
                  </View>
                ) : (
                  <View style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.sectionTitle}>Open Jobs</Text>
                      <TouchableOpacity onPress={loadNurseJobs} disabled={screenLoading || actionLoading}>
                        <Text style={styles.linkText}>Refresh</Text>
                      </TouchableOpacity>
                    </View>
                    {nurseJobs.length === 0 ? (
                      <Text style={styles.emptyText}>No open jobs are available.</Text>
                    ) : (
                      nurseJobs.map((job) => {
                        const application = applicationsByJob[job.id];
                        const hasApplied = application?.status === "applied";
                        return (
                          <TouchableOpacity
                            key={job.id}
                            style={[
                              styles.jobCard,
                              selectedJob?.id === job.id ? styles.jobCardSelected : null
                            ]}
                            onPress={() => setSelectedJob(job)}
                          >
                            <Text style={styles.jobTitle}>{job.title}</Text>
                            <Text style={styles.meta}>Status: {job.status}</Text>
                            <Text style={styles.meta}>Start: {formatDate(job.start_time)}</Text>
                            <Text style={styles.meta}>Rate: {formatRate(job.hourly_rate)}</Text>
                            {application ? <Text style={styles.badge}>Application: {application.status}</Text> : null}
                            {job.status === "assigned" && job.assigned_nurse_user_id === session.user.id ? (
                              <TouchableOpacity
                                style={styles.smallButton}
                                onPress={() => handleJobTransition(job, "complete")}
                                disabled={actionLoading}
                              >
                                <Text style={styles.smallButtonText}>Complete Job</Text>
                              </TouchableOpacity>
                            ) : null}
                            {!application || hasApplied ? (
                              <TouchableOpacity
                                style={[styles.button, hasApplied ? styles.buttonMuted : null]}
                                onPress={() => handleApply(job)}
                                disabled={actionLoading || Boolean(application)}
                              >
                                <Text style={styles.buttonText}>{hasApplied ? "Applied" : "Apply"}</Text>
                              </TouchableOpacity>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                )}

                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.sectionTitle}>Verification Documents</Text>
                    <TouchableOpacity onPress={loadVerificationDocuments} disabled={screenLoading || actionLoading}>
                      <Text style={styles.linkText}>Refresh</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.emptyText}>
                    Choose a license or verification image/PDF to upload for admin review.
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Document type"
                    autoCapitalize="none"
                    value={verificationDocumentType}
                    onChangeText={setVerificationDocumentType}
                  />
                  <TouchableOpacity style={styles.button} onPress={uploadVerificationDocument} disabled={actionLoading}>
                    {actionLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Choose & Upload Document</Text>}
                  </TouchableOpacity>
                  {verificationDocuments.length === 0 ? (
                    <Text style={styles.emptyText}>No verification documents saved.</Text>
                  ) : (
                    verificationDocuments.map((document) => (
                      <View key={document.id} style={styles.jobCard}>
                        <Text style={styles.jobTitle}>{document.document_type}</Text>
                        <Text style={styles.meta}>Path: {document.storage_path}</Text>
                        <Text style={styles.meta}>Status: {document.status}</Text>
                        <Text style={styles.meta}>Created: {formatDate(document.created_at)}</Text>
                        {document.rejection_reason ? <Text style={styles.meta}>Reason: {document.rejection_reason}</Text> : null}
                      </View>
                    ))
                  )}
                </View>

                {selectedJob ? (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Selected Job</Text>
                    <Text style={styles.jobTitle}>{selectedJob.title}</Text>
                    <Text style={styles.meta}>{selectedJob.description ?? "No description provided."}</Text>
                    <Text style={styles.meta}>Address: {selectedJob.address ?? "-"}</Text>
                    <Text style={styles.meta}>Start: {formatDate(selectedJob.start_time)}</Text>
                    <Text style={styles.meta}>Rate: {formatRate(selectedJob.hourly_rate)}</Text>
                  </View>
                ) : null}
              </>
            ) : null}

            {role === "admin" ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Admin Account</Text>
                <Text style={styles.emptyText}>Use the web Admin portal to assign nurses to patient jobs.</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F2EE"
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#F5F2EE"
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  header: {
    marginBottom: 16
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#221E1A",
    marginBottom: 4
  },
  subTitle: {
    fontSize: 13,
    color: "#5E564F",
    marginBottom: 4
  },
  apiText: {
    fontSize: 11,
    color: "#8A8177"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    marginBottom: 14
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  rowActions: {
    flexDirection: "row",
    gap: 12
  },
  flex: {
    flex: 1
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#221E1A",
    marginBottom: 10
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2DCD3",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#FFF"
  },
  multilineInput: {
    minHeight: 84,
    textAlignVertical: "top"
  },
  button: {
    backgroundColor: "#1E6A5A",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8
  },
  buttonMuted: {
    backgroundColor: "#8A8177"
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600"
  },
  smallButton: {
    borderWidth: 1,
    borderColor: "#1E6A5A",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  smallButtonText: {
    color: "#1E6A5A",
    fontWeight: "600"
  },
  linkText: {
    color: "#1E6A5A",
    fontWeight: "600"
  },
  jobCard: {
    backgroundColor: "#F8F6F2",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EEE7DC"
  },
  jobCardSelected: {
    borderColor: "#1E6A5A"
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#221E1A",
    marginBottom: 6
  },
  meta: {
    fontSize: 13,
    color: "#5E564F",
    marginBottom: 4
  },
  emptyText: {
    fontSize: 14,
    color: "#5E564F",
    lineHeight: 20
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#E2F0EB",
    color: "#1E6A5A",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 6
  },
  error: {
    color: "#8A1F11",
    backgroundColor: "#FBE9E7",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  },
  notice: {
    color: "#1E6A5A",
    backgroundColor: "#E2F0EB",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  }
});
