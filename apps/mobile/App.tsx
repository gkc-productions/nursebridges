import React, { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch, apiPublicFetch, formatApiErrorMessage } from "./src/api";
import { loadApiConfig } from "./src/env";
import {
  getNurseWorkspaceTitle,
  NURSE_WORKSPACE_TABS,
  type NurseWorkspaceTab
} from "./src/nurseNavigation";
import {
  buildPatientAccessRequestPayload,
  emptyPatientAccessForm,
  type PatientAccessForm
} from "./src/onboarding";
import { addForegroundNotificationListener, registerForPushNotificationsAsync } from "./src/push";
import {
  canUseMobileProduct,
  nurseProductAccessMessage,
  patientProductAccessMessage,
  type MobileProductId
} from "./src/product";
import { getSupabaseClient } from "./src/supabase";
import { lightColors, type ThemeColors } from "./src/theme";
import type {
  ApplicationListResponse,
  ApplicationRow,
  CareCircleListResponse,
  CareCircleRecipientRow,
  JobMessageListResponse,
  JobMessageRow,
  JobListResponse,
  JobRow,
  NotificationListResponse,
  NotificationRow,
  NurseProfile,
  PatientVisitFeedbackRow,
  RecurringCarePlanListResponse,
  RecurringCarePlanRow,
  TrustedNurse,
  TrustedNurseResponse,
  UserRole,
  VisitCoordinationResponse,
  VisitEventRow,
  VisitEventType,
  VisitReportRow,
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
  emptyJobForm,
  formatServiceArea,
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
type NurseTab = NurseWorkspaceTab;
type EntryScreen = "welcome" | "start" | "signin" | "access" | "submitted";
type RequestStep = 1 | 2 | 3 | 4 | 5;
type RequestPickerState = { field: "start_time" | "pickup_time"; mode: "date" | "time" };

const visitCheckpointTypes: VisitEventType[] = [
  "pre_visit_confirmed",
  "en_route",
  "arrived",
  "patient_met",
  "facility_check_in",
  "appointment_started",
  "appointment_ended",
  "return_started",
  "patient_handoff",
  "visit_completed"
];

const visitCheckpointLabels: Record<VisitEventType, string> = {
  pre_visit_confirmed: "Pre-visit plan confirmed",
  en_route: "En route",
  arrived: "Arrived at residence",
  patient_met: "Patient met",
  facility_check_in: "Facility check-in",
  appointment_started: "Appointment started",
  appointment_ended: "Appointment ended",
  return_started: "Return trip started",
  patient_handoff: "Patient safely handed off",
  visit_completed: "Visit documentation complete",
  escalation_requested: "Escalation requested"
};

type VisitReportDraft = {
  visit_summary: string;
  provider_instructions: string;
  follow_up_tasks: string;
  transportation_outcome: string;
};

const emptyVisitReportDraft: VisitReportDraft = {
  visit_summary: "",
  provider_instructions: "",
  follow_up_tasks: "",
  transportation_outcome: ""
};

let colors: ThemeColors = lightColors;
let styles = createStyles(colors);
const patientBrandMark = require("./assets/brand/nursebridge-mark.png");
const nurseBrandMark = require("../nurse/assets/brand/nursebridges-care-mark.png");

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

function defaultAppointmentDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function selectedAppointmentDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function appointmentDateLabel(value: string) {
  const date = selectedAppointmentDate(value);
  return date
    ? date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : "Select date";
}

function appointmentTimeLabel(value: string) {
  const date = selectedAppointmentDate(value);
  return date ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Select time";
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
  onCancel
}: {
  detail: ReturnType<typeof buildPatientRequestDetailModel>;
  actionLoading: boolean;
  onCancel: () => void;
}) {
  const actions: RequestDetailAction[] = [
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
        { label: "Residence", value: detail.location },
        { label: "Arrival and access", value: detail.access },
        { label: "Mobility", value: detail.mobility },
        { label: "Transportation", value: detail.transportation },
        { label: "On-site contact", value: detail.onsiteContact },
        { label: "Pricing", value: detail.rate },
        { label: "Related updates", value: detail.relatedUpdates }
      ]}
      timeline={detail.timeline}
      actions={actions}
      actionLoading={actionLoading}
      finalText="This request is final. Actions are closed, but the record stays visible."
    />
  );
}

