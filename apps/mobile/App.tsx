import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { apiFetch, formatApiErrorMessage } from "./src/api";
import { loadApiConfig } from "./src/env";
import { addForegroundNotificationListener, registerForPushNotificationsAsync } from "./src/push";
import { getSupabaseClient } from "./src/supabase";
import { colors } from "./src/theme";
import type {
  ApplicationListResponse,
  ApplicationRow,
  JobListResponse,
  JobRow,
  NotificationListResponse,
  NotificationRow,
  NurseProfile,
  UserRole,
  VerificationDocumentListResponse,
  VerificationDocumentRow,
  VerificationDocumentUploadUrlResponse
} from "./src/types";
import {
  VERIFICATION_BUCKET,
  buildCareRequestTransitionConfirmation,
  buildNurseRequestDetailModel,
  buildNurseWorkflowSnapshot,
  buildPatientWorkflowSnapshot,
  buildWorkflowEvidenceSummary,
  buildCreateCareRequestPayload,
  buildPatientRequestDetailModel,
  buildVerificationStoragePath,
  careRequestProgressSummary,
  careRequestStatusLabel,
  canApplyToCareRequest,
  canCancelJob,
  canCompleteJob,
  emptyJobForm,
  formatDate,
  formatRate,
  latestByCreatedAt,
  nurseApplicationStateLabel,
  nurseEmptyStateCopy,
  patientEmptyStateCopy,
  pickNurseFocusJob,
  pickPatientFocusJob
} from "./src/workflow";

type PatientTab = "home" | "new" | "records" | "updates" | "account";
type NurseTab = "home" | "open" | "work" | "verification" | "updates" | "account";

function getUploadErrorMessage(message: string | undefined) {
  const text = message ?? "";
  if (/permission|not authorized|row-level security|rls|403/i.test(text)) {
    return "Permission denied while uploading the document.";
  }
  return "Unable to upload verification document.";
}

function getRoleHeadline(role: UserRole | null) {
  if (role === "patient") return "Care requests";
  if (role === "nurse") return "Available care work";
  if (role === "admin") return "Admin access";
  return "Trusted care access";
}

function getRoleSubhead(role: UserRole | null) {
  if (role === "patient") return "Request support, track status, and keep your family informed.";
  if (role === "nurse") return "Review eligible requests, apply, and complete assigned care safely.";
  if (role === "admin") return "Use the dispatcher console for assignments and oversight.";
  return "A controlled beta for patients, families, nurses, and care coordinators.";
}

function getStatusTone(status: string) {
  if (status.includes("completed")) return { backgroundColor: colors.successMuted, color: colors.success };
  if (status.includes("cancelled") || status.includes("rejected")) {
    return { backgroundColor: colors.dangerMuted, color: colors.danger };
  }
  if (status.includes("assigned") || status.includes("accepted") || status.includes("approved")) {
    return { backgroundColor: colors.blueMuted, color: colors.blue };
  }
  if (status.includes("pending") || status.includes("applied")) {
    return { backgroundColor: colors.warningMuted, color: colors.warning };
  }
  return { backgroundColor: colors.accentMuted, color: colors.accent };
}

function statusLabel(status: string | null | undefined) {
  if (status === "open" || status === "assigned" || status === "completed" || status === "cancelled") {
    return careRequestStatusLabel(status);
  }
  return (status || "unknown").replace(/_/g, " ");
}

function workflowSummary(job: JobRow) {
  return careRequestProgressSummary(job.status);
}

function StatusPill({ status }: { status: string }) {
  const tone = getStatusTone(status);
  return <Text style={[styles.statusPill, tone]}>{statusLabel(status)}</Text>;
}

function FieldRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value === null || value === undefined || value === "" ? "-" : value}</Text>
    </View>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.snapshotRow}>
      <Text style={styles.snapshotLabel}>{label}</Text>
      <Text style={styles.snapshotValue}>{value}</Text>
    </View>
  );
}

function WorkflowSnapshotPanel({ snapshot }: { snapshot: { status: string; nextStep: string; record: string } }) {
  return (
    <View style={styles.workflowSnapshot}>
      <SnapshotRow label="Status" value={snapshot.status} />
      <SnapshotRow label="Next" value={snapshot.nextStep} />
      <SnapshotRow label="Record" value={snapshot.record} />
    </View>
  );
}