function NurseVisitExecutionPanel({
  events,
  report,
  reportDraft,
  actionLoading,
  onReportChange,
  onRecordEvent,
  onSaveReport,
  onEscalate,
  onFinalize
}: {
  events: VisitEventRow[];
  report: VisitReportRow | null;
  reportDraft: VisitReportDraft;
  actionLoading: boolean;
  onReportChange: (field: keyof VisitReportDraft, value: string) => void;
  onRecordEvent: (eventType: VisitEventType) => void;
  onSaveReport: (status: "draft" | "submitted") => void;
  onEscalate: () => void;
  onFinalize: () => void;
}) {
  const recorded = new Set(events.filter((event) => event.event_type !== "escalation_requested").map((event) => event.event_type));
  const nextCheckpoint = visitCheckpointTypes.find((eventType) => !recorded.has(eventType));
  const handoffRecorded = recorded.has("patient_handoff");
  const visitCompletedRecorded = recorded.has("visit_completed");
  const reportSubmitted = report?.status === "submitted" || report?.status === "amended";
  const canRecordNext = nextCheckpoint !== undefined && (nextCheckpoint !== "visit_completed" || reportSubmitted);

  return (
    <View style={styles.card}>
      <SectionHeader eyebrow="Active visit" title="Visit execution and handoff" />
      <Text style={styles.sectionIntro}>
        Record each checkpoint when it actually happens. Do not enter diagnoses, full medical histories, or credentials.
      </Text>
      <View style={styles.timelinePanel}>
        {visitCheckpointTypes.map((eventType) => (
          <TimelineRow
            key={eventType}
            label={visitCheckpointLabels[eventType]}
            state={recorded.has(eventType) ? "done" : nextCheckpoint === eventType ? "current" : "pending"}
          />
        ))}
      </View>
      {canRecordNext && nextCheckpoint ? (
        <TouchableOpacity style={styles.button} onPress={() => onRecordEvent(nextCheckpoint)} disabled={actionLoading}>
          <Text style={styles.buttonText}>Record: {visitCheckpointLabels[nextCheckpoint]}</Text>
        </TouchableOpacity>
      ) : nextCheckpoint === "visit_completed" && !reportSubmitted ? (
        <Text style={styles.emptyText}>Submit the visit report before closing documentation.</Text>
      ) : null}
      {visitCompletedRecorded && reportSubmitted ? (
        <TouchableOpacity style={styles.button} onPress={onFinalize} disabled={actionLoading}>
          <Text style={styles.buttonText}>Finalize care request</Text>
        </TouchableOpacity>
      ) : null}

      {handoffRecorded ? (
        <View style={styles.supportPanel}>
          <Text style={styles.supportTitle}>Structured visit report</Text>
          <Text style={styles.inputLabel}>What support was provided? *</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            multiline
            value={reportDraft.visit_summary}
            onChangeText={(value) => onReportChange("visit_summary", value)}
            placeholder="Describe coordination and accompaniment performed"
            placeholderTextColor={colors.mutedSoft}
          />
          <Text style={styles.inputLabel}>Provider instructions</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            multiline
            value={reportDraft.provider_instructions}
            onChangeText={(value) => onReportChange("provider_instructions", value)}
            placeholder="Record only instructions explicitly provided, including the source"
            placeholderTextColor={colors.mutedSoft}
          />
          <Text style={styles.inputLabel}>Follow-up tasks</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            multiline
            value={reportDraft.follow_up_tasks}
            onChangeText={(value) => onReportChange("follow_up_tasks", value)}
            placeholder="Scheduling, pharmacy, transport, or family follow-up"
            placeholderTextColor={colors.mutedSoft}
          />
          <Text style={styles.inputLabel}>Transportation outcome</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            multiline
            value={reportDraft.transportation_outcome}
            onChangeText={(value) => onReportChange("transportation_outcome", value)}
            placeholder="How the outbound and return plan concluded"
            placeholderTextColor={colors.mutedSoft}
          />
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.detailSecondaryAction} onPress={() => onSaveReport("draft")} disabled={actionLoading}>
              <Text style={styles.detailSecondaryActionText}>Save draft</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailPrimaryAction} onPress={() => onSaveReport("submitted")} disabled={actionLoading || !reportDraft.visit_summary.trim()}>
              <Text style={styles.detailPrimaryActionText}>{reportSubmitted ? "Update report" : "Submit report"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <TouchableOpacity style={styles.secondaryButton} onPress={onEscalate} disabled={actionLoading}>
        <Text style={styles.secondaryButtonText}>Request operational escalation</Text>
      </TouchableOpacity>
      <Text style={styles.formPrivacyNote}>For emergencies, use local emergency services. This button alerts the NurseBridges operations workflow only.</Text>
    </View>
  );
}

function PatientVisitOutcomePanel({
  report,
  feedback,
  rating,
  comments,
  wouldRebook,
  preferSameNurse,
  actionLoading,
  onRating,
  onComments,
  onWouldRebook,
  onPreferSameNurse,
  onSubmit,
  recurringCadence,
  onRecurringCadence,
  onRequestRecurring,
  onStartRebooking
}: {
  report: VisitReportRow | null;
  feedback: PatientVisitFeedbackRow | null;
  rating: number;
  comments: string;
  wouldRebook: boolean | null;
  preferSameNurse: boolean;
  actionLoading: boolean;
  onRating: (rating: number) => void;
  onComments: (comments: string) => void;
  onWouldRebook: (value: boolean) => void;
  onPreferSameNurse: (value: boolean) => void;
  onSubmit: () => void;
  recurringCadence: "weekly" | "biweekly" | "monthly";
  onRecurringCadence: (value: "weekly" | "biweekly" | "monthly") => void;
  onRequestRecurring: () => void;
  onStartRebooking: () => void;
}) {
  return (
    <View style={styles.card}>
      <SectionHeader eyebrow="After the visit" title="Summary and feedback" />
      {report && report.status !== "draft" ? (
        <View style={styles.supportPanel}>
          <FieldRow label="Visit summary" value={report.visit_summary} />
          <FieldRow label="Provider instructions" value={report.provider_instructions} />
          <FieldRow label="Follow-up tasks" value={report.follow_up_tasks} />
          <FieldRow label="Transportation outcome" value={report.transportation_outcome} />
        </View>
      ) : (
        <Text style={styles.emptyText}>The nurse’s submitted visit summary will appear here.</Text>
      )}
      <Text style={styles.inputLabel}>Rate your experience</Text>
      <View style={styles.choiceWrap}>
        {[1, 2, 3, 4, 5].map((value) => (
          <TouchableOpacity key={value} style={[styles.choiceButton, styles.compactChoiceButton, rating === value ? styles.choiceButtonActive : null]} onPress={() => onRating(value)}>
            <Text style={[styles.choiceButtonText, rating === value ? styles.choiceButtonTextActive : null]}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.inputLabel}>Private feedback for the care team</Text>
      <TextInput style={[styles.input, styles.multilineInput]} multiline value={comments} onChangeText={onComments} placeholder="What worked well, or what should improve?" placeholderTextColor={colors.mutedSoft} />
      <Text style={styles.inputLabel}>Would you use NurseBridges again?</Text>
      <ChoiceGroup value={wouldRebook === true ? "yes" : wouldRebook === false ? "no" : "unsure"} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unsure", label: "Not sure" }]} onChange={(value) => value !== "unsure" && onWouldRebook(value === "yes")} />
      <TouchableOpacity style={[styles.choiceButton, preferSameNurse ? styles.choiceButtonActive : null]} onPress={() => onPreferSameNurse(!preferSameNurse)}>
        <Text style={[styles.choiceButtonText, preferSameNurse ? styles.choiceButtonTextActive : null]}>Prefer the same nurse next time</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={actionLoading || rating < 1}>
        <Text style={styles.buttonText}>{feedback ? "Update feedback" : "Submit feedback"}</Text>
      </TouchableOpacity>
      <Text style={styles.formPrivacyNote}>Your feedback and rebooking preference are visible to NurseBridges administrators, not the nurse.</Text>
      <Text style={styles.supportTitle}>Need this support again?</Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={onStartRebooking} disabled={actionLoading}>
        <Text style={styles.secondaryButtonText}>Start another request with these details</Text>
      </TouchableOpacity>
      <Text style={styles.formPrivacyNote}>We copy the practical plan for review, but clear the date, pickup time, and arrival instructions because they may have changed.</Text>
      <ChoiceGroup value={recurringCadence} options={[{ value: "weekly", label: "Weekly" }, { value: "biweekly", label: "Every 2 weeks" }, { value: "monthly", label: "Monthly" }]} onChange={(value) => onRecurringCadence(value as "weekly" | "biweekly" | "monthly")} />
      <TouchableOpacity style={styles.secondaryButton} onPress={onRequestRecurring} disabled={actionLoading}>
        <Text style={styles.secondaryButtonText}>Request recurring care review</Text>
      </TouchableOpacity>
      <Text style={styles.formPrivacyNote}>Each future visit is reviewed by the care team. This does not schedule, charge, or automatically assign a nurse.</Text>
    </View>
  );
}

function PatientVisitProgressPanel({ events }: { events: VisitEventRow[] }) {
  const recorded = new Set(events.map((event) => event.event_type));
  const visibleCheckpoints = visitCheckpointTypes.filter((eventType) => eventType !== "visit_completed");
  const next = visibleCheckpoints.find((eventType) => !recorded.has(eventType));
  return (
    <View style={styles.card}>
      <SectionHeader eyebrow="Visit day" title="Live care progress" />
      <Text style={styles.sectionIntro}>Operational milestones appear here as your nurse records them.</Text>
      <View style={styles.timelinePanel}>
        {visibleCheckpoints.map((eventType) => (
          <TimelineRow
            key={eventType}
            label={visitCheckpointLabels[eventType]}
            state={recorded.has(eventType) ? "done" : next === eventType ? "current" : "pending"}
          />
        ))}
      </View>
      {events.some((event) => event.event_type === "escalation_requested") ? <Text style={styles.error}>The operations team has been asked to review this visit.</Text> : null}
    </View>
  );
}

function RecurringCarePanel({ plans }: { plans: RecurringCarePlanRow[] }) {
  const activePlans = plans.filter((plan) => !["cancelled", "completed"].includes(plan.status));
  if (!activePlans.length) return null;
  return <View style={styles.card}>
    <SectionHeader eyebrow="Ongoing support" title="Recurring-care requests" />
    <Text style={styles.sectionIntro}>A recurring pattern never guarantees a visit. The care team reviews scope, availability, assignment, and pricing for every occurrence.</Text>
    {activePlans.map((plan) => <View style={styles.supportPanel} key={plan.id}>
      <FieldRow label="Pattern" value={plan.cadence === "biweekly" ? "Every 2 weeks" : plan.cadence.replace(/^./, (letter) => letter.toUpperCase())} />
      <FieldRow label="Preferred time" value={`${plan.local_time.slice(0, 5)} · ${plan.timezone}`} />
      <FieldRow label="Begins" value={new Date(`${plan.starts_on}T12:00:00`).toLocaleDateString()} />
      <FieldRow label="Status" value={plan.status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())} />
      <Text style={styles.formPrivacyNote}>{plan.status === "pending_review" ? "A coordinator is reviewing this request." : plan.status === "active" ? "The pattern is approved; individual visits still require confirmation." : "This pattern is currently paused."}</Text>
    </View>)}
  </View>;
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
  supportRows,
  actionLoading,
  onSignOut,
  onCopySupport
}: {
  email: string | undefined;
  role: UserRole | null;
  baseUrl: string;
  nurseProfile: NurseProfile | null;
  supportRows?: Array<{ label: string; value: string }>;
  actionLoading: boolean;
  onSignOut: () => void;
  onCopySupport?: () => void;
}) {
  return (
    <View style={styles.card}>
      <SectionHeader eyebrow="Account" title="Beta access and support" />
      <Text style={styles.sectionIntro}>
        NurseBridges is a closed beta care coordination tool. It is not an emergency service.
      </Text>
      <FieldRow label="Signed in as" value={email ?? "Unknown"} />
      <FieldRow label="Role" value={role ?? "Unknown"} />
      <FieldRow label="API connection" value={baseUrl ? "Connected" : "Not configured"} />
      {role === "nurse" && nurseProfile ? (
        <FieldRow label="Verification status" value={nurseProfile.verification_status} />
      ) : null}
      {supportRows && onCopySupport ? <SupportSnapshotPanel rows={supportRows} onCopy={onCopySupport} /> : null}
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

function SupportSnapshotPanel({ rows, onCopy }: { rows: Array<{ label: string; value: string }>; onCopy: () => void }) {
  return (
    <View style={styles.supportSnapshot}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.supportTitle}>Support snapshot</Text>
          <Text style={styles.supportSnapshotIntro}>Share this technical summary if the beta team asks. It excludes care details.</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" style={styles.supportCopyButton} onPress={onCopy}>
          <Text style={styles.supportCopyButtonText}>Copy</Text>
        </TouchableOpacity>
      </View>
      {rows.map((row) => <FieldRow key={row.label} label={row.label} value={row.value} />)}
    </View>
  );
}

function PatientSupportSafetyPanel({ onOpenAccount }: { onOpenAccount: () => void }) {
  return (
    <View style={styles.supportPanel}>
      <Text style={styles.supportTitle}>Support and safety</Text>
      <Text style={styles.emptyText}>
        NurseBridges is for closed-beta care coordination and is not an emergency service. For urgent medical or safety
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
  const tabs: Array<{ key: PatientTab; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = [
    { key: "home", label: "Home", icon: "home-outline" },
    { key: "new", label: "Care", icon: "add-circle-outline" },
    { key: "updates", label: "Messages", icon: "chatbubble-ellipses-outline" },
    { key: "records", label: "Activity", icon: "receipt-outline" },
    { key: "account", label: "Account", icon: "person-circle-outline" }
  ];

  return (
    <View style={styles.patientTabBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            style={styles.patientTabButton}
            onPress={() => onChange(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={21}
              style={[styles.patientTabIcon, isActive ? styles.patientTabIconActive : null]}
            />
            <Text style={[styles.patientTabLabel, isActive ? styles.patientTabLabelActive : null]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PatientQuickActions({
  unreadCount,
  onRequest,
  onActivity,
  onUpdates
}: {
  unreadCount: number;
  onRequest: () => void;
  onActivity: () => void;
  onUpdates: () => void;
}) {
  const actions = [
    { label: "Request care", detail: "Tell us what you need", icon: "add-circle-outline", onPress: onRequest },
    { label: "View activity", detail: "Follow every request", icon: "receipt-outline", onPress: onActivity },
    {
      label: "Messages",
      detail: unreadCount > 0 ? `${unreadCount} new ${unreadCount === 1 ? "message" : "messages"}` : "You're all caught up",
      icon: "notifications-outline",
      onPress: onUpdates
    }
  ];

  return (
    <View style={styles.quickActionsSection}>
      <Text style={styles.homeSectionTitle}>What would you like to do?</Text>
      <View style={styles.quickActionsGrid}>
        {actions.map((action) => (
          <TouchableOpacity
            accessibilityRole="button"
            key={action.label}
            style={styles.quickActionCard}
            onPress={action.onPress}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons
                name={action.icon as React.ComponentProps<typeof Ionicons>["name"]}
                size={20}
                color={colors.accentDark}
              />
            </View>
            <Text style={styles.quickActionTitle}>{action.label}</Text>
            <Text style={styles.quickActionDetail}>{action.detail}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function NurseTabBar({
  activeTab,
  onChange,
  unreadCount
}: {
  activeTab: NurseTab;
  onChange: (tab: NurseTab) => void;
  unreadCount: number;
}) {
  return (
    <View style={styles.nurseTabBar}>
      {NURSE_WORKSPACE_TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            style={styles.nurseTabButton}
            onPress={() => onChange(tab.key)}
          >
            <View style={styles.nurseTabIconWrap}>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={21}
                style={[styles.nurseTabIcon, isActive ? styles.nurseTabIconActive : null]}
              />
              {tab.key === "inbox" && unreadCount > 0 ? (
                <View style={styles.nurseTabBadge}>
                  <Text style={styles.nurseTabBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.nurseTabLabel, isActive ? styles.nurseTabLabelActive : null]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function NurseWorkspaceHeader({
  activeTab,
  isApproved,
  availableCount,
  assignmentCount,
  unreadCount
}: {
  activeTab: NurseTab;
  isApproved: boolean;
  availableCount: number;
  assignmentCount: number;
  unreadCount: number;
}) {
  const context =
    activeTab === "home"
      ? isApproved
        ? `${availableCount} opportunities available`
        : "Verification required before applying"
      : activeTab === "find"
        ? `${availableCount} open opportunities`
        : activeTab === "schedule"
          ? `${assignmentCount} ${assignmentCount === 1 ? "assignment" : "assignments"}`
          : activeTab === "inbox"
            ? unreadCount > 0
              ? `${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"}`
              : "You’re all caught up"
            : isApproved
              ? "Credentials approved"
              : "Credentials under review";

  return (
    <View style={styles.nurseWorkspaceHeader}>
      <View style={styles.nurseWorkspaceBrandRow}>
        <View style={styles.nurseWorkspaceIdentity}>
          <View style={styles.nurseWorkspaceLogoWrap}>
            <Image source={nurseBrandMark} style={styles.nurseWorkspaceLogo} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.nurseWorkspaceBrand}>NurseBridges Care</Text>
            <Text style={styles.nurseWorkspaceCaption}>Professional workspace</Text>
          </View>
        </View>
        <View style={[styles.nurseReadinessPill, !isApproved ? styles.nurseReadinessPillPending : null]}>
          <View style={[styles.nurseReadinessDot, !isApproved ? styles.nurseReadinessDotPending : null]} />
          <Text style={[styles.nurseReadinessText, !isApproved ? styles.nurseReadinessTextPending : null]}>
            {isApproved ? "Ready" : "Review"}
          </Text>
        </View>
      </View>
      <Text style={styles.nurseWorkspaceTitle}>{getNurseWorkspaceTitle(activeTab)}</Text>
      <Text style={styles.nurseWorkspaceContext}>{context}</Text>
    </View>
  );
}

function NurseHomeOverview({
  availableCount,
  assignmentCount,
  unreadCount,
  onFindWork,
  onSchedule,
  onInbox
}: {
  availableCount: number;
  assignmentCount: number;
  unreadCount: number;
  onFindWork: () => void;
  onSchedule: () => void;
  onInbox: () => void;
}) {
  const actions = [
    { label: "Find work", value: availableCount, icon: "search-outline", onPress: onFindWork },
    { label: "Schedule", value: assignmentCount, icon: "calendar-outline", onPress: onSchedule },
    { label: "Inbox", value: unreadCount, icon: "chatbubble-ellipses-outline", onPress: onInbox }
  ];

  return (
    <View style={styles.nurseOverviewSection}>
      <View style={styles.nurseSectionHeading}>
        <View>
          <Text style={styles.eyebrow}>Today</Text>
          <Text style={styles.nurseSectionTitle}>Work at a glance</Text>
        </View>
        <Text style={styles.nurseSectionMeta}>Live</Text>
      </View>
      <View style={styles.nurseOverviewGrid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}, ${action.value}`}
            style={styles.nurseOverviewCard}
            onPress={action.onPress}
          >
            <View style={styles.nurseOverviewIcon}>
              <Ionicons
                name={action.icon as React.ComponentProps<typeof Ionicons>["name"]}
                size={19}
                color={colors.accentDark}
              />
            </View>
            <Text style={styles.nurseOverviewValue}>{action.value}</Text>
            <Text style={styles.nurseOverviewLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
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

function RequestProgress({ step }: { step: RequestStep }) {
  const labels = ["Need", "Schedule", "Home", "Ride", "Review"];
  return (
    <View style={styles.requestProgress} accessibilityLabel={`Care request step ${step} of 5`}>
      {labels.map((label, index) => {
        const position = (index + 1) as RequestStep;
        const isComplete = position < step;
        const isCurrent = position === step;
        return (
          <View key={label} style={styles.requestProgressItem}>
            <View style={[styles.requestProgressDot, isComplete || isCurrent ? styles.requestProgressDotActive : null]}>
              <Text style={[styles.requestProgressNumber, isComplete || isCurrent ? styles.requestProgressNumberActive : null]}>
                {isComplete ? "✓" : position}
              </Text>
            </View>
            <Text style={[styles.requestProgressLabel, isCurrent ? styles.requestProgressLabelActive : null]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ChoiceGroup<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choiceWrap}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={option.value}
            style={[styles.choiceButton, styles.compactChoiceButton, active ? styles.choiceButtonActive : null]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.choiceButtonText, active ? styles.choiceButtonTextActive : null]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function App({ product = "patient" }: { product?: MobileProductId }) {
  colors = lightColors;
  styles = createStyles(colors);
  const isNurseProduct = product === "nurse";
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
  const [entryScreen, setEntryScreen] = useState<EntryScreen>("welcome");
  const [accessForm, setAccessForm] = useState<PatientAccessForm>(emptyPatientAccessForm);
  const [patientTab, setPatientTab] = useState<PatientTab>("home");
  const [requestStep, setRequestStep] = useState<RequestStep>(1);
  const [requestPicker, setRequestPicker] = useState<RequestPickerState | null>(null);
  const [nurseTab, setNurseTab] = useState<NurseTab>("home");

  const [patientJobs, setPatientJobs] = useState<JobRow[]>([]);
  const [nurseJobs, setNurseJobs] = useState<JobRow[]>([]);
  const [applicationsByJob, setApplicationsByJob] = useState<Record<string, ApplicationRow>>({});
  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [verificationDocuments, setVerificationDocuments] = useState<VerificationDocumentRow[]>([]);
  const [visitEvents, setVisitEvents] = useState<VisitEventRow[]>([]);
  const [visitReport, setVisitReport] = useState<VisitReportRow | null>(null);
  const [visitFeedback, setVisitFeedback] = useState<PatientVisitFeedbackRow | null>(null);
  const [visitReportDraft, setVisitReportDraft] = useState<VisitReportDraft>(emptyVisitReportDraft);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComments, setFeedbackComments] = useState("");
  const [feedbackWouldRebook, setFeedbackWouldRebook] = useState<boolean | null>(null);
  const [feedbackPreferSameNurse, setFeedbackPreferSameNurse] = useState(false);
  const [recurringCadence, setRecurringCadence] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [arrivalPin, setArrivalPin] = useState<string | null>(null);
  const [careCircleRecipients, setCareCircleRecipients] = useState<CareCircleRecipientRow[]>([]);
  const [careCircleName, setCareCircleName] = useState("");
  const [careCircleRelationship, setCareCircleRelationship] = useState("");
  const [careCircleEmail, setCareCircleEmail] = useState("");
  const [jobMessages, setJobMessages] = useState<JobMessageRow[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [trustedNurse, setTrustedNurse] = useState<TrustedNurse | null>(null);
  const [recurringCarePlans, setRecurringCarePlans] = useState<RecurringCarePlanRow[]>([]);

  const [jobForm, setJobForm] = useState(emptyJobForm);
  const [verificationDocumentType, setVerificationDocumentType] = useState("license");
  const lastAutoLoadKey = useRef<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const requestCardYRef = useRef<number | null>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const splashScale = useRef(new Animated.Value(0.82)).current;
  const splashOpacity = useRef(new Animated.Value(0.35)).current;

  function revealActiveForm() {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
  }

  useEffect(() => {
    if (role !== "patient") return;

    const timeout = setTimeout(() => {
      if (patientTab !== "new") {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }

      const requestCardY = requestCardYRef.current;
      if (requestCardY === null) return;
      scrollViewRef.current?.scrollTo({ y: Math.max(requestCardY - 12, 0), animated: true });
    }, 120);

    return () => clearTimeout(timeout);
  }, [patientTab, requestStep, role]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(splashScale, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(splashOpacity, { toValue: 1, duration: 500, useNativeDriver: true })
        ]),
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(splashScale, { toValue: 0.92, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(splashOpacity, { toValue: 0.72, duration: 520, useNativeDriver: true })
        ])
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [splashOpacity, splashScale]);

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
  const latestPatientNotification = useMemo(
    () =>
      patientFocusJob
        ? latestByCreatedAt(
            notifications.filter(
              (notification) => notification.entity_type === "job" && notification.entity_id === patientFocusJob.id
            )
          )
        : undefined,
    [notifications, patientFocusJob]
  );
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
  const workflowEvidence = useMemo(() => {
    const focusedRequest = role === "patient" ? patientFocusJob : role === "nurse" ? nurseFocusJob : null;
    const totalRecords = role === "patient" ? patientJobs.length : role === "nurse" ? nurseJobs.length : 0;
    return buildWorkflowEvidenceSummary({
      role,
      apiConfigured: Boolean(baseUrl),
      focusedRequestId: focusedRequest?.id,
      focusedRequestStatus: focusedRequest?.status,
      totalRecords,
      unreadNotifications: unreadNotificationCount
    });
  }, [baseUrl, nurseFocusJob, nurseJobs.length, patientFocusJob, patientJobs.length, role, unreadNotificationCount]);
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
      setVisitEvents([]);
      setVisitReport(null);
      setVisitFeedback(null);
      setVisitReportDraft(emptyVisitReportDraft);
      setCareCircleRecipients([]);

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
    setNotice(null);
  }, [patientTab, nurseTab, session?.user.id]);

  useEffect(() => {
    if (!session || !baseUrl) return;
    const job = role === "nurse" ? selectedJob : role === "patient" ? patientFocusJob : null;
    const patientVisitUnavailable = role === "patient" && !["assigned", "completed"].includes(job?.status ?? "");
    if (!job || patientVisitUnavailable || (role === "nurse" && job.assigned_nurse_user_id !== session.user.id)) {
      setVisitEvents([]);
      setVisitReport(null);
      setVisitFeedback(null);
      return;
    }
    void loadVisitCoordination(job.id);
  }, [baseUrl, patientFocusJob?.id, role, selectedJob?.id, session?.user.id]);

  useEffect(() => {
    if (role === "patient" && patientTab === "account" && session && baseUrl) {
      void loadCareCircle();
    }
  }, [baseUrl, patientTab, role, session?.user.id]);

  useEffect(() => {
    if (role !== "patient" || !session || !baseUrl || !patientFocusJob) {
      setJobMessages([]);
      return;
    }
    if (patientTab === "updates") void loadJobMessages(patientFocusJob.id);
  }, [baseUrl, patientFocusJob?.id, patientTab, role, session?.user.id]);

  useEffect(() => {
    if (role !== "patient" || !session || !baseUrl || patientFocusJob?.status !== "assigned") {
      setTrustedNurse(null);
      return;
    }
    void loadTrustedNurse(patientFocusJob.id);
  }, [baseUrl, patientFocusJob?.id, patientFocusJob?.status, role, session?.user.id]);

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
      const [data, recurring] = await Promise.all([
        apiFetch<JobListResponse>(baseUrl, session, "/jobs"),
        apiFetch<RecurringCarePlanListResponse>(baseUrl, session, "/marketplace/recurring-care").catch(() => ({ plans: [] }))
      ]);
      setPatientJobs(data.jobs ?? []);
      setRecurringCarePlans(recurring.plans ?? []);
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

  async function loadVisitCoordination(jobId: string) {
    if (!session) return;
    try {
      const data = await apiFetch<VisitCoordinationResponse>(baseUrl, session, `/jobs/${jobId}/visit`);
      setVisitEvents(data.events ?? []);
      setVisitReport(data.report ?? null);
      setVisitFeedback(data.feedback ?? null);
      setVisitReportDraft({
        visit_summary: data.report?.visit_summary ?? "",
        provider_instructions: data.report?.provider_instructions ?? "",
        follow_up_tasks: data.report?.follow_up_tasks ?? "",
        transportation_outcome: data.report?.transportation_outcome ?? ""
      });
      if (data.feedback) {
        setFeedbackRating(data.feedback.rating);
        setFeedbackComments(data.feedback.comments ?? "");
        setFeedbackWouldRebook(data.feedback.would_rebook);
        setFeedbackPreferSameNurse(data.feedback.prefer_same_nurse);
      }
    } catch (err) {
      setError(formatApiErrorMessage("Unable to load visit progress.", err));
    }
  }

  async function loadCareCircle() {
    if (!session || role !== "patient") return;
    try {
      const data = await apiFetch<CareCircleListResponse>(baseUrl, session, "/care-circle");
      setCareCircleRecipients(data.recipients ?? []);
    } catch (err) {
      setError(formatApiErrorMessage("Unable to load your care circle.", err));
    }
  }

  async function loadJobMessages(jobId: string) {
    if (!session) return;
    try {
      const data = await apiFetch<JobMessageListResponse>(baseUrl, session, `/jobs/${jobId}/messages`);
      setJobMessages(data.messages ?? []);
    } catch (err) {
      setError(formatApiErrorMessage("Unable to load request messages.", err));
    }
  }

  async function sendJobMessage(jobId: string) {
    if (!session || !messageDraft.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(baseUrl, session, `/jobs/${jobId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: messageDraft })
      });
      setMessageDraft("");
      setNotice("Message sent to this request.");
      await loadJobMessages(jobId);
    } catch (err) {
      setError(formatApiErrorMessage("Unable to send this message.", err));
    } finally {
      setActionLoading(false);
    }
  }

  async function loadTrustedNurse(jobId: string) {
    if (!session) return;
    try {
      const data = await apiFetch<TrustedNurseResponse>(baseUrl, session, `/jobs/${jobId}/trusted-nurse`);
      setTrustedNurse(data.nurse ?? null);
    } catch (err) {
      setTrustedNurse(null);
      setError(formatApiErrorMessage("Unable to load the assigned nurse profile.", err));
    }
  }

  async function addCareCircleRecipient() {
    if (!session || role !== "patient") return;
    if (!careCircleName.trim() || !careCircleRelationship.trim() || !careCircleEmail.trim()) {
      setError("Enter a name, relationship, and email address.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(baseUrl, session, "/care-circle", {
        method: "POST",
        body: JSON.stringify({
          display_name: careCircleName,
          relationship: careCircleRelationship,
          email: careCircleEmail,
          job_id: patientFocusJob?.id,
          receive_milestones: true,
          receive_summary: true
        })
      });
      setCareCircleName("");
      setCareCircleRelationship("");
      setCareCircleEmail("");
      setNotice("Care-circle invitation saved. No updates are shared until the recipient accepts.");
      await loadCareCircle();
    } catch (err) {
      setError(formatApiErrorMessage("Unable to add this care-circle recipient.", err));
    } finally {
      setActionLoading(false);
    }
  }

  async function revokeCareCircleRecipient(recipientId: string) {
    if (!session || role !== "patient") return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(baseUrl, session, `/care-circle/${recipientId}`, { method: "DELETE" });
      setNotice("Care-circle access revoked.");
      await loadCareCircle();
    } catch (err) {
      setError(formatApiErrorMessage("Unable to revoke this recipient.", err));
    } finally {
      setActionLoading(false);
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

  function showEntryScreen(nextScreen: EntryScreen) {
    setError(null);
    setNotice(null);
    setEntryScreen(nextScreen);
  }

  function updateAccessForm<K extends keyof PatientAccessForm>(key: K, value: PatientAccessForm[K]) {
    setAccessForm((current) => ({ ...current, [key]: value }));
  }

  async function handlePatientAccessRequest() {
    const request = buildPatientAccessRequestPayload(accessForm);
    if (!request.ok) {
      setError(request.error);
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await apiPublicFetch(baseUrl, "/v1/access-requests/patient", {
        method: "POST",
        body: JSON.stringify(request.value)
      });
      setEntryScreen("submitted");
    } catch (err) {
      setError(formatApiErrorMessage("Unable to send your request right now.", err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      setError("Mobile app is missing Supabase configuration.");
      return;
    }

    setActionLoading(true);
    await supabase.auth.signOut();
    setEntryScreen("welcome");
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
      setRequestStep(1);
      setRequestPicker(null);
      setPatientTab("home");
      setNotice("Care request submitted.");
      await loadPatientJobs();
    } catch (err) {
      setError(formatApiErrorMessage("Unable to submit care request.", err));
    } finally {
      setActionLoading(false);
    }
  }

  function handleAppointmentPickerChange(event: DateTimePickerEvent, selectedValue?: Date) {
    if (Platform.OS !== "ios" || event.type === "dismissed") {
      setRequestPicker(null);
    }
    if (event.type === "dismissed" || !selectedValue || !requestPicker) return;

    const currentValue = jobForm[requestPicker.field];
    const next = selectedAppointmentDate(currentValue) ?? selectedAppointmentDate(jobForm.start_time) ?? defaultAppointmentDate();
    if (requestPicker.mode === "date") {
      next.setFullYear(selectedValue.getFullYear(), selectedValue.getMonth(), selectedValue.getDate());
    } else {
      next.setHours(selectedValue.getHours(), selectedValue.getMinutes(), 0, 0);
    }
    setJobForm((previous) => ({ ...previous, [requestPicker.field]: next.toISOString() }));
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
      setNurseTab("schedule");
      setNotice("Application submitted.");
      await loadNurseJobs();
    } catch (err) {
      setError(formatApiErrorMessage("Unable to apply to care request.", err));
    } finally {
      setActionLoading(false);
    }
  }

  async function recordVisitEvent(job: JobRow, eventType: VisitEventType) {
    if (!session || role !== "nurse") return;
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(baseUrl, session, `/jobs/${job.id}/visit/events`, {
        method: "POST",
        body: JSON.stringify({ event_type: eventType })
      });
      if (eventType === "visit_completed") {
        await apiFetch(baseUrl, session, `/jobs/${job.id}/complete`, { method: "PATCH" });
        setNotice("Visit documented and care request completed.");
        await loadNurseJobs();
      } else {
        setNotice(`${visitCheckpointLabels[eventType]} recorded.`);
      }
      await loadVisitCoordination(job.id);
    } catch (err) {
      setError(formatApiErrorMessage("Unable to record this visit checkpoint.", err));
    } finally {
      setActionLoading(false);
    }
  }

  async function saveVisitReport(job: JobRow, status: "draft" | "submitted") {
    if (!session || role !== "nurse") return;
    if (status === "submitted" && !visitReportDraft.visit_summary.trim()) {
      setError("Add a visit summary before submitting the report.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(baseUrl, session, `/jobs/${job.id}/visit/report`, {
        method: "PUT",
        body: JSON.stringify({ status, ...visitReportDraft })
      });
      setNotice(status === "submitted" ? "Visit report submitted." : "Visit report draft saved.");
      await loadVisitCoordination(job.id);
    } catch (err) {
      setError(formatApiErrorMessage("Unable to save the visit report.", err));
    } finally {
      setActionLoading(false);
    }
  }

  function confirmVisitEscalation(job: JobRow) {
    Alert.alert(
      "Request operational support?",
      "This records an escalation for the NurseBridges operations team. Call local emergency services for urgent medical or safety needs.",
      [
        { text: "Go back", style: "cancel" },
        { text: "Request support", onPress: () => void recordVisitEvent(job, "escalation_requested") }
      ]
    );
  }

  async function submitPatientFeedback(job: JobRow) {
    if (!session || role !== "patient") return;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(baseUrl, session, `/jobs/${job.id}/feedback`, {
        method: "PUT",
        body: JSON.stringify({
          rating: feedbackRating,
          comments: feedbackComments,
          would_rebook: feedbackWouldRebook ?? undefined,
          prefer_same_nurse: feedbackPreferSameNurse
        })
      });
      if (feedbackPreferSameNurse && job.assigned_nurse_user_id) {
        await apiFetch(baseUrl, session, "/marketplace/preferences", {
          method: "PUT",
          body: JSON.stringify({
            nurse_user_id: job.assigned_nurse_user_id,
            source_job_id: job.id,
            status: "preferred"
          })
        });
      }
      setNotice("Thank you. Your private feedback was saved.");
      await loadVisitCoordination(job.id);
    } catch (err) {
      setError(formatApiErrorMessage("Unable to save feedback.", err));
    } finally {
      setActionLoading(false);
    }
  }

  async function createPatientArrivalPin(job: JobRow) {
    if (!session || role !== "patient") return;
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ pin: string }>(baseUrl, session, `/jobs/${job.id}/arrival-pin`, { method: "POST" });
      setArrivalPin(data.pin);
      setNotice("Arrival PIN created. Share it with the assigned nurse in person.");
    } catch (err) {
      setError(formatApiErrorMessage("Unable to create the arrival PIN.", err));
    } finally {
      setActionLoading(false);
    }
  }

  async function requestRecurringCare(job: JobRow) {
    if (!session || role !== "patient") return;
    const source = job.start_time ? new Date(job.start_time) : new Date();
    const starts = new Date(source.getTime() + 7 * 24 * 60 * 60 * 1000);
    const localTime = `${starts.getHours().toString().padStart(2, "0")}:${starts.getMinutes().toString().padStart(2, "0")}:00`;
    const startsOn = `${starts.getFullYear()}-${(starts.getMonth() + 1).toString().padStart(2, "0")}-${starts.getDate().toString().padStart(2, "0")}`;
    setActionLoading(true);
    setError(null);
    try {
      await apiFetch(baseUrl, session, "/marketplace/recurring-care", {
        method: "POST",
        body: JSON.stringify({
          source_job_id: job.id,
          preferred_nurse_user_id: feedbackPreferSameNurse ? job.assigned_nurse_user_id ?? undefined : undefined,
          cadence: recurringCadence,
          starts_on: startsOn,
          local_time: localTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      setNotice("Recurring care request sent for coordinator review.");
      await loadPatientJobs();
    } catch (err) {
      setError(formatApiErrorMessage("Unable to request recurring care.", err));
    } finally {
      setActionLoading(false);
    }
  }

  function startRebooking(job: JobRow) {
    const logistics = job.logistics;
    setJobForm({
      ...emptyJobForm,
      title: job.title,
      description: job.description ?? "",
      residence_type: logistics?.residence_type ?? emptyJobForm.residence_type,
      street_address: logistics?.street_address ?? "",
      unit: logistics?.unit ?? "",
      building_name: logistics?.building_name ?? "",
      city: logistics?.city ?? job.service_city ?? "",
      state: logistics?.state ?? job.service_state ?? "GA",
      postal_code: logistics?.postal_code ?? "",
      stairs: logistics?.stairs ?? emptyJobForm.stairs,
      elevator_available: logistics?.elevator_available == null ? "unknown" : logistics.elevator_available ? "yes" : "no",
      meeting_point: logistics?.meeting_point ?? "",
      parking_notes: logistics?.parking_notes ?? "",
      arrival_instructions: "",
      mobility_aids: logistics?.mobility_aids ?? [],
      mobility_notes: logistics?.mobility_notes ?? "",
      onsite_contact_name: logistics?.onsite_contact_name ?? "",
      onsite_contact_relationship: logistics?.onsite_contact_relationship ?? "",
      onsite_contact_phone: logistics?.onsite_contact_phone ?? "",
      transportation_mode: (logistics?.transportation_mode as typeof emptyJobForm.transportation_mode | undefined) ?? emptyJobForm.transportation_mode,
      transportation_provider: logistics?.transportation_provider ?? "",
      pickup_time: "",
      return_plan: (logistics?.return_plan as typeof emptyJobForm.return_plan | undefined) ?? emptyJobForm.return_plan,
      transportation_notes: logistics?.transportation_notes ?? ""
    });
    setRequestStep(2);
    setPatientTab("new");
    setNotice("Previous practical details copied. Choose a new date and review every step before submitting.");
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
        <Animated.View style={[styles.splashMark, { opacity: splashOpacity, transform: [{ scale: splashScale }] }]}>
          <Image source={isNurseProduct ? nurseBrandMark : patientBrandMark} style={styles.splashImage} />
        </Animated.View>
        <Text style={styles.splashName}>{isNurseProduct ? "NurseBridges Care" : "NurseBridges"}</Text>
        <Text style={styles.meta}>{isNurseProduct ? "Your workday, connected." : "Care is on the way."}</Text>
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

  if (session && role && !canUseMobileProduct(product, role)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.productGate}>
          <Image source={isNurseProduct ? nurseBrandMark : patientBrandMark} style={styles.productGateLogo} />
          <Text style={styles.eyebrow}>Account destination</Text>
          <Text style={styles.productGateTitle}>
            You’re signed in to the {isNurseProduct ? "Care" : "Patient"} app
          </Text>
          <Text style={styles.productGateBody}>
            {isNurseProduct ? nurseProductAccessMessage(role) : patientProductAccessMessage(role)}
          </Text>
          <Text style={styles.productGateHint}>
            Your account and data are unchanged. Sign out here, then use the correct NurseBridges product.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Sign out of the NurseBridges Patient app"
            style={styles.button}
            onPress={handleSignOut}
            disabled={actionLoading}
          >
            {actionLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign out</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.content,
          session && role === "patient" ? styles.patientContent : null,
          session && role === "nurse" ? styles.nurseContent : null
        ]}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {!session ? (
          <View style={styles.loginShell}>
            <View style={styles.loginHero}>
              <View style={styles.loginTopRow}>
                <Image source={isNurseProduct ? nurseBrandMark : patientBrandMark} style={styles.loginLogo} />
              </View>
              <Text style={styles.loginBrandName}>{isNurseProduct ? "NurseBridges Care" : "NurseBridges"}</Text>
              <Text style={styles.loginHeroTitle}>
                {isNurseProduct ? "Care work, clearly organized." : "Care coordination that feels clear."}
              </Text>
              <Text style={styles.loginHeroBody}>
                {isNurseProduct
                  ? "Manage opportunities, credentials, assigned visits, and updates in one professional workspace."
                  : "Request trusted support, follow every update, and keep the people you care about informed."}
              </Text>
            </View>
            {error ? <ErrorNotice message={error} onCopy={copyErrorDetails} /> : null}

            {entryScreen === "welcome" ? (
              <View style={styles.loginCard}>
                <Text style={styles.eyebrow}>{isNurseProduct ? "Nurses and caregivers" : "Patient and family"}</Text>
                <Text style={styles.loginTitle}>
                  {isNurseProduct ? "Your care-work companion" : "Start with what you need"}
                </Text>
                <Text style={styles.sectionIntro}>
                  {isNurseProduct
                    ? "Return to your invited professional account or review how closed-beta access works."
                    : "Join the closed beta or return to an existing NurseBridges account."}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.entryPrimaryButton}
                  onPress={() => showEntryScreen(isNurseProduct ? "signin" : "start")}
                >
                  <Text style={styles.entryPrimaryButtonText}>{isNurseProduct ? "Sign in" : "Get started"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.entrySecondaryButton}
                  onPress={() => showEntryScreen(isNurseProduct ? "start" : "signin")}
                >
                  <Text style={styles.entrySecondaryButtonText}>
                    {isNurseProduct ? "How professional access works" : "Sign in"}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.loginSafety}>Not for emergencies. For urgent needs, contact local emergency services.</Text>
              </View>
            ) : null}

            {entryScreen === "start" ? (
              <View style={styles.loginCard}>
                <TouchableOpacity accessibilityRole="button" onPress={() => showEntryScreen("welcome")}>
                  <Text style={styles.backLink}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.eyebrow}>{isNurseProduct ? "Professional access" : "Closed beta access"}</Text>
                <Text style={styles.loginTitle}>
                  {isNurseProduct ? "Invitation, verification, activation" : "How would you like to continue?"}
                </Text>
                <Text style={styles.sectionIntro}>
                  {isNurseProduct
                    ? "NurseBridges Care is invitation-only during this beta. Sign in, complete requested credential steps, and wait for activation before opportunities become available."
                    : "Invitations unlock an existing account. New patients and families can request early access without sharing care details."}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.entryPrimaryButton}
                  onPress={() => showEntryScreen("signin")}
                >
                  <Text style={styles.entryPrimaryButtonText}>
                    {isNurseProduct ? "Continue to professional sign in" : "I have an invitation"}
                  </Text>
                </TouchableOpacity>
                {!isNurseProduct ? <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.entrySecondaryButton}
                  onPress={() => showEntryScreen("access")}
                >
                  <Text style={styles.entrySecondaryButtonText}>Request early access</Text>
                </TouchableOpacity> : null}
              </View>
            ) : null}

            {entryScreen === "signin" ? (
              <View style={styles.loginCard}>
                <TouchableOpacity accessibilityRole="button" onPress={() => showEntryScreen("welcome")}>
                  <Text style={styles.backLink}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.eyebrow}>{isNurseProduct ? "Secure professional access" : "Secure patient access"}</Text>
                <Text style={styles.loginTitle}>Welcome back</Text>
                <Text style={styles.sectionIntro}>
                  Sign in with the account from your {isNurseProduct ? "NurseBridges Care" : "NurseBridges"} invitation.
                </Text>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  accessibilityLabel="Email address"
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.mutedSoft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onFocus={revealActiveForm}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  value={email}
                  onChangeText={setEmail}
                />
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  ref={passwordInputRef}
                  accessibilityLabel="Password"
                  style={styles.input}
                  placeholder="Your password"
                  placeholderTextColor={colors.mutedSoft}
                  autoComplete="current-password"
                  secureTextEntry
                  textContentType="password"
                  returnKeyType="go"
                  onFocus={revealActiveForm}
                  onSubmitEditing={handleSignIn}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Continue securely"
                  style={styles.entryPrimaryButton}
                  onPress={handleSignIn}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.entryPrimaryButtonText}>Continue securely</Text>}
                </TouchableOpacity>
                <Text style={styles.loginSafety}>Only use credentials from your NurseBridges invitation.</Text>
              </View>
            ) : null}

            {entryScreen === "access" && !isNurseProduct ? (
              <View style={styles.loginCard}>
                <TouchableOpacity accessibilityRole="button" onPress={() => showEntryScreen("start")}>
                  <Text style={styles.backLink}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.eyebrow}>Request early access</Text>
                <Text style={styles.loginTitle}>Tell us where to reach you</Text>
                <Text style={styles.sectionIntro}>
                  Please do not include diagnoses, medical details, documents, or care instructions.
                </Text>

                <Text style={styles.inputLabel}>Full name</Text>
                <TextInput
                  accessibilityLabel="Full name"
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={colors.mutedSoft}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  onFocus={revealActiveForm}
                  value={accessForm.fullName}
                  onChangeText={(value) => updateAccessForm("fullName", value)}
                />
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  accessibilityLabel="Early access email address"
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.mutedSoft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  onFocus={revealActiveForm}
                  value={accessForm.email}
                  onChangeText={(value) => updateAccessForm("email", value)}
                />
                <Text style={styles.inputLabel}>Phone (optional)</Text>
                <TextInput
                  accessibilityLabel="Phone number"
                  style={styles.input}
                  placeholder="(555) 555-0100"
                  placeholderTextColor={colors.mutedSoft}
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  onFocus={revealActiveForm}
                  value={accessForm.phone}
                  onChangeText={(value) => updateAccessForm("phone", value)}
                />
                <Text style={styles.inputLabel}>City or ZIP code</Text>
                <TextInput
                  accessibilityLabel="City or ZIP code"
                  style={styles.input}
                  placeholder="Your general service area"
                  placeholderTextColor={colors.mutedSoft}
                  autoCapitalize="words"
                  onFocus={revealActiveForm}
                  value={accessForm.serviceArea}
                  onChangeText={(value) => updateAccessForm("serviceArea", value)}
                />

                <Text style={styles.inputLabel}>Who are you requesting access for?</Text>
                <View style={styles.choiceRow}>
                  <TouchableOpacity
                    accessibilityRole="radio"
                    accessibilityState={{ selected: accessForm.requesterType === "patient" }}
                    style={[styles.choiceButton, accessForm.requesterType === "patient" ? styles.choiceButtonActive : null]}
                    onPress={() => updateAccessForm("requesterType", "patient")}
                  >
                    <Text style={[styles.choiceButtonText, accessForm.requesterType === "patient" ? styles.choiceButtonTextActive : null]}>Myself</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="radio"
                    accessibilityState={{ selected: accessForm.requesterType === "family" }}
                    style={[styles.choiceButton, accessForm.requesterType === "family" ? styles.choiceButtonActive : null]}
                    onPress={() => updateAccessForm("requesterType", "family")}
                  >
                    <Text style={[styles.choiceButtonText, accessForm.requesterType === "family" ? styles.choiceButtonTextActive : null]}>A family member</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accessForm.contactConsent }}
                  style={styles.consentRow}
                  onPress={() => updateAccessForm("contactConsent", !accessForm.contactConsent)}
                >
                  <View style={[styles.checkbox, accessForm.contactConsent ? styles.checkboxChecked : null]}>
                    <Text style={styles.checkboxMark}>{accessForm.contactConsent ? "✓" : ""}</Text>
                  </View>
                  <Text style={styles.consentText}>I agree that NurseBridges may contact me about closed-beta access.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.entryPrimaryButton}
                  onPress={handlePatientAccessRequest}
                  disabled={actionLoading}
                >
                  {actionLoading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.entryPrimaryButtonText}>Request early access</Text>}
                </TouchableOpacity>
                <Text style={styles.loginSafety}>Submitting this form does not create an account or guarantee service availability.</Text>
              </View>
            ) : null}

            {entryScreen === "submitted" ? (
              <View style={styles.loginCard}>
                <View style={styles.successIcon}><Text style={styles.successIconText}>✓</Text></View>
                <Text style={styles.eyebrow}>Request received</Text>
                <Text style={styles.loginTitle}>You’re on the early-access list</Text>
                <Text style={styles.sectionIntro}>
                  Our beta team will contact you if NurseBridges is available in your area. You do not need to submit another request.
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.entryPrimaryButton}
                  onPress={() => showEntryScreen("signin")}
                >
                  <Text style={styles.entryPrimaryButtonText}>Go to sign in</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.entrySecondaryButton}
                  onPress={() => showEntryScreen("welcome")}
                >
                  <Text style={styles.entrySecondaryButtonText}>Back to welcome</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
        {session && role === "nurse" ? (
          <NurseWorkspaceHeader
            activeTab={nurseTab}
            isApproved={isApprovedNurse}
            availableCount={nurseOpenRequests.length}
            assignmentCount={assignedNurseJobs}
            unreadCount={unreadNotificationCount}
          />
        ) : session ? (
          <View style={styles.headerPanel}>
            <View style={styles.brandRow}>
              <View style={styles.brandIdentity}>
                <View style={styles.headerLogoWrap}><Image source={patientBrandMark} style={styles.headerLogo} /></View>
                <View>
                  <Text style={styles.brandName}>NurseBridges</Text>
                  <Text style={styles.brandCaption}>Care, connected.</Text>
                </View>
              </View>
            </View>
            <Text style={styles.title}>Your care,{"\u00A0"}in one place</Text>
            <Text style={styles.subTitle}>Request support and see what is happening next.</Text>
            <View style={styles.headerStatusRow}>
              <View style={styles.headerStatusCopy}>
                <Text style={styles.headerStatusLabel}>Current status</Text>
                <Text style={styles.headerStatusValue}>{workflowSnapshot.status}</Text>
              </View>
              {unreadNotificationCount > 0 ? (
                <TouchableOpacity accessibilityRole="button" onPress={() => setPatientTab("updates")}>
                  <Text style={styles.headerMeta}>{unreadNotificationCount} new</Text>
                </TouchableOpacity>
              ) : <Text style={styles.headerMeta}>Up to date</Text>}
            </View>
          </View>
        ) : null}

        {session && error ? <ErrorNotice message={error} onCopy={copyErrorDetails} /> : null}
        {session && notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {!session ? null : (
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

            {role === "patient" && patientTab === "home" ? (
              <>
                <PatientQuickActions
                  unreadCount={unreadNotificationCount}
                  onRequest={() => setPatientTab("new")}
                  onActivity={() => setPatientTab("records")}
                  onUpdates={() => setPatientTab("updates")}
                />
                <NextActionPanel
                  eyebrow={patientFocusJob && ["completed", "cancelled"].includes(patientFocusJob.status) ? "Latest request" : "Next step"}
                  title={patientFocusJob ? patientFocusJob.title : "Create the first care request"}
                  status={patientFocusJob?.status}
                  body={
                    patientFocusJob
                      ? `${workflowSummary(patientFocusJob)}. Latest update: ${
                          latestPatientNotification?.title ?? "No update yet"
                        }.`
                      : "Use the request form below to describe the care support needed, where it should happen, and when."
                  }
                  primaryLabel={
                    !patientFocusJob
                      ? "Request care support"
                      : undefined
                  }
                  onPrimary={
                    !patientFocusJob
                      ? () => setPatientTab("new")
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
                  />
                ) : null}
                {patientFocusJob?.status === "assigned" ? (
                  <View style={styles.card}>
                    <SectionHeader eyebrow="Your care team" title={trustedNurse?.display_name ?? "Assigned nurse"} />
                    {trustedNurse ? (
                      <>
                        <Text style={styles.notice}>NurseBridges verification approved</Text>
                        <FieldRow label="Specialty" value={trustedNurse.specialty} />
                        <FieldRow label="Experience" value={trustedNurse.years_experience == null ? null : `${trustedNurse.years_experience} years`} />
                        <FieldRow label="License state" value={trustedNurse.license_state} />
                        {trustedNurse.bio ? <Text style={styles.sectionIntro}>{trustedNurse.bio}</Text> : null}
                      </>
                    ) : <Text style={styles.emptyText}>The assigned nurse profile is being prepared.</Text>}
                    <Text style={styles.supportTitle}>Before the visit</Text>
                    <FieldRow label="Appointment" value={formatDate(patientFocusJob.start_time)} />
                    <FieldRow label="Meeting point" value={patientFocusJob.logistics?.meeting_point} />
                    <FieldRow label="Transportation" value={patientFocusJob.logistics?.transportation_mode?.replaceAll("_", " ")} />
                    <FieldRow label="Pre-visit plan" value={visitEvents.some((event) => event.event_type === "pre_visit_confirmed") ? "Confirmed" : "Waiting for nurse confirmation"} />
                    <Text style={styles.formPrivacyNote}>Use Messages for practical coordination. Do not send diagnoses, account numbers, access codes, or emergency requests.</Text>
                    <Text style={styles.supportTitle}>In-person arrival confirmation</Text>
                    {arrivalPin ? <View style={styles.supportPanel}><Text style={styles.eyebrow}>ARRIVAL PIN</Text><Text style={styles.metricValue}>{arrivalPin}</Text><Text style={styles.formPrivacyNote}>Show or tell this six-digit PIN to the assigned nurse only after you meet in person.</Text></View> : null}
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => void createPatientArrivalPin(patientFocusJob)} disabled={actionLoading}>
                      <Text style={styles.secondaryButtonText}>{arrivalPin ? "Replace arrival PIN" : "Create arrival PIN"}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {patientFocusJob?.status === "assigned" ? <PatientVisitProgressPanel events={visitEvents} /> : null}
                {patientFocusJob?.status === "completed" ? (
                  <PatientVisitOutcomePanel
                    report={visitReport}
                    feedback={visitFeedback}
                    rating={feedbackRating}
                    comments={feedbackComments}
                    wouldRebook={feedbackWouldRebook}
                    preferSameNurse={feedbackPreferSameNurse}
                    actionLoading={actionLoading}
                    onRating={setFeedbackRating}
                    onComments={setFeedbackComments}
                    onWouldRebook={setFeedbackWouldRebook}
                    onPreferSameNurse={setFeedbackPreferSameNurse}
                    onSubmit={() => void submitPatientFeedback(patientFocusJob)}
                    recurringCadence={recurringCadence}
                    onRecurringCadence={setRecurringCadence}
                    onRequestRecurring={() => void requestRecurringCare(patientFocusJob)}
                    onStartRebooking={() => startRebooking(patientFocusJob)}
                  />
                ) : null}
                <RecurringCarePanel plans={recurringCarePlans} />
                {patientFocusJob ? (
                  <TouchableOpacity accessibilityRole="button" style={styles.activityPreview} onPress={() => setPatientTab("records")}>
                    <View style={styles.flex}>
                      <Text style={styles.eyebrow}>Latest activity</Text>
                      <Text style={styles.activityPreviewTitle}>{latestPatientNotification?.title ?? workflowSummary(patientFocusJob)}</Text>
                      <Text style={styles.activityPreviewBody}>Open your activity to see the full request timeline.</Text>
                    </View>
                    <Text style={styles.activityPreviewArrow}>›</Text>
                  </TouchableOpacity>
                ) : null}
                <PatientSupportSafetyPanel onOpenAccount={() => setPatientTab("account")} />
              </>
            ) : null}

            {role === "nurse" && nurseTab === "home" ? (
              <>
              <NurseHomeOverview
                availableCount={isApprovedNurse ? nurseOpenRequests.length : 0}
                assignmentCount={assignedNurseJobs}
                unreadCount={unreadNotificationCount}
                onFindWork={() => setNurseTab("find")}
                onSchedule={() => setNurseTab("schedule")}
                onInbox={() => setNurseTab("inbox")}
              />
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
                secondaryLabel={!isApprovedNurse ? "Choose document" : nurseFocusJob ? "View details" : "Refresh"}
                onSecondary={
                  !isApprovedNurse
                    ? () => setNurseTab("account")
                    : nurseFocusJob
                      ? () => {
                          setSelectedJob(nurseFocusJob);
                          setNurseTab(nurseFocusJob.assigned_nurse_user_id === session.user.id ? "schedule" : "find");
                        }
                      : loadNurseJobs
                }
                disabled={actionLoading || screenLoading}
              />
              </>
            ) : null}

            {role === "admin" ? (
              <NextActionPanel
                eyebrow="Admin next action"
                title="Use the dispatcher console"
                body="Mobile admin access is intentionally limited. Assignment, verification review, and audit work belong in the protected web console."
                status="web console"
              />
            ) : null}

            {role === "admin" || (role === "patient" && patientTab === "updates") || (role === "nurse" && nurseTab === "inbox") ? (
              <>
              {role === "patient" && patientTab === "updates" ? (
                <View style={styles.card}>
                  <SectionHeader
                    eyebrow="Private coordination"
                    title={patientFocusJob ? patientFocusJob.title : "Request messages"}
                    actionLabel={patientFocusJob ? "Refresh" : undefined}
                    onAction={patientFocusJob ? () => loadJobMessages(patientFocusJob.id) : undefined}
                    disabled={screenLoading || actionLoading}
                  />
                  {!patientFocusJob ? <Text style={styles.emptyText}>Create a care request before starting a message thread.</Text> : (
                    <>
                      {jobMessages.length === 0 ? <Text style={styles.emptyText}>No messages yet. Use this thread for visit coordination.</Text> : jobMessages.map((message) => (
                        <View key={message.id} style={styles.jobCard}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.jobTitle}>{message.sender_label}</Text>
                            <Text style={styles.meta}>{formatDate(message.created_at)}</Text>
                          </View>
                          <Text style={styles.sectionIntro}>{message.body}</Text>
                        </View>
                      ))}
                      <Text style={styles.inputLabel}>Message about this request</Text>
                      <TextInput
                        accessibilityLabel="Message about this care request"
                        style={[styles.input, styles.multilineInput]}
                        value={messageDraft}
                        onChangeText={setMessageDraft}
                        placeholder="Share a practical arrival, timing, or coordination update"
                        placeholderTextColor={colors.mutedSoft}
                        multiline
                        maxLength={2000}
                      />
                      <TouchableOpacity style={styles.button} onPress={() => void sendJobMessage(patientFocusJob.id)} disabled={actionLoading || !messageDraft.trim()}>
                        <Text style={styles.buttonText}>Send message</Text>
                      </TouchableOpacity>
                      <Text style={styles.formPrivacyNote}>Not monitored for emergencies. Do not include medical history, payment information, or building access codes.</Text>
                    </>
                  )}
                </View>
              ) : null}
              <View style={styles.card}>
                <SectionHeader
                  eyebrow={role === "patient" ? "Request alerts" : "Updates"}
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
              </>
            ) : null}

            {role === "patient" ? (
              <>
                {patientTab === "account" ? (
                  <>
                    <View style={styles.card}>
                      <SectionHeader eyebrow="Consent" title="Care circle" actionLabel="Refresh" onAction={loadCareCircle} disabled={actionLoading} />
                      <Text style={styles.sectionIntro}>Choose who may receive visit milestones and the submitted coordination summary. You can revoke access at any time.</Text>
                      <Text style={styles.inputLabel}>Name *</Text>
                      <TextInput style={styles.input} value={careCircleName} onChangeText={setCareCircleName} placeholder="Family member or trusted person" placeholderTextColor={colors.mutedSoft} />
                      <Text style={styles.inputLabel}>Relationship *</Text>
                      <TextInput style={styles.input} value={careCircleRelationship} onChangeText={setCareCircleRelationship} placeholder="Daughter, spouse, caregiver" placeholderTextColor={colors.mutedSoft} />
                      <Text style={styles.inputLabel}>Email *</Text>
                      <TextInput style={styles.input} value={careCircleEmail} onChangeText={setCareCircleEmail} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" placeholderTextColor={colors.mutedSoft} />
                      <TouchableOpacity style={styles.button} onPress={addCareCircleRecipient} disabled={actionLoading}>
                        <Text style={styles.buttonText}>Give consent and add</Text>
                      </TouchableOpacity>
                      {careCircleRecipients.map((recipient) => (
                        <View key={recipient.id} style={styles.jobCard}>
                          <Text style={styles.jobTitle}>{recipient.display_name}</Text>
                          <FieldRow label="Relationship" value={recipient.relationship} />
                          <FieldRow label="Updates" value={[recipient.receive_milestones ? "Milestones" : null, recipient.receive_summary ? "Summary" : null].filter(Boolean).join(" and ")} />
                          <FieldRow label="Invitation" value={recipient.invitation_status} />
                          <FieldRow label="Delivery" value={recipient.delivery_status.replaceAll("_", " ")} />
                          {recipient.invitation_status === "pending" ? <FieldRow label="Expires" value={formatDate(recipient.invitation_expires_at)} /> : null}
                          <TouchableOpacity style={styles.detailSecondaryAction} onPress={() => void revokeCareCircleRecipient(recipient.id)} disabled={actionLoading}>
                            <Text style={styles.detailSecondaryActionText}>Revoke access</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      <Text style={styles.formPrivacyNote}>This records your consent and a request-specific invitation. No updates are shared until secure delivery and recipient acceptance are enabled.</Text>
                    </View>
                    <AccountPanel
                      email={session.user.email}
                      role={role}
                      baseUrl={baseUrl}
                      nurseProfile={nurseProfile}
                      supportRows={workflowEvidence.rows}
                      actionLoading={actionLoading}
                      onSignOut={handleSignOut}
                      onCopySupport={copyWorkflowEvidence}
                    />
                  </>
                ) : null}

                {patientTab === "new" ? (
                  <View
                    style={styles.requestCard}
                    onLayout={(event) => {
                      requestCardYRef.current = event.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.eyebrow}>Request care</Text>
                    <Text style={styles.requestTitle}>Let’s get the right support</Text>
                    <Text style={styles.sectionIntro}>A few clear details help the care team review your request.</Text>
                    <RequestProgress step={requestStep} />

                    {requestStep === 1 ? (
                      <View>
                        <Text style={styles.requestStepTitle}>What do you need help with?</Text>
                        <Text style={styles.inputLabel}>Support type *</Text>
                        <TextInput
                          accessibilityLabel="Support type"
                          style={styles.input}
                          placeholder="Appointment support, check-in, recovery help"
                          placeholderTextColor={colors.mutedSoft}
                          value={jobForm.title}
                          onChangeText={(text) => setJobForm((prev) => ({ ...prev, title: text }))}
                        />
                        <Text style={styles.inputLabel}>Anything else we should know?</Text>
                        <TextInput
                          accessibilityLabel="Care request details"
                          style={[styles.input, styles.multilineInput]}
                          placeholder="Share only the practical details needed to coordinate support"
                          placeholderTextColor={colors.mutedSoft}
                          multiline
                          value={jobForm.description}
                          onChangeText={(text) => setJobForm((prev) => ({ ...prev, description: text }))}
                        />
                        <Text style={styles.formPrivacyNote}>Do not include diagnoses, policy or payment numbers, or a full medical history.</Text>
                      </View>
                    ) : null}

                    {requestStep === 2 ? (
                      <View>
                        <Text style={styles.requestStepTitle}>When is the appointment?</Text>
                        <Text style={styles.inputLabel}>Requested date and time</Text>
                        <View style={styles.dateTimeRow}>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Appointment date, ${appointmentDateLabel(jobForm.start_time)}`}
                            style={styles.dateTimeButton}
                            onPress={() => setRequestPicker({ field: "start_time", mode: "date" })}
                          >
                            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
                            <View style={styles.dateTimeButtonCopy}>
                              <Text style={styles.dateTimeButtonLabel}>Date</Text>
                              <Text style={styles.dateTimeButtonValue}>{appointmentDateLabel(jobForm.start_time)}</Text>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Appointment time, ${appointmentTimeLabel(jobForm.start_time)}`}
                            style={styles.dateTimeButton}
                            onPress={() => setRequestPicker({ field: "start_time", mode: "time" })}
                          >
                            <Ionicons name="time-outline" size={18} color={colors.accent} />
                            <View style={styles.dateTimeButtonCopy}>
                              <Text style={styles.dateTimeButtonLabel}>Time</Text>
                              <Text style={styles.dateTimeButtonValue}>{appointmentTimeLabel(jobForm.start_time)}</Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                        {requestPicker?.field === "start_time" ? (
                          <View style={styles.dateTimePickerPanel}>
                            <DateTimePicker
                              value={selectedAppointmentDate(jobForm.start_time) ?? defaultAppointmentDate()}
                              mode={requestPicker.mode}
                              display={Platform.OS === "ios" ? "spinner" : "default"}
                              minimumDate={requestPicker.mode === "date" ? new Date() : undefined}
                              maximumDate={requestPicker.mode === "date" ? new Date(new Date().setFullYear(new Date().getFullYear() + 2)) : undefined}
                              minuteInterval={5}
                              onChange={handleAppointmentPickerChange}
                            />
                            {Platform.OS === "ios" ? (
                              <TouchableOpacity
                                accessibilityRole="button"
                                style={styles.dateTimeDoneButton}
                                onPress={() => setRequestPicker(null)}
                              >
                                <Text style={styles.dateTimeDoneButtonText}>Done</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ) : null}
                        {jobForm.start_time ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Clear requested date and time"
                            style={styles.clearDateTimeButton}
                            onPress={() => {
                              setRequestPicker(null);
                              setJobForm((previous) => ({ ...previous, start_time: "" }));
                            }}
                          >
                            <Text style={styles.clearDateTimeButtonText}>Clear date and time</Text>
                          </TouchableOpacity>
                        ) : null}
                        <Text style={styles.formPrivacyNote}>Times are shown in your device’s local time zone. The care team will confirm availability and pricing.</Text>
                      </View>
                    ) : null}

                    {requestStep === 3 ? (
                      <View>
                        <Text style={styles.requestStepTitle}>Tell us about the residence</Text>
                        <Text style={styles.inputLabel}>Residence type *</Text>
                        <ChoiceGroup
                          value={jobForm.residence_type}
                          options={[
                            { value: "apartment", label: "Apartment" },
                            { value: "house", label: "House" },
                            { value: "assisted_living", label: "Assisted living" },
                            { value: "other", label: "Other" }
                          ]}
                          onChange={(residence_type) => setJobForm((prev) => ({ ...prev, residence_type }))}
                        />
                        <Text style={styles.inputLabel}>Street address *</Text>
                        <TextInput style={styles.input} accessibilityLabel="Residence street address" placeholder="123 Main Street" placeholderTextColor={colors.mutedSoft} value={jobForm.street_address} onChangeText={(street_address) => setJobForm((prev) => ({ ...prev, street_address }))} />
                        {jobForm.residence_type === "apartment" ? <>
                          <Text style={styles.inputLabel}>Apartment or unit *</Text>
                          <TextInput style={styles.input} accessibilityLabel="Apartment or unit" placeholder="Unit 4B" placeholderTextColor={colors.mutedSoft} value={jobForm.unit} onChangeText={(unit) => setJobForm((prev) => ({ ...prev, unit }))} />
                        </> : null}
                        <Text style={styles.inputLabel}>Building or community name</Text>
                        <TextInput style={styles.input} accessibilityLabel="Building or community name" placeholder="Optional" placeholderTextColor={colors.mutedSoft} value={jobForm.building_name} onChangeText={(building_name) => setJobForm((prev) => ({ ...prev, building_name }))} />
                        <Text style={styles.inputLabel}>City *</Text>
                        <TextInput style={styles.input} accessibilityLabel="Residence city" value={jobForm.city} onChangeText={(city) => setJobForm((prev) => ({ ...prev, city }))} />
                        <View style={styles.dateTimeRow}>
                          <View style={styles.flex}><Text style={styles.inputLabel}>State *</Text><TextInput style={styles.input} accessibilityLabel="Residence state" autoCapitalize="characters" maxLength={2} value={jobForm.state} onChangeText={(state) => setJobForm((prev) => ({ ...prev, state }))} /></View>
                          <View style={styles.flex}><Text style={styles.inputLabel}>ZIP *</Text><TextInput style={styles.input} accessibilityLabel="Residence ZIP code" keyboardType="number-pad" maxLength={10} value={jobForm.postal_code} onChangeText={(postal_code) => setJobForm((prev) => ({ ...prev, postal_code }))} /></View>
                        </View>
                        <Text style={styles.inputLabel}>Stairs</Text>
                        <ChoiceGroup value={jobForm.stairs} options={[{ value: "none", label: "None" }, { value: "entrance", label: "Entrance" }, { value: "interior", label: "Inside" }, { value: "both", label: "Both" }, { value: "unknown", label: "Not sure" }]} onChange={(stairs) => setJobForm((prev) => ({ ...prev, stairs }))} />
                        {jobForm.stairs !== "none" ? <><Text style={styles.inputLabel}>Elevator available?</Text><ChoiceGroup value={jobForm.elevator_available} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Not sure" }]} onChange={(elevator_available) => setJobForm((prev) => ({ ...prev, elevator_available }))} /></> : null}
                        <Text style={styles.inputLabel}>Where should the nurse meet you?</Text>
                        <TextInput style={styles.input} accessibilityLabel="Meeting point" placeholder="Lobby, front entrance, apartment door" placeholderTextColor={colors.mutedSoft} value={jobForm.meeting_point} onChangeText={(meeting_point) => setJobForm((prev) => ({ ...prev, meeting_point }))} />
                        <Text style={styles.inputLabel}>Parking notes</Text>
                        <TextInput style={styles.input} accessibilityLabel="Parking notes" placeholder="Visitor parking or drop-off information" placeholderTextColor={colors.mutedSoft} value={jobForm.parking_notes} onChangeText={(parking_notes) => setJobForm((prev) => ({ ...prev, parking_notes }))} />
                        <Text style={styles.inputLabel}>Arrival instructions</Text>
                        <TextInput style={[styles.input, styles.multilineInput]} accessibilityLabel="Arrival instructions" multiline placeholder="Call on arrival or check in with front desk" placeholderTextColor={colors.mutedSoft} value={jobForm.arrival_instructions} onChangeText={(arrival_instructions) => setJobForm((prev) => ({ ...prev, arrival_instructions }))} />
                        <Text style={styles.formPrivacyNote}>Never enter a door, gate, alarm, keypad, or lockbox code. Share time-limited access details by phone only after assignment.</Text>
                      </View>
                    ) : null}

                    {requestStep === 4 ? (
                      <View>
                        <Text style={styles.requestStepTitle}>Plan transportation and support</Text>
                        <Text style={styles.inputLabel}>Transportation to the appointment *</Text>
                        <ChoiceGroup value={jobForm.transportation_mode} options={[{ value: "patient_arranged", label: "Already arranged" }, { value: "family_friend", label: "Family/friend" }, { value: "rideshare", label: "Rideshare" }, { value: "medical_transport", label: "Medical transport" }, { value: "public_transit", label: "Public transit" }, { value: "other", label: "Other" }, { value: "not_arranged", label: "Not arranged" }]} onChange={(transportation_mode) => setJobForm((prev) => ({ ...prev, transportation_mode }))} />
                        <Text style={styles.inputLabel}>Transportation provider</Text>
                        <TextInput style={styles.input} accessibilityLabel="Transportation provider" placeholder="Company or person, if known" placeholderTextColor={colors.mutedSoft} value={jobForm.transportation_provider} onChangeText={(transportation_provider) => setJobForm((prev) => ({ ...prev, transportation_provider }))} />
                        <Text style={styles.inputLabel}>Pickup time</Text>
                        <TouchableOpacity accessibilityRole="button" style={styles.dateTimeButton} onPress={() => setRequestPicker({ field: "pickup_time", mode: "time" })}>
                          <Ionicons name="time-outline" size={18} color={colors.accent} />
                          <View style={styles.dateTimeButtonCopy}><Text style={styles.dateTimeButtonLabel}>Pickup</Text><Text style={styles.dateTimeButtonValue}>{appointmentTimeLabel(jobForm.pickup_time)}</Text></View>
                        </TouchableOpacity>
                        {requestPicker?.field === "pickup_time" ? <View style={styles.dateTimePickerPanel}><DateTimePicker value={selectedAppointmentDate(jobForm.pickup_time) ?? selectedAppointmentDate(jobForm.start_time) ?? defaultAppointmentDate()} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"} minuteInterval={5} onChange={handleAppointmentPickerChange} />{Platform.OS === "ios" ? <TouchableOpacity style={styles.dateTimeDoneButton} onPress={() => setRequestPicker(null)}><Text style={styles.dateTimeDoneButtonText}>Done</Text></TouchableOpacity> : null}</View> : null}
                        <Text style={styles.inputLabel}>Return plan *</Text>
                        <ChoiceGroup value={jobForm.return_plan} options={[{ value: "round_trip", label: "Round trip" }, { value: "one_way", label: "One way" }, { value: "family_pickup", label: "Family pickup" }, { value: "other", label: "Other" }, { value: "not_arranged", label: "Not arranged" }]} onChange={(return_plan) => setJobForm((prev) => ({ ...prev, return_plan }))} />
                        <Text style={styles.inputLabel}>Transportation notes</Text>
                        <TextInput style={[styles.input, styles.multilineInput]} accessibilityLabel="Transportation notes" multiline placeholder="Vehicle access, folding wheelchair, or return timing" placeholderTextColor={colors.mutedSoft} value={jobForm.transportation_notes} onChangeText={(transportation_notes) => setJobForm((prev) => ({ ...prev, transportation_notes }))} />
                        <Text style={styles.inputLabel}>Mobility aids</Text>
                        <View style={styles.choiceWrap}>{(["cane", "walker", "wheelchair", "scooter", "other"] as const).map((aid) => { const active = jobForm.mobility_aids.includes(aid); return <TouchableOpacity key={aid} style={[styles.choiceButton, styles.compactChoiceButton, active ? styles.choiceButtonActive : null]} onPress={() => setJobForm((prev) => ({ ...prev, mobility_aids: active ? prev.mobility_aids.filter((item) => item !== aid) : [...prev.mobility_aids, aid] }))}><Text style={[styles.choiceButtonText, active ? styles.choiceButtonTextActive : null]}>{aid[0].toUpperCase() + aid.slice(1)}</Text></TouchableOpacity>; })}</View>
                        <Text style={styles.inputLabel}>Mobility or practical support notes</Text>
                        <TextInput style={[styles.input, styles.multilineInput]} accessibilityLabel="Mobility and practical support notes" multiline placeholder="Walking distance, transfer assistance, or pace" placeholderTextColor={colors.mutedSoft} value={jobForm.mobility_notes} onChangeText={(mobility_notes) => setJobForm((prev) => ({ ...prev, mobility_notes }))} />
                        <Text style={styles.inputLabel}>On-site contact name</Text>
                        <TextInput style={styles.input} accessibilityLabel="On-site contact name" placeholder="Optional" placeholderTextColor={colors.mutedSoft} value={jobForm.onsite_contact_name} onChangeText={(onsite_contact_name) => setJobForm((prev) => ({ ...prev, onsite_contact_name }))} />
                        <Text style={styles.inputLabel}>Relationship</Text>
                        <TextInput style={styles.input} accessibilityLabel="On-site contact relationship" placeholder="Daughter, spouse, facility staff" placeholderTextColor={colors.mutedSoft} value={jobForm.onsite_contact_relationship} onChangeText={(onsite_contact_relationship) => setJobForm((prev) => ({ ...prev, onsite_contact_relationship }))} />
                        <Text style={styles.inputLabel}>Phone</Text>
                        <TextInput style={styles.input} accessibilityLabel="On-site contact phone" keyboardType="phone-pad" placeholder="Optional" placeholderTextColor={colors.mutedSoft} value={jobForm.onsite_contact_phone} onChangeText={(onsite_contact_phone) => setJobForm((prev) => ({ ...prev, onsite_contact_phone }))} />
                      </View>
                    ) : null}

                    {requestStep === 5 ? (
                      <View>
                        <Text style={styles.requestStepTitle}>Review your request</Text>
                        <View style={styles.requestReview}>
                          <Text style={styles.requestReviewTitle}>{jobForm.title.trim() || "Care support request"}</Text>
                          <Text style={styles.requestReviewMeta}>{[jobForm.street_address, jobForm.unit && `Unit ${jobForm.unit}`, jobForm.city, jobForm.state].filter(Boolean).join(", ") || "Residence to be confirmed"}</Text>
                          <Text style={styles.requestReviewMeta}>{jobForm.start_time ? formatDate(jobForm.start_time) : "Time to be confirmed"}</Text>
                          <Text style={styles.requestReviewMeta}>Transportation: {jobForm.transportation_mode.replace(/_/g, " ")}</Text>
                          <Text style={styles.requestReviewMeta}>Return: {jobForm.return_plan.replace(/_/g, " ")}</Text>
                        </View>
                        <View style={styles.requestSafetyNote}>
                          <Text style={styles.requestSafetyTitle}>Before you submit</Text>
                          <Text style={styles.requestSafetyBody}>NurseBridges is not an emergency service. Submitting sends this request to the beta care team for review.</Text>
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.requestFooter}>
                      {requestStep > 1 ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          style={styles.requestBackButton}
                          onPress={() => setRequestStep((requestStep - 1) as RequestStep)}
                          disabled={actionLoading}
                        >
                          <Text style={styles.requestBackButtonText}>Back</Text>
                        </TouchableOpacity>
                      ) : null}
                      {requestStep < 5 ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          style={styles.requestContinueButton}
                          onPress={() => {
                            if (requestStep === 1 && jobForm.title.trim().length < 3) {
                              setError("Enter the support type using at least 3 characters.");
                              return;
                            }
                            if (requestStep === 3) {
                              if (!jobForm.street_address.trim() || !jobForm.city.trim() || !jobForm.state.trim() || !jobForm.postal_code.trim()) {
                                setError("Complete the required residence address fields before continuing.");
                                return;
                              }
                              if (jobForm.residence_type === "apartment" && !jobForm.unit.trim()) {
                                setError("Enter the apartment or unit number before continuing.");
                                return;
                              }
                            }
                            setError(null);
                            setRequestStep((requestStep + 1) as RequestStep);
                          }}
                        >
                          <Text style={styles.requestContinueButtonText}>Continue</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={styles.requestContinueButton} onPress={handleCreateJob} disabled={actionLoading}>
                          {actionLoading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.requestContinueButtonText}>Submit request</Text>}
                        </TouchableOpacity>
                      )}
                    </View>
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
                          { label: "Residence", value: job.logistics ? [job.logistics.street_address, job.logistics.unit, job.logistics.city, job.logistics.state].filter(Boolean).join(", ") : formatServiceArea(job) },
                          { label: "Pricing", value: formatRate(job.hourly_rate) }
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
                        ]}
                        actionLoading={actionLoading}
                      />
                    ))
                  )}
                  </View>
                ) : null}
              </>
            ) : null}

            {role === "nurse" && nurseTab === "find" ? (
              <View style={styles.card}>
                <SectionHeader
                  eyebrow="Nurse workflow"
                  title="Find work"
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
                          { label: "Service area", value: formatServiceArea(job) },
                          { label: "Pricing", value: formatRate(job.hourly_rate) }
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

            {role === "nurse" && nurseTab === "schedule" ? (
              <View style={styles.card}>
                <SectionHeader
                  eyebrow="Nurse workflow"
                  title="Schedule"
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
                          { label: job.logistics ? "Residence" : "Service area", value: job.logistics ? [job.logistics.street_address, job.logistics.unit, job.logistics.city, job.logistics.state].filter(Boolean).join(", ") : formatServiceArea(job) },
                          { label: "Pricing", value: formatRate(job.hourly_rate) }
                        ]}
                        badge={applicationLabel}
                        selected={selectedJob?.id === job.id}
                        onPress={() => setSelectedJob(job)}
                        actions={[]}
                        actionLoading={actionLoading}
                      />
                    );
                  })
                )}
              </View>
            ) : null}

            {role === "nurse" && nurseTab === "account" ? (
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

            {role === "nurse" && (nurseTab === "find" || nurseTab === "schedule") && selectedJob && nurseRequestDetail ? (
              <RequestDetailPanel
                eyebrow="Selected request"
                title={nurseRequestDetail.title}
                summary={nurseRequestDetail.summary}
                status={nurseRequestDetail.status}
                description={nurseRequestDetail.description}
                fields={[
                  { label: "Application", value: nurseRequestDetail.applicationState },
                  { label: nurseRequestDetail.assignedToYou ? "Residence" : "Service area", value: nurseRequestDetail.location },
                  { label: "Start", value: nurseRequestDetail.start },
                  { label: "Legacy compensation estimate", value: nurseRequestDetail.rate },
                  ...(nurseRequestDetail.assignedToYou ? [
                    { label: "Arrival and access", value: nurseRequestDetail.access },
                    { label: "Mobility", value: nurseRequestDetail.mobility },
                    { label: "Transportation", value: nurseRequestDetail.transportation },
                    { label: "On-site contact", value: nurseRequestDetail.onsiteContact }
                  ] : [])
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
                ]}
                actionLoading={actionLoading}
                finalText="No action is available for this request right now."
              />
            ) : null}

            {role === "nurse" && nurseTab === "schedule" && selectedJob?.status === "assigned" && selectedJob.assigned_nurse_user_id === session.user.id ? (
              <NurseVisitExecutionPanel
                events={visitEvents}
                report={visitReport}
                reportDraft={visitReportDraft}
                actionLoading={actionLoading}
                onReportChange={(field, value) => setVisitReportDraft((current) => ({ ...current, [field]: value }))}
                onRecordEvent={(eventType) => void recordVisitEvent(selectedJob, eventType)}
                onSaveReport={(status) => void saveVisitReport(selectedJob, status)}
                onEscalate={() => confirmVisitEscalation(selectedJob)}
                onFinalize={() => void handleJobTransition(selectedJob, "complete")}
              />
            ) : null}

            {role === "nurse" && nurseTab === "account" ? (
              <AccountPanel
                email={session.user.email}
                role={role}
                baseUrl={baseUrl}
                nurseProfile={nurseProfile}
                supportRows={workflowEvidence.rows}
                actionLoading={actionLoading}
                onSignOut={handleSignOut}
                onCopySupport={copyWorkflowEvidence}
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
      {session && role === "patient" ? <PatientTabBar activeTab={patientTab} onChange={setPatientTab} /> : null}
      {session && role === "nurse" ? (
        <NurseTabBar activeTab={nurseTab} onChange={setNurseTab} unreadCount={unreadNotificationCount} />
      ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
return StyleSheet.create({
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
  splashMark: { width: 112, height: 112, borderRadius: 32, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  splashImage: { width: 108, height: 108, resizeMode: "contain" },
  splashName: { color: colors.ink, fontSize: 28, fontWeight: "900", letterSpacing: -1.2 },
  content: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 28
  },
  patientContent: {
    paddingBottom: 110
  },
  nurseContent: {
    paddingBottom: 110
  },
  nurseWorkspaceHeader: {
    backgroundColor: colors.hero,
    borderRadius: 24,
    marginBottom: 14,
    padding: 17,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.1,
    shadowRadius: 16
  },
  nurseWorkspaceBrandRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 19
  },
  nurseWorkspaceIdentity: { alignItems: "center", flexDirection: "row", flex: 1, gap: 11 },
  nurseWorkspaceLogoWrap: {
    alignItems: "center",
    backgroundColor: "#E9FFFA",
    borderRadius: 14,
    height: 46,
    justifyContent: "center",
    overflow: "hidden",
    width: 46
  },
  nurseWorkspaceLogo: { height: 42, resizeMode: "contain", width: 42 },
  nurseWorkspaceBrand: { color: colors.heroText, fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  nurseWorkspaceCaption: { color: colors.heroMuted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  nurseWorkspaceTitle: {
    color: colors.heroText,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.9,
    lineHeight: 32,
    marginBottom: 5
  },
  nurseWorkspaceContext: { color: colors.heroMuted, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  nurseReadinessPill: {
    alignItems: "center",
    backgroundColor: colors.successMuted,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  nurseReadinessPillPending: { backgroundColor: colors.warningMuted },
  nurseReadinessDot: { backgroundColor: colors.success, borderRadius: 4, height: 7, width: 7 },
  nurseReadinessDotPending: { backgroundColor: colors.warning },
  nurseReadinessText: { color: colors.success, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  nurseReadinessTextPending: { color: colors.warning },
  headerPanel: {
    backgroundColor: colors.hero,
    borderRadius: 28,
    marginBottom: 16,
    padding: 20,
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
  brandIdentity: { alignItems: "center", flexDirection: "row", gap: 10 },
  headerLogoWrap: { alignItems: "center", backgroundColor: "#E9FFFA", borderRadius: 13, height: 42, justifyContent: "center", overflow: "hidden", width: 42 },
  headerLogo: { height: 48, resizeMode: "contain", width: 48 },
  brandName: {
    color: colors.heroText,
    fontSize: 17,
    fontWeight: "800"
  },
  brandCaption: {
    color: colors.heroMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: colors.heroText,
    letterSpacing: -1,
    marginBottom: 8
  },
  subTitle: {
    fontSize: 14,
    color: colors.heroMuted,
    lineHeight: 20,
    marginBottom: 18
  },
  headerStatusRow: {
    alignItems: "center",
    backgroundColor: colors.heroSurface,
    borderColor: colors.heroBorder,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  headerStatusCopy: { flex: 1, paddingRight: 12 },
  headerStatusLabel: { color: colors.heroMuted, fontSize: 10, fontWeight: "800", marginBottom: 3, textTransform: "uppercase" },
  headerStatusValue: { color: colors.heroText, fontSize: 15, fontWeight: "900" },
  metricsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14
  },
  metricTile: {
    backgroundColor: colors.heroSurface,
    borderColor: colors.heroBorder,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 68,
    padding: 10,
    justifyContent: "space-between"
  },
  metricValue: {
    color: colors.heroText,
    fontSize: 18,
    fontWeight: "900"
  },
  metricLabel: {
    color: colors.heroMuted,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    textTransform: "uppercase"
  },
  workflowSnapshot: {
    backgroundColor: colors.heroSurface,
    borderColor: colors.heroBorder,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14
  },
  snapshotRow: {
    borderBottomColor: colors.heroBorder,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  snapshotLabel: {
    color: colors.heroMuted,
    flex: 0.8,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  snapshotValue: {
    color: colors.heroText,
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
    backgroundColor: colors.heroSurface,
    borderRadius: 999,
    color: colors.heroText,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 15,
    marginBottom: 12
  },
  requestCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    marginBottom: 12,
    padding: 20
  },
  requestTitle: { color: colors.ink, fontSize: 25, fontWeight: "900", letterSpacing: -0.8, lineHeight: 30, marginBottom: 8 },
  requestProgress: { flexDirection: "row", justifyContent: "space-between", marginBottom: 26, marginTop: 4 },
  requestProgressItem: { alignItems: "center", flex: 1 },
  requestProgressDot: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    marginBottom: 6,
    width: 32
  },
  requestProgressDotActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  requestProgressNumber: { color: colors.muted, fontSize: 12, fontWeight: "900" },
  requestProgressNumberActive: { color: colors.onAccent },
  requestProgressLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  requestProgressLabelActive: { color: colors.accent, fontWeight: "900" },
  requestStepTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", letterSpacing: -0.4, marginBottom: 18 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  compactChoiceButton: { flex: 0, minHeight: 42, minWidth: 88, paddingHorizontal: 12 },
  formPrivacyNote: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 4 },
  dateTimeRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  dateTimeButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  dateTimeButtonCopy: { flex: 1 },
  dateTimeButtonLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", marginBottom: 3, textTransform: "uppercase" },
  dateTimeButtonValue: { color: colors.ink, fontSize: 12, fontWeight: "800", lineHeight: 16 },
  dateTimePickerPanel: { backgroundColor: colors.surfaceMuted, borderRadius: 16, marginBottom: 10, overflow: "hidden", padding: 8 },
  dateTimeDoneButton: { alignItems: "center", alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 8 },
  dateTimeDoneButtonText: { color: colors.accent, fontSize: 14, fontWeight: "900" },
  clearDateTimeButton: { alignSelf: "flex-start", marginBottom: 8, paddingVertical: 4 },
  clearDateTimeButtonText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  requestReview: { backgroundColor: colors.surfaceMuted, borderRadius: 17, marginBottom: 18, padding: 15 },
  requestReviewTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginBottom: 8 },
  requestReviewMeta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  requestSafetyNote: { backgroundColor: colors.accentMuted, borderRadius: 16, marginTop: 2, padding: 14 },
  requestSafetyTitle: { color: colors.accentDark, fontSize: 12, fontWeight: "900", marginBottom: 5 },
  requestSafetyBody: { color: colors.inkSoft, fontSize: 11, lineHeight: 16 },
  requestFooter: { flexDirection: "row", gap: 10, marginTop: 20 },
  requestBackButton: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 18
  },
  requestBackButtonText: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  requestContinueButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 15,
    flex: 1,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 18
  },
  requestContinueButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: "900" },
  loginShell: { flex: 1, gap: 16, justifyContent: "center", paddingVertical: 18 },
  loginHero: { backgroundColor: colors.hero, borderRadius: 30, padding: 22 },
  loginTopRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  loginLogo: { height: 78, resizeMode: "contain", width: 78 },
  loginBrandName: { color: colors.heroMuted, fontSize: 15, fontWeight: "800", marginBottom: 22 },
  loginHeroTitle: { color: colors.heroText, fontSize: 32, fontWeight: "900", letterSpacing: -1.2, lineHeight: 37, marginBottom: 12, maxWidth: 310 },
  loginHeroBody: { color: colors.heroMuted, fontSize: 15, lineHeight: 22, maxWidth: 340 },
  loginCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 26, borderWidth: 1, marginBottom: 14, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 24 },
  loginTitle: { color: colors.ink, fontSize: 25, fontWeight: "900", letterSpacing: -0.8 },
  loginSafety: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 14, textAlign: "center" },
  backLink: { color: colors.accent, fontSize: 14, fontWeight: "800", marginBottom: 18 },
  entryPrimaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  entryPrimaryButtonText: { color: colors.onAccent, fontSize: 16, fontWeight: "900" },
  entrySecondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  entrySecondaryButtonText: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  choiceRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  choiceButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  choiceButtonActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  choiceButtonText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800", textAlign: "center" },
  choiceButtonTextActive: { color: colors.accentDark },
  consentRow: { alignItems: "flex-start", flexDirection: "row", gap: 12, marginBottom: 6, paddingVertical: 8 },
  checkbox: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
    borderRadius: 7,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxMark: { color: colors.onAccent, fontSize: 15, fontWeight: "900", lineHeight: 18 },
  consentText: { color: colors.inkSoft, flex: 1, fontSize: 13, lineHeight: 19 },
  successIcon: {
    alignItems: "center",
    backgroundColor: colors.successMuted,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    marginBottom: 18,
    width: 44
  },
  successIconText: { color: colors.success, fontSize: 22, fontWeight: "900" },
  productGate: {
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 28,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 72,
    maxWidth: 460,
    padding: 24,
    width: "90%"
  },
  productGateLogo: { height: 72, marginBottom: 18, resizeMode: "contain", width: 72 },
  productGateTitle: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 30,
    marginBottom: 10
  },
  productGateBody: { color: colors.inkSoft, fontSize: 16, lineHeight: 23, marginBottom: 12 },
  productGateHint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  identityPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    padding: 15,
    marginBottom: 12
  },
  nextActionPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 12,
    padding: 18
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
    borderRadius: 14,
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
    color: colors.onAccent
  },
  patientTabBar: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 8,
    marginHorizontal: 12,
    paddingHorizontal: 6,
    paddingVertical: 7,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16
  },
  patientTabButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 2,
    paddingVertical: 4
  },
  patientTabIcon: { color: colors.mutedSoft },
  patientTabIconActive: { color: colors.accent },
  patientTabLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", marginTop: 2 },
  patientTabLabelActive: { color: colors.accent, fontWeight: "900" },
  nurseTabBar: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 8,
    marginHorizontal: 12,
    paddingHorizontal: 5,
    paddingVertical: 7,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16
  },
  nurseTabButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 1,
    paddingVertical: 4
  },
  nurseTabIconWrap: { alignItems: "center", justifyContent: "center", minHeight: 22, minWidth: 29 },
  nurseTabIcon: { color: colors.mutedSoft },
  nurseTabIconActive: { color: colors.accent },
  nurseTabLabel: { color: colors.muted, fontSize: 8.5, fontWeight: "700", marginTop: 2, textAlign: "center" },
  nurseTabLabelActive: { color: colors.accent, fontWeight: "900" },
  nurseTabBadge: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderColor: colors.surface,
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    justifyContent: "center",
    minWidth: 16,
    paddingHorizontal: 3,
    position: "absolute",
    right: -4,
    top: -5
  },
  nurseTabBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900" },
  nurseOverviewSection: { marginBottom: 14 },
  nurseSectionHeading: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 11,
    paddingHorizontal: 2
  },
  nurseSectionTitle: { color: colors.ink, fontSize: 21, fontWeight: "900", letterSpacing: -0.6, marginTop: 2 },
  nurseSectionMeta: { color: colors.success, fontSize: 11, fontWeight: "900", marginBottom: 2, textTransform: "uppercase" },
  nurseOverviewGrid: { flexDirection: "row", gap: 9 },
  nurseOverviewCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 112,
    padding: 12
  },
  nurseOverviewIcon: {
    alignItems: "center",
    backgroundColor: colors.accentMuted,
    borderRadius: 11,
    height: 32,
    justifyContent: "center",
    marginBottom: 10,
    width: 32
  },
  nurseOverviewValue: { color: colors.ink, fontSize: 21, fontWeight: "900", letterSpacing: -0.5 },
  nurseOverviewLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", marginTop: 2 },
  quickActionsSection: { marginBottom: 16 },
  homeSectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", letterSpacing: -0.4, marginBottom: 12 },
  quickActionsGrid: { flexDirection: "row", gap: 9 },
  quickActionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 19,
    borderWidth: 1,
    flex: 1,
    minHeight: 132,
    padding: 12
  },
  quickActionIcon: {
    alignItems: "center",
    backgroundColor: colors.accentMuted,
    borderRadius: 13,
    height: 34,
    justifyContent: "center",
    marginBottom: 12,
    width: 34
  },
  quickActionIconText: { color: colors.accentDark, fontSize: 20, fontWeight: "900", lineHeight: 22 },
  quickActionTitle: { color: colors.ink, fontSize: 13, fontWeight: "900", lineHeight: 17, marginBottom: 4 },
  quickActionDetail: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  activityPreview: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    padding: 16
  },
  activityPreviewTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginBottom: 4 },
  activityPreviewBody: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  activityPreviewArrow: { color: colors.accent, fontSize: 30, fontWeight: "500" },
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
    color: colors.onAccent,
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
    color: colors.onAccent,
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
  supportSnapshot: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    padding: 14
  },
  supportSnapshotIntro: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 8 },
  supportCopyButton: { backgroundColor: colors.accentMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  supportCopyButtonText: { color: colors.accentDark, fontSize: 12, fontWeight: "900" },
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
    backgroundColor: colors.surfaceMuted,
    color: colors.ink,
    minHeight: 52
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
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8
  },
  buttonText: {
    color: colors.onAccent,
    fontWeight: "800"
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
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    minWidth: 0,
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
}