function WorkflowEvidencePanel({
  rows,
  onCopy
}: {
  rows: Array<{ label: string; value: string }>;
  onCopy: () => void;
}) {
  return (
    <View style={styles.evidencePanel}>
      <View style={styles.rowBetween}>
        <Text style={styles.evidenceTitle}>Support snapshot</Text>
        <TouchableOpacity style={styles.evidenceCopyButton} onPress={onCopy}>
          <Text style={styles.evidenceCopyText}>Copy</Text>
        </TouchableOpacity>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.evidenceRow}>
          <Text style={styles.evidenceLabel}>{row.label}</Text>
          <Text style={styles.evidenceValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

type RequestDetailField = {
  label: string;
  value: string | number | null | undefined;
};

type RequestDetailAction = {
  label: string;
  variant: "primary" | "secondary";
  onPress: () => void;
};

function TimelineRow({ label, state }: { label: string; state: "done" | "current" | "pending" }) {
  return (
    <View style={styles.timelineRow}>
      <Text style={[styles.timelineDot, state === "pending" ? styles.timelineDotPending : null]}>
        {state === "pending" ? "" : "ok"}
      </Text>
      <View style={styles.flex}>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineState}>
          {state === "current" ? "Current" : state === "done" ? "Recorded" : "Waiting"}
        </Text>
      </View>
    </View>
  );
}

function RequestDetailPanel({
  eyebrow,
  title,
  summary,
  status,
  description,
  fields,
  timeline,
  actions,
  actionLoading,
  finalText
}: {
  eyebrow: string;
  title: string;
  summary: string;
  status: string;
  description?: string;
  fields: RequestDetailField[];
  timeline?: Array<{ label: string; state: "done" | "current" | "pending" }>;
  actions: RequestDetailAction[];
  actionLoading: boolean;
  finalText?: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionIntro}>{summary}</Text>
        </View>
        <StatusPill status={status.toLowerCase()} />
      </View>

      {description ? <Text style={styles.detailDescription}>{description}</Text> : null}

      <View style={styles.detailGrid}>
        {fields.map((field) => (
          <FieldRow key={field.label} label={field.label} value={field.value} />
        ))}
      </View>

      {timeline ? (
        <View style={styles.timelinePanel}>
          {timeline.map((item) => (
            <TimelineRow key={item.label} label={item.label} state={item.state} />
          ))}
        </View>
      ) : null}

      {actions.length > 0 ? (
        <View style={styles.actionRow}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={action.variant === "primary" ? styles.detailPrimaryAction : styles.detailSecondaryAction}
              onPress={action.onPress}
              disabled={actionLoading}
            >
              <Text
                style={
                  action.variant === "primary" ? styles.detailPrimaryActionText : styles.detailSecondaryActionText
                }
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : finalText ? (
        <Text style={styles.emptyText}>{finalText}</Text>
      ) : null}
    </View>
  );
}

function PatientRequestDetailPanel({
  detail,
  actionLoading,
  onCancel,
  onComplete
}: {
  detail: ReturnType<typeof buildPatientRequestDetailModel>;
  actionLoading: boolean;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const actions: RequestDetailAction[] = [
    ...(detail.canComplete ? [{ label: "Mark complete", variant: "primary" as const, onPress: onComplete }] : []),
    ...(detail.canCancel ? [{ label: "Cancel request", variant: "secondary" as const, onPress: onCancel }] : [])
  ];

  return (
    <RequestDetailPanel
      eyebrow="Current request"
      title={detail.title}
      summary={detail.summary}
      status={detail.status}
      fields={[
        { label: "Assigned caregiver", value: detail.assignedCaregiver },
        { label: "Start", value: detail.start },
        { label: "Location", value: detail.location },
        { label: "Rate", value: detail.rate },
        { label: "Related updates", value: detail.relatedUpdates }
      ]}
      timeline={detail.timeline}
      actions={actions}
      actionLoading={actionLoading}
      finalText="This request is final. Actions are closed, but the record stays visible."
    />
  );
}

function ErrorNotice({ message, onCopy }: { message: string; onCopy: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity style={styles.errorAction} onPress={onCopy}>
        <Text style={styles.errorActionText}>Copy issue details</Text>
      </TouchableOpacity>
    </View>
  );
}

function RequestSummaryCard({
  title,
  status,
  summary,
  fields,
  badge,
  selected,
  onPress,
  actions,
  actionLoading
}: {
  title: string;
  status: string;
  summary: string;
  fields: RequestDetailField[];
  badge?: string | null;
  selected?: boolean;
  onPress?: () => void;
  actions: RequestDetailAction[];
  actionLoading: boolean;
}) {
  const content = (
    <>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.jobTitle}>{title}</Text>
          <Text style={styles.meta}>{summary}</Text>
        </View>
        <StatusPill status={status} />
      </View>
      {fields.map((field) => (
        <FieldRow key={field.label} label={field.label} value={field.value} />
      ))}
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      {actions.length > 0 ? (
        <View style={styles.summaryActionRow}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={action.variant === "primary" ? styles.detailPrimaryAction : styles.detailSecondaryAction}
              onPress={action.onPress}
              disabled={actionLoading}
            >
              <Text
                style={
                  action.variant === "primary" ? styles.detailPrimaryActionText : styles.detailSecondaryActionText
                }
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={[styles.jobCard, selected ? styles.jobCardSelected : null]} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.jobCard, selected ? styles.jobCardSelected : null]}>{content}</View>;
}

function AccountPanel({
  email,
  role,
  baseUrl,
  nurseProfile,
  actionLoading,
  onSignOut
}: {
  email: string | undefined;
  role: UserRole | null;
  baseUrl: string;
  nurseProfile: NurseProfile | null;
  actionLoading: boolean;
  onSignOut: () => void;
}) {
  return (
    <View style={styles.card}>
      <SectionHeader eyebrow="Account" title="Beta access and support" />
      <Text style={styles.sectionIntro}>
        NurseBridge is a closed beta care coordination tool. It is not an emergency service.
      </Text>
      <FieldRow label="Signed in as" value={email ?? "Unknown"} />
      <FieldRow label="Role" value={role ?? "Unknown"} />
      <FieldRow label="API connection" value={baseUrl ? "Connected" : "Not configured"} />
      {role === "nurse" && nurseProfile ? (
        <FieldRow label="Verification status" value={nurseProfile.verification_status} />
      ) : null}
      <View style={styles.supportPanel}>
        <Text style={styles.supportTitle}>Support note</Text>
        <Text style={styles.emptyText}>
          For app issues, copy the issue details when an error appears and send them to the beta operator. For urgent medical or safety needs, use local emergency services or the patient's normal care contact.
        </Text>
      </View>
      <TouchableOpacity style={styles.smallButton} onPress={onSignOut} disabled={actionLoading}>
        <Text style={styles.smallButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function PatientSupportSafetyPanel({ onOpenAccount }: { onOpenAccount: () => void }) {
  return (
    <View style={styles.supportPanel}>
      <Text style={styles.supportTitle}>Support and safety</Text>
      <Text style={styles.emptyText}>
        NurseBridge is for closed-beta care coordination and is not an emergency service. For urgent medical or safety
        needs, use local emergency services or the patient's normal care contact.
      </Text>
      <TouchableOpacity style={styles.textAction} onPress={onOpenAccount}>
        <Text style={styles.linkText}>Open account support</Text>
      </TouchableOpacity>
    </View>
  );
}

function PatientTabBar({
  activeTab,
  onChange
}: {
  activeTab: PatientTab;
  onChange: (tab: PatientTab) => void;
}) {
  const tabs: Array<{ key: PatientTab; label: string }> = [
    { key: "home", label: "Home" },
    { key: "new", label: "New Request" },
    { key: "records", label: "Records" },
    { key: "updates", label: "Updates" },
    { key: "account", label: "Account" }
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, isActive ? styles.tabButtonActive : null]}
            onPress={() => onChange(tab.key)}
          >
            <Text style={[styles.tabButtonText, isActive ? styles.tabButtonTextActive : null]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function NurseTabBar({
  activeTab,
  onChange
}: {
  activeTab: NurseTab;
  onChange: (tab: NurseTab) => void;
}) {
  const tabs: Array<{ key: NurseTab; label: string }> = [
    { key: "home", label: "Home" },
    { key: "open", label: "Open Requests" },
    { key: "work", label: "My Work" },
    { key: "verification", label: "Verification" },
    { key: "updates", label: "Updates" },
    { key: "account", label: "Account" }
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, isActive ? styles.tabButtonActive : null]}
            onPress={() => onChange(tab.key)}
          >
            <Text style={[styles.tabButtonText, isActive ? styles.tabButtonTextActive : null]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function NextActionPanel({
  eyebrow,
  title,
  body,
  status,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  disabled
}: {
  eyebrow: string;
  title: string;
  body: string;
  status?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.nextActionPanel}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.nextActionTitle}>{title}</Text>
        </View>
        {status ? <StatusPill status={status} /> : null}
      </View>
      <Text style={styles.nextActionBody}>{body}</Text>
      {primaryLabel && onPrimary ? (
        <TouchableOpacity style={styles.button} onPress={onPrimary} disabled={disabled}>
          <Text style={styles.buttonText}>{primaryLabel}</Text>
        </TouchableOpacity>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={onSecondary} disabled={disabled}>
          <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function SectionHeader({
  eyebrow,
  title,
  actionLabel,
  onAction,
  disabled
}: {
  eyebrow?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.rowBetween}>
      <View style={styles.flex}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.textAction} onPress={onAction} disabled={disabled}>
          <Text style={[styles.linkText, disabled ? styles.disabledText : null]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
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
  const [patientTab, setPatientTab] = useState<PatientTab>("home");
  const [nurseTab, setNurseTab] = useState<NurseTab>("home");

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
  const activePatientJobs = patientJobs.filter((job) => job.status === "open" || job.status === "assigned").length;
  const assignedNurseJobs = nurseJobs.filter((job) => job.assigned_nurse_user_id === session?.user.id).length;
  const pendingApplications = Object.values(applicationsByJob).filter((application) => application.status === "applied").length;
  const patientFocusJob = useMemo(() => pickPatientFocusJob(patientJobs), [patientJobs]);
  const nurseFocusJob = useMemo(() => pickNurseFocusJob(nurseJobs, session?.user.id), [nurseJobs, session?.user.id]);
  const nurseOpenRequests = useMemo(() => nurseJobs.filter((job) => job.status === "open"), [nurseJobs]);
  const nurseWorkRequests = useMemo(
    () =>
      nurseJobs.filter((job) => {
        const application = applicationsByJob[job.id];
        return job.assigned_nurse_user_id === session?.user.id || Boolean(application);
      }),
    [applicationsByJob, nurseJobs, session?.user.id]
  );
  const latestNotification = useMemo(() => latestByCreatedAt(notifications), [notifications]);
  const patientRequestDetail = useMemo(() => {
    if (role !== "patient" || !patientFocusJob) return null;
    return buildPatientRequestDetailModel({
      job: patientFocusJob,
      jobId: patientFocusJob.id,
      notifications,
      role,
      userId: session?.user.id
    });
  }, [notifications, patientFocusJob, role, session?.user.id]);
  const nurseRequestDetail = useMemo(() => {
    if (role !== "nurse" || !selectedJob) return null;
    return buildNurseRequestDetailModel({
      job: selectedJob,
      isApprovedNurse,
      applicationStatus: applicationsByJob[selectedJob.id]?.status,
      userId: session?.user.id
    });
  }, [applicationsByJob, isApprovedNurse, role, selectedJob, session?.user.id]);
  const workflowSnapshot = useMemo(() => {
    if (role === "patient") {
      return buildPatientWorkflowSnapshot({
        focusJob: patientFocusJob,
        totalRequests: patientJobs.length,
        unreadNotifications: unreadNotificationCount
      });
    }

    if (role === "nurse") {
      return buildNurseWorkflowSnapshot({
        isApproved: isApprovedNurse,
        focusJob: nurseFocusJob,
        userId: session?.user.id,
        pendingApplications,
        availableRequests: nurseJobs.length
      });
    }

    if (role === "admin") {
      return {
        status: "Admin mobile access",
        nextStep: "Use the protected dispatcher console",
        record: `${unreadNotificationCount} unread updates`
      };
    }

    return {
      status: "Signed out",
      nextStep: "Sign in with a beta account",
      record: baseUrl ? "API configured" : "API setup pending"
    };
  }, [
    baseUrl,
    isApprovedNurse,
    nurseFocusJob,
    nurseJobs.length,
    patientFocusJob,
    patientJobs.length,
    pendingApplications,
    role,
    session?.user.id,
    unreadNotificationCount
  ]);
  const dashboardMetrics = useMemo(() => {
    if (role === "patient") {
      return [
        { label: "Active requests", value: activePatientJobs },
        { label: "Total records", value: patientJobs.length },
        { label: "Unread updates", value: unreadNotificationCount }
      ];
    }

    if (role === "nurse") {
      return [
        { label: "Available", value: isApprovedNurse ? nurseJobs.length : 0 },
        { label: "My assignments", value: assignedNurseJobs },
        { label: "Applications", value: pendingApplications }
      ];
    }

    if (role === "admin") {
      return [
        { label: "Mobile role", value: "Admin" },
        { label: "Unread updates", value: unreadNotificationCount },
        { label: "Console", value: "Web" }
      ];
    }

    return [
      { label: "Beta mode", value: "Closed" },
      { label: "API", value: baseUrl ? "Ready" : "Setup" },
      { label: "Access", value: "Invite" }
    ];
  }, [
    activePatientJobs,
    assignedNurseJobs,
    baseUrl,
    isApprovedNurse,
    nurseJobs.length,
    patientJobs.length,
    pendingApplications,
    role,
    unreadNotificationCount
  ]);
  const workflowEvidence = useMemo(() => {
    const focusJob = role === "patient" ? patientFocusJob : role === "nurse" ? nurseFocusJob : null;
    const totalRecords = role === "patient" ? patientJobs.length : role === "nurse" ? nurseJobs.length : 0;

    return buildWorkflowEvidenceSummary({
      role,
      apiConfigured: Boolean(baseUrl),
      focusedRequestId: focusJob?.id,
      focusedRequestStatus: focusJob?.status,
      totalRecords,
      unreadNotifications: unreadNotificationCount
    });
  }, [
    baseUrl,
    nurseFocusJob,
    nurseJobs.length,
    patientFocusJob,
    patientJobs.length,
    role,
    unreadNotificationCount
  ]);

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
        setPatientTab("home");
        setNurseTab("home");
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
      if (nextRole === "patient") setPatientTab("home");
      if (nextRole === "nurse") setNurseTab("home");

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

  async function loadPatientJobs() {
    if (!session) return;

    setScreenLoading(true);
    setError(null);

    try {
      const data = await apiFetch<JobListResponse>(baseUrl, session, "/jobs");
      setPatientJobs(data.jobs ?? []);
    } catch {
      setError("Unable to load your care requests.");
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
        apiFetch<JobListResponse>(baseUrl, session, "/jobs"),
        apiFetch<ApplicationListResponse>(baseUrl, session, "/v1/applications")
      ]);

      const applicationMap: Record<string, ApplicationRow> = {};
      for (const application of applicationData.applications ?? []) {
        applicationMap[application.job_id] = application;
      }

      setNurseJobs(jobsData.jobs ?? []);
      setApplicationsByJob(applicationMap);
    } catch {
      setError("Unable to load care requests.");
    } finally {
      setScreenLoading(false);
    }
  }

  async function loadNotifications() {
    if (!session) return;

    try {
      const data = await apiFetch<NotificationListResponse>(baseUrl, session, "/notifications");
      setNotifications(data.notifications ?? []);
    } catch {
      setError("Unable to load notifications.");
    }
  }

  async function loadVerificationDocuments() {
    if (!session || role !== "nurse") return;

    try {
      const data = await apiFetch<VerificationDocumentListResponse>(
        baseUrl,
        session,
        "/nurse/verification-documents"
      );
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
      const uploadUrl = await apiFetch<VerificationDocumentUploadUrlResponse>(
        baseUrl,
        session,
        "/nurse/verification-documents/upload-url",
        {
          method: "POST",
          body: JSON.stringify({
            storage_path: storagePath
          })
        }
      );
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
        await apiFetch(baseUrl, session, "/nurse/verification-documents", {
          method: "POST",
          body: JSON.stringify({
            storage_bucket: VERIFICATION_BUCKET,
            document_type: documentType,
            storage_path: storagePath
          })
        });
      } catch (err) {
        void supabase.storage.from(VERIFICATION_BUCKET).remove([storagePath]);
        setError(formatApiErrorMessage("File uploaded, but metadata could not be saved.", err));
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
      await apiFetch(baseUrl, session, `/notifications/${notificationId}/read`, { method: "POST" });
      await loadNotifications();
    } catch (err) {
      setError(formatApiErrorMessage("Unable to update notification.", err));
    } finally {
      setActionLoading(false);
    }
  }

  async function markAllNotificationsRead() {
    if (!session) return;

    setActionLoading(true);
    setError(null);

    try {
      await apiFetch(baseUrl, session, "/notifications/read-all", { method: "POST" });
      await loadNotifications();
    } catch (err) {
      setError(formatApiErrorMessage("Unable to update notifications.", err));
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

    const request = buildCreateCareRequestPayload(jobForm);
    if (!request.ok) {
      setError(request.error);
      return;
    }

    setActionLoading(true);
    setError(null);
    setNotice(null);

    try {
      await apiFetch(baseUrl, session, "/jobs", {
        method: "POST",
        body: JSON.stringify(request.payload)
      });

      setJobForm(emptyJobForm);
      setPatientTab("home");
      setNotice("Care request submitted.");
      await loadPatientJobs();
    } catch (err) {
      setError(formatApiErrorMessage("Unable to submit care request.", err));
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
      await apiFetch(baseUrl, session, `/jobs/${job.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ note: "" })
      });

      setSelectedJob(job);
      setNurseTab("work");
      setNotice("Application submitted.");
      await loadNurseJobs();
    } catch (err) {
      setError(formatApiErrorMessage("Unable to apply to care request.", err));
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
      await apiFetch(baseUrl, session, `/jobs/${job.id}/${action}`, { method: "PATCH" });
      setNotice(action === "cancel" ? "Care request cancelled." : "Care request completed.");
      if (role === "patient") {
        await loadPatientJobs();
      } else if (role === "nurse") {
        await loadNurseJobs();
      }
    } catch (err) {
      setError(
        formatApiErrorMessage(
          action === "cancel" ? "Unable to cancel care request." : "Unable to complete care request.",
          err
        )
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function copyErrorDetails() {
    if (!error) return;

    await Clipboard.setStringAsync(error);
    setNotice("Issue details copied.");
  }

  async function copyWorkflowEvidence() {
    await Clipboard.setStringAsync(workflowEvidence.copyText);
    setNotice("Support snapshot copied.");
  }

  function confirmJobTransition(job: JobRow, action: "cancel" | "complete") {
    const confirmation = buildCareRequestTransitionConfirmation(action);
    Alert.alert(
      confirmation.title,
      confirmation.message,
      [
        { text: "Go back", style: "cancel" },
        {
          text: confirmation.confirmLabel,
          style: confirmation.isDestructive ? "destructive" : "default",
          onPress: () => {
            void handleJobTransition(job, action);
          }
        }
      ]
    );
  }

  if (bootLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerPanel}>
          <View style={styles.brandRow}>
            <View>
              <Text style={styles.brandName}>NurseBridge</Text>
              <Text style={styles.brandCaption}>Care coordination beta</Text>
            </View>
            <Text style={styles.environmentTag}>Closed beta</Text>
          </View>
          <Text style={styles.title}>{getRoleHeadline(role)}</Text>
          <Text style={styles.subTitle}>{getRoleSubhead(role)}</Text>
          <WorkflowSnapshotPanel snapshot={workflowSnapshot} />
          <WorkflowEvidencePanel rows={workflowEvidence.rows} onCopy={copyWorkflowEvidence} />
          <View style={styles.metricsGrid}>
            {dashboardMetrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </View>
          <View style={styles.headerMetaRow}>
            <Text style={styles.headerMeta}>Role: {roleLabel}</Text>
            <Text style={styles.headerMeta}>API: {baseUrl ? "connected" : "pending"}</Text>
            {unreadNotificationCount > 0 ? (
              <Text style={styles.headerMeta}>{unreadNotificationCount} unread</Text>
            ) : null}
          </View>
        </View>

        {error ? <ErrorNotice message={error} onCopy={copyErrorDetails} /> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {!session ? (
          <View style={styles.card}>
            <SectionHeader eyebrow="Secure access" title="Sign in to continue" />
            <Text style={styles.sectionIntro}>Use your beta patient, nurse, or admin account.</Text>
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
            {role === "admin" ? (
              <View style={styles.identityPanel}>
                <View style={styles.rowBetween}>
                  <View style={styles.flex}>
                    <Text style={styles.eyebrow}>Signed in</Text>
                    <Text style={styles.sectionTitle}>{session.user.email}</Text>
                    <Text style={styles.meta}>Connected to {baseUrl || "not configured"}</Text>
                  </View>
                  <TouchableOpacity style={styles.smallButton} onPress={handleSignOut} disabled={actionLoading}>
                    <Text style={styles.smallButtonText}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {screenLoading ? (
              <View style={styles.card}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.emptyText}>Loading latest workflow data...</Text>
              </View>
            ) : null}

            {role === "patient" ? <PatientTabBar activeTab={patientTab} onChange={setPatientTab} /> : null}
            {role === "nurse" ? <NurseTabBar activeTab={nurseTab} onChange={setNurseTab} /> : null}

            {role === "patient" && patientTab === "home" ? (
              <>
                <NextActionPanel
                  eyebrow="Patient next action"
                  title={patientFocusJob ? patientFocusJob.title : "Create the first care request"}
                  status={patientFocusJob?.status}
                  body={
                    patientFocusJob
                      ? `${workflowSummary(patientFocusJob)}. Latest update: ${
                          latestNotification?.title ?? "No notification yet"
                        }.`
                      : "Use the request form below to describe the care support needed, where it should happen, and when."
                  }
                  primaryLabel={
                    !patientFocusJob
                      ? "Request care support"
                      : patientFocusJob && canCompleteJob(patientFocusJob, role, session.user.id)
                        ? "Mark complete"
                        : undefined
                  }
                  onPrimary={
                    !patientFocusJob
                      ? () => setPatientTab("new")
                      : patientFocusJob && canCompleteJob(patientFocusJob, role, session.user.id)
                        ? () => confirmJobTransition(patientFocusJob, "complete")
                        : undefined
                  }
                  secondaryLabel={patientFocusJob && canCancelJob(patientFocusJob) ? "Cancel request" : undefined}
                  onSecondary={
                    patientFocusJob && canCancelJob(patientFocusJob)
                      ? () => confirmJobTransition(patientFocusJob, "cancel")
                      : undefined
                  }
                  disabled={actionLoading}
                />
                {patientFocusJob && patientRequestDetail ? (
                  <PatientRequestDetailPanel
                    detail={patientRequestDetail}
                    actionLoading={actionLoading}
                    onCancel={() => confirmJobTransition(patientFocusJob, "cancel")}
                    onComplete={() => confirmJobTransition(patientFocusJob, "complete")}
                  />
                ) : null}
                <PatientSupportSafetyPanel onOpenAccount={() => setPatientTab("account")} />
              </>
            ) : null}

            {role === "nurse" && nurseTab === "home" ? (
              <NextActionPanel
                eyebrow="Nurse next action"
                title={
                  isApprovedNurse
                    ? nurseFocusJob
                      ? nurseFocusJob.title
                      : "Review open requests"
                    : "Complete verification"
                }
                status={isApprovedNurse ? nurseFocusJob?.status : nurseProfile?.verification_status}
                body={
                  isApprovedNurse
                    ? nurseFocusJob
                      ? `${workflowSummary(nurseFocusJob)}. Select a request below to review details before applying or completing assigned work.`
                      : "No open or assigned requests are available right now. Refresh before a scheduled beta test."
                    : "Upload the requested verification document for admin review. This beta does not claim background-check or license-verification completion."
                }
                primaryLabel={
                  isApprovedNurse &&
                  nurseFocusJob &&
                  canCompleteJob(nurseFocusJob, role, session.user.id)
                    ? "Complete assigned care"
                    : undefined
                }
                onPrimary={
                  isApprovedNurse &&
                  nurseFocusJob &&
                  canCompleteJob(nurseFocusJob, role, session.user.id)
                    ? () => confirmJobTransition(nurseFocusJob, "complete")
                    : undefined
                }
                secondaryLabel={!isApprovedNurse ? "Choose document" : nurseFocusJob ? "View details" : "Refresh"}
                onSecondary={
                  !isApprovedNurse
                    ? () => setNurseTab("verification")
                    : nurseFocusJob
                      ? () => {
                          setSelectedJob(nurseFocusJob);
                          setNurseTab(nurseFocusJob.assigned_nurse_user_id === session.user.id ? "work" : "open");
                        }
                      : loadNurseJobs
                }
                disabled={actionLoading || screenLoading}
              />
            ) : null}

            {role === "admin" ? (
              <NextActionPanel
                eyebrow="Admin next action"
                title="Use the dispatcher console"
                body="Mobile admin access is intentionally limited. Assignment, verification review, and audit work belong in the protected web console."
                status="web console"
              />
            ) : null}

            {role === "admin" || (role === "patient" && patientTab === "updates") || (role === "nurse" && nurseTab === "updates") ? (
              <View style={styles.card}>
                <SectionHeader
                  eyebrow="Updates"
                  title={`Notifications (${unreadNotificationCount})`}
                  actionLabel="Refresh"
                  onAction={loadNotifications}
                  disabled={screenLoading || actionLoading}
                />
                {unreadNotificationCount > 0 ? (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={markAllNotificationsRead}
                    disabled={actionLoading}
                  >
                    <Text style={styles.secondaryButtonText}>Mark all as read</Text>
                  </TouchableOpacity>
                ) : null}
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
            ) : null}

            {role === "patient" ? (
              <>
                {patientTab === "account" ? (
                  <AccountPanel
                    email={session.user.email}
                    role={role}
                    baseUrl={baseUrl}
                    nurseProfile={nurseProfile}
                    actionLoading={actionLoading}
                    onSignOut={handleSignOut}
                  />
                ) : null}

                {patientTab === "new" ? (
                  <View style={styles.card}>
                    <SectionHeader eyebrow="Patient workflow" title="Request care support" />
                    <Text style={styles.sectionIntro}>
                      Submit only the details needed for closed-beta review, assignment, and follow-up. This is not an emergency service or a full medical chart.
                    </Text>
                    <Text style={styles.inputLabel}>Support type or request title *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Appointment support, check-in, post-surgery help"
                      value={jobForm.title}
                      onChangeText={(text) => setJobForm((prev) => ({ ...prev, title: text }))}
                    />
                    <Text style={styles.inputLabel}>Care details</Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      placeholder="Care need, appointment context, or family notes"
                      multiline
                      value={jobForm.description}
                      onChangeText={(text) => setJobForm((prev) => ({ ...prev, description: text }))}
                    />
                    <Text style={styles.inputLabel}>Contact context</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Who should be contacted or met during this request"
                      value={jobForm.contact_context}
                      onChangeText={(text) => setJobForm((prev) => ({ ...prev, contact_context: text }))}
                    />
                    <Text style={styles.inputLabel}>Mobility/support notes</Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      placeholder="Walker, wheelchair, stairs, transfer support, or other practical notes"
                      multiline
                      value={jobForm.mobility_notes}
                      onChangeText={(text) => setJobForm((prev) => ({ ...prev, mobility_notes: text }))}
                    />
                    <Text style={styles.inputLabel}>Location</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Service address or meeting location"
                      value={jobForm.address}
                      onChangeText={(text) => setJobForm((prev) => ({ ...prev, address: text }))}
                    />
                    <Text style={styles.inputLabel}>Requested date/time</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Start time, for example 2026-05-01T14:00:00Z"
                      autoCapitalize="none"
                      value={jobForm.start_time}
                      onChangeText={(text) => setJobForm((prev) => ({ ...prev, start_time: text }))}
                    />
                    <Text style={styles.inputLabel}>Hourly rate, if used in this beta</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Optional hourly rate"
                      keyboardType="numeric"
                      value={jobForm.hourly_rate}
                      onChangeText={(text) => setJobForm((prev) => ({ ...prev, hourly_rate: text }))}
                    />
                    <TouchableOpacity style={styles.button} onPress={handleCreateJob} disabled={actionLoading}>
                      {actionLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.buttonText}>Submit care request</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                {patientTab === "records" ? (
                  <View style={styles.card}>
                    <SectionHeader
                      eyebrow="Request status"
                      title="My care requests"
                      actionLabel="Refresh"
                      onAction={loadPatientJobs}
                      disabled={screenLoading || actionLoading}
                    />
                  {patientJobs.length === 0 ? (
                    <Text style={styles.emptyText}>{patientEmptyStateCopy()}</Text>
                  ) : (
                    patientJobs.map((job) => (
                      <RequestSummaryCard
                        key={job.id}
                        title={job.title}
                        status={job.status}
                        summary={workflowSummary(job)}
                        fields={[
                          { label: "Assigned nurse", value: job.assigned_nurse_name ?? job.assigned_nurse_user_id },
                          { label: "Start", value: formatDate(job.start_time) },
                          { label: "Rate", value: formatRate(job.hourly_rate) }
                        ]}
                        actions={[
                          ...(canCancelJob(job)
                            ? [
                                {
                                  label: "Cancel request",
                                  variant: "secondary" as const,
                                  onPress: () => confirmJobTransition(job, "cancel")
                                }
                              ]
                            : []),
                          ...(canCompleteJob(job, role, session.user.id)
                            ? [
                                {
                                  label: "Mark complete",
                                  variant: "primary" as const,
                                  onPress: () => confirmJobTransition(job, "complete")
                                }
                              ]
                            : [])
                        ]}
                        actionLoading={actionLoading}
                      />
                    ))
                  )}
                  </View>
                ) : null}
              </>
            ) : null}

            {role === "nurse" && nurseTab === "open" ? (
              <View style={styles.card}>
                <SectionHeader
                  eyebrow="Nurse workflow"
                  title="Open requests"
                  actionLabel="Refresh"
                  onAction={loadNurseJobs}
                  disabled={screenLoading || actionLoading}
                />
                {!isApprovedNurse ? (
                  <Text style={styles.emptyText}>{nurseEmptyStateCopy(false)}</Text>
                ) : nurseOpenRequests.length === 0 ? (
                  <Text style={styles.emptyText}>{nurseEmptyStateCopy(true)}</Text>
                ) : (
                  nurseOpenRequests.map((job) => {
                    const application = applicationsByJob[job.id];
                    const applicationLabel = nurseApplicationStateLabel(application?.status);
                    const canApply = canApplyToCareRequest({
                      jobStatus: job.status,
                      isApprovedNurse,
                      applicationStatus: application?.status
                    });
                    return (
                      <RequestSummaryCard
                        key={job.id}
                        title={job.title}
                        status={job.status}
                        summary={workflowSummary(job)}
                        fields={[
                          { label: "Start", value: formatDate(job.start_time) },
                          { label: "Rate", value: formatRate(job.hourly_rate) }
                        ]}
                        badge={applicationLabel}
                        selected={selectedJob?.id === job.id}
                        onPress={() => setSelectedJob(job)}
                        actions={
                          canApply
                            ? [
                                {
                                  label: "Apply for request",
                                  variant: "primary" as const,
                                  onPress: () => handleApply(job)
                                }
                              ]
                            : []
                        }
                        actionLoading={actionLoading}
                      />
                    );
                  })
                )}
              </View>
            ) : null}

            {role === "nurse" && nurseTab === "work" ? (
              <View style={styles.card}>
                <SectionHeader
                  eyebrow="Nurse workflow"
                  title="My work"
                  actionLabel="Refresh"
                  onAction={loadNurseJobs}
                  disabled={screenLoading || actionLoading}
                />
                {!isApprovedNurse ? (
                  <Text style={styles.emptyText}>Verification approval is required before assigned work appears.</Text>
                ) : nurseWorkRequests.length === 0 ? (
                  <Text style={styles.emptyText}>No applications or assigned care requests yet.</Text>
                ) : (
                  nurseWorkRequests.map((job) => {
                    const application = applicationsByJob[job.id];
                    const applicationLabel = nurseApplicationStateLabel(application?.status);
                    return (
                      <RequestSummaryCard
                        key={job.id}
                        title={job.title}
                        status={job.status}
                        summary={workflowSummary(job)}
                        fields={[
                          { label: "Start", value: formatDate(job.start_time) },
                          { label: "Rate", value: formatRate(job.hourly_rate) }
                        ]}
                        badge={applicationLabel}
                        selected={selectedJob?.id === job.id}
                        onPress={() => setSelectedJob(job)}
                        actions={
                          job.status === "assigned" && job.assigned_nurse_user_id === session.user.id
                            ? [
                                {
                                  label: "Complete care",
                                  variant: "primary" as const,
                                  onPress: () => confirmJobTransition(job, "complete")
                                }
                              ]
                            : []
                        }
                        actionLoading={actionLoading}
                      />
                    );
                  })
                )}
              </View>
            ) : null}

            {role === "nurse" && nurseTab === "verification" ? (
              <View style={styles.card}>
                <SectionHeader
                  eyebrow="Credentialing"
                  title="Verification documents"
                  actionLabel="Refresh"
                  onAction={loadVerificationDocuments}
                  disabled={screenLoading || actionLoading}
                />
                <Text style={styles.emptyText}>
                  Upload requested documents for admin review after you are comfortable sharing them for beta
                  verification. Approval is not automatic, and this beta does not claim background-check or license-verification completion.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Document type"
                  autoCapitalize="none"
                  value={verificationDocumentType}
                  onChangeText={setVerificationDocumentType}
                />
                <TouchableOpacity style={styles.button} onPress={uploadVerificationDocument} disabled={actionLoading}>
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Choose and upload</Text>
                  )}
                </TouchableOpacity>
                {verificationDocuments.length === 0 ? (
                  <Text style={styles.emptyText}>No verification documents saved.</Text>
                ) : (
                  verificationDocuments.map((document) => (
                    <View key={document.id} style={styles.jobCard}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.jobTitle}>{document.document_type}</Text>
                        <StatusPill status={document.status} />
                      </View>
                      <FieldRow label="Created" value={formatDate(document.created_at)} />
                      {document.rejection_reason ? <Text style={styles.meta}>Reason: {document.rejection_reason}</Text> : null}
                    </View>
                  ))
                )}
              </View>
            ) : null}

            {role === "nurse" && (nurseTab === "open" || nurseTab === "work") && selectedJob && nurseRequestDetail ? (
              <RequestDetailPanel
                eyebrow="Selected request"
                title={nurseRequestDetail.title}
                summary={nurseRequestDetail.summary}
                status={nurseRequestDetail.status}
                description={nurseRequestDetail.description}
                fields={[
                  { label: "Application", value: nurseRequestDetail.applicationState },
                  { label: "Location", value: nurseRequestDetail.location },
                  { label: "Start", value: nurseRequestDetail.start },
                  { label: "Rate", value: nurseRequestDetail.rate }
                ]}
                actions={[
                  ...(nurseRequestDetail.canApply
                    ? [
                        {
                          label: "Apply for request",
                          variant: "primary" as const,
                          onPress: () => handleApply(selectedJob)
                        }
                      ]
                    : []),
                  ...(nurseRequestDetail.canComplete
                    ? [
                        {
                          label: "Complete care",
                          variant: "secondary" as const,
                          onPress: () => confirmJobTransition(selectedJob, "complete")
                        }
                      ]
                    : [])
                ]}
                actionLoading={actionLoading}
                finalText="No action is available for this request right now."
              />
            ) : null}

            {role === "nurse" && nurseTab === "account" ? (
              <AccountPanel
                email={session.user.email}
                role={role}
                baseUrl={baseUrl}
                nurseProfile={nurseProfile}
                actionLoading={actionLoading}
                onSignOut={handleSignOut}
              />
            ) : null}

            {role === "admin" ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Admin Account</Text>
                <Text style={styles.emptyText}>Use the web admin portal to assign nurses to patient care requests.</Text>
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
    backgroundColor: colors.background
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.background
  },
  content: {
    padding: 14,
    paddingBottom: 44
  },
  headerPanel: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    marginBottom: 16,
    padding: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16
  },
  brandName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  brandCaption: {
    color: "#B8C6D1",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  environmentTag: {
    backgroundColor: colors.accentMuted,
    borderRadius: 6,
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 9,
    paddingVertical: 4,
    textTransform: "uppercase"
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8
  },
  subTitle: {
    fontSize: 14,
    color: "#D5DEE6",
    lineHeight: 20,
    marginBottom: 14
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14
  },
  metricTile: {
    backgroundColor: "#1B2A35",
    borderColor: "#314452",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 68,
    padding: 10,
    justifyContent: "space-between"
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900"
  },
  metricLabel: {
    color: "#B8C6D1",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    textTransform: "uppercase"
  },
  workflowSnapshot: {
    backgroundColor: "#162532",
    borderColor: "#334657",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14
  },
  evidencePanel: {
    backgroundColor: "#102030",
    borderColor: "#334657",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12
  },
  evidenceTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8
  },
  evidenceCopyButton: {
    backgroundColor: "#E8EEF5",
    borderRadius: 6,
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  evidenceCopyText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900"
  },
  evidenceRow: {
    borderTopColor: "#24384A",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingVertical: 7
  },
  evidenceLabel: {
    color: "#AFC0CC",
    flex: 0.9,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  evidenceValue: {
    color: "#FFFFFF",
    flex: 1.5,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
    textAlign: "right"
  },
  snapshotRow: {
    borderBottomColor: "#2B3D4D",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  snapshotLabel: {
    color: "#AFC0CC",
    flex: 0.8,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  snapshotValue: {
    color: "#FFFFFF",
    flex: 1.6,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
    textAlign: "right"
  },
  headerMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  headerMeta: {
    backgroundColor: "#243241",
    borderRadius: 999,
    color: "#E8EEF5",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 15,
    marginBottom: 12
  },
  identityPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    padding: 15,
    marginBottom: 12
  },
  nextActionPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.accent,
    borderLeftWidth: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 15
  },
  nextActionTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 24,
    marginBottom: 8
  },
  nextActionBody: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    padding: 8
  },
  tabButton: {
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  tabButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  tabButtonText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800"
  },
  tabButtonTextActive: {
    color: "#FFFFFF"
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
  textAction: {
    paddingHorizontal: 2,
    paddingVertical: 2
  },
  flex: {
    flex: 1
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 8
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 4,
    textTransform: "uppercase"
  },
  sectionIntro: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12
  },
  inlineStatus: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  detailGrid: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    marginBottom: 12
  },
  detailDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12
  },
  timelinePanel: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  timelineRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 48,
    paddingVertical: 8
  },
  timelineDot: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    height: 24,
    lineHeight: 24,
    overflow: "hidden",
    textAlign: "center",
    width: 24
  },
  timelineDotPending: {
    backgroundColor: colors.borderStrong
  },
  timelineLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  timelineState: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  actionRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  summaryActionRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10
  },
  detailPrimaryAction: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  detailPrimaryActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800"
  },
  detailSecondaryAction: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  detailSecondaryActionText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800"
  },
  supportPanel: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    marginTop: 10,
    padding: 12
  },
  supportTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    backgroundColor: colors.surface
  },
  inputLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6
  },
  multilineInput: {
    minHeight: 84,
    textAlignVertical: "top"
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 8
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600"
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  secondaryButtonText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800"
  },
  smallButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 10
  },
  smallButtonText: {
    color: colors.accent,
    fontWeight: "700"
  },
  linkText: {
    color: colors.accent,
    fontWeight: "700"
  },
  disabledText: {
    color: colors.mutedSoft
  },
  jobCard: {
    backgroundColor: colors.surfaceMuted,
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  jobCardSelected: {
    borderColor: colors.accent
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 6
  },
  meta: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentMuted,
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    marginTop: 6
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
    textTransform: "uppercase"
  },
  fieldRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 8
  },
  fieldLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: "700"
  },
  fieldValue: {
    color: colors.ink,
    flex: 1.4,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right"
  },
  errorBox: {
    backgroundColor: colors.dangerMuted,
    borderColor: "#F0C6BF",
    borderWidth: 1,
    padding: 12,
    borderRadius: 6,
    marginBottom: 12
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10
  },
  errorAction: {
    alignSelf: "flex-start",
    borderColor: colors.danger,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  errorActionText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800"
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerMuted,
    borderColor: "#F0C6BF",
    borderWidth: 1,
    padding: 12,
    borderRadius: 6,
    marginBottom: 12
  },
  notice: {
    color: colors.accent,
    backgroundColor: colors.accentMuted,
    borderColor: "#BBD8D2",
    borderWidth: 1,
    padding: 12,
    borderRadius: 6,
    marginBottom: 12
  }
});
