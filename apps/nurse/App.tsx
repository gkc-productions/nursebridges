import "react-native-url-polyfill/auto";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api, apiBaseUrl } from "./src/api";
import { hasSupabaseConfig, supabase } from "./src/supabase";
import { defaultAvailabilityWindow, groupAssignedJobs, nextVisitCheckpoint, partitionNurseJobs, validateAvailabilityWindow, type AvailabilityWindowInput } from "./src/workspace";

const brand = require("./assets/brand/nursebridges-care-mark.png");
type Tab = "home" | "opportunities" | "schedule" | "messages" | "account";
type VisitLogistics = {
  residence_type?: string | null;
  street_address?: string | null;
  unit?: string | null;
  building_name?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  stairs?: string | null;
  elevator_available?: boolean | null;
  meeting_point?: string | null;
  parking_notes?: string | null;
  arrival_instructions?: string | null;
  mobility_aids?: string[] | null;
  mobility_notes?: string | null;
  onsite_contact_name?: string | null;
  onsite_contact_relationship?: string | null;
  onsite_contact_phone?: string | null;
  transportation_mode?: string | null;
  transportation_provider?: string | null;
  pickup_time?: string | null;
  return_plan?: string | null;
  transportation_notes?: string | null;
};
type Job = { id: string; title: string; description: string | null; status: string; start_time: string | null; service_city?: string | null; service_state?: string | null; assigned_nurse_user_id?: string | null; logistics?: VisitLogistics | null };
type Application = { id: string; job_id: string; status: string };
type AvailabilityWindow = AvailabilityWindowInput & { id?: string };
type Workspace = { profile: null | { verification_status: string; onboarding_step: string; professional_summary: string | null; years_experience: number | null; service_radius_miles: number | null; availability_status: string }; availability: AvailabilityWindow[]; earnings: unknown[]; payments_enabled: false; payments_message: string };
type Visit = { events: Array<{ id: string; event_type: string; occurred_at: string }>; report: null | { status: string; visit_summary: string | null; provider_instructions: string | null; follow_up_tasks: string | null; transportation_outcome: string | null } };
type Notification = { id: string; title: string; body: string | null; created_at: string; read_at: string | null };
type SupportCase = { id: string; title: string; case_type: string; status: string; priority: string; created_at: string };
type JobMessage = { id: string; body: string; sender_label: string; created_at: string };

const tabs: Array<{ key: Tab; label: string }> = [{ key: "home", label: "Home" }, { key: "opportunities", label: "Opportunities" }, { key: "schedule", label: "Schedule" }, { key: "messages", label: "Messages" }, { key: "account", label: "Account" }];
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const initialAvailabilityWindow = defaultAvailabilityWindow();

function Button({ label, onPress, secondary, disabled }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text></Pressable>;
}

function Field({ label, value, onChangeText, multiline, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; keyboardType?: "default" | "number-pad" | "email-address" }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={[styles.input, multiline && styles.multiline]} value={value} onChangeText={onChangeText} multiline={multiline} keyboardType={keyboardType} placeholderTextColor="#78909a" /></View>;
}

function Card({ children }: { children: React.ReactNode }) { return <View style={styles.card}>{children}</View>; }

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function AssignedVisitDetails({ job }: { job: Job }) {
  const details = job.logistics;
  if (!details) return <Text style={styles.body}>Arrival details are being confirmed by operations.</Text>;
  const residence = [details.building_name, details.street_address, details.unit ? `Unit ${details.unit}` : null, details.city, details.state, details.postal_code].filter(Boolean).join(", ");
  const access = [details.stairs ? `Stairs: ${titleCase(details.stairs)}` : null, details.elevator_available == null ? null : details.elevator_available ? "Elevator available" : "No elevator"].filter(Boolean).join(" · ");
  const contact = [details.onsite_contact_name, details.onsite_contact_relationship].filter(Boolean).join(" · ");
  const transportation = [details.transportation_mode ? titleCase(details.transportation_mode) : null, details.transportation_provider].filter(Boolean).join(" · ");
  return <View style={styles.detailGroup}>
    <Text style={styles.sectionTitle}>Arrival and residence</Text>
    <DetailRow label="Residence" value={residence || (details.residence_type ? titleCase(details.residence_type) : null)} />
    <DetailRow label="Meeting point" value={details.meeting_point} />
    <DetailRow label="Building access" value={access} />
    <DetailRow label="Arrival instructions" value={details.arrival_instructions} />
    <DetailRow label="Parking" value={details.parking_notes} />
    <Text style={styles.sectionTitle}>Mobility and practical support</Text>
    <DetailRow label="Mobility aids" value={details.mobility_aids?.map(titleCase).join(", ")} />
    <DetailRow label="Support notes" value={details.mobility_notes} />
    <DetailRow label="On-site contact" value={contact} />
    <DetailRow label="Contact phone" value={details.onsite_contact_phone} />
    <Text style={styles.sectionTitle}>Transportation</Text>
    <DetailRow label="Outbound plan" value={transportation} />
    <DetailRow label="Pickup time" value={details.pickup_time ? new Date(details.pickup_time).toLocaleString() : null} />
    <DetailRow label="Return plan" value={details.return_plan ? titleCase(details.return_plan) : null} />
    <DetailRow label="Transportation notes" value={details.transportation_notes} />
    <Text style={styles.privacyNote}>Use these private details only to complete this assigned visit. Do not copy access details into messages or the visit summary.</Text>
  </View>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [supportCases, setSupportCases] = useState<SupportCase[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [visit, setVisit] = useState<Visit>({ events: [], report: null });
  const [summary, setSummary] = useState("");
  const [instructions, setInstructions] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [transportOutcome, setTransportOutcome] = useState("");
  const [arrivalPin, setArrivalPin] = useState("");
  const [professionalSummary, setProfessionalSummary] = useState("");
  const [years, setYears] = useState("");
  const [radius, setRadius] = useState("");
  const [supportTitle, setSupportTitle] = useState("");
  const [supportDescription, setSupportDescription] = useState("");
  const [jobMessages, setJobMessages] = useState<JobMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [availabilityWindows, setAvailabilityWindows] = useState<AvailabilityWindow[]>([]);
  const [availabilityStart, setAvailabilityStart] = useState(initialAvailabilityWindow.start);
  const [availabilityEnd, setAvailabilityEnd] = useState(initialAvailabilityWindow.end);
  const [availabilityRecurrence, setAvailabilityRecurrence] = useState<"none" | "weekly">("none");
  const [availabilityPicker, setAvailabilityPicker] = useState<"start" | "end" | null>(null);
  const [opportunityQuery, setOpportunityQuery] = useState("");
  const [reportDirty, setReportDirty] = useState(false);

  const load = useCallback(async (activeSession: Session) => {
    const me = await api<{ role: string }>(activeSession, "/me");
    setRole(me.role);
    if (me.role !== "nurse") return;
    const [workspaceData, jobsData, applicationsData, notificationsData, casesData] = await Promise.all([
      api<Workspace>(activeSession, "/nurse/workspace"),
      api<{ jobs: Job[] }>(activeSession, "/jobs").catch(() => ({ jobs: [] })),
      api<{ applications: Application[] }>(activeSession, "/v1/applications"),
      api<{ notifications: Notification[] }>(activeSession, "/notifications"),
      api<{ cases: SupportCase[] }>(activeSession, "/support-cases")
    ]);
    setWorkspace(workspaceData); setJobs(jobsData.jobs); setApplications(applicationsData.applications); setNotifications(notificationsData.notifications); setSupportCases(casesData.cases);
    setProfessionalSummary(workspaceData.profile?.professional_summary ?? "");
    setYears(workspaceData.profile?.years_experience?.toString() ?? "");
    setRadius(workspaceData.profile?.service_radius_miles?.toString() ?? "");
    setAvailabilityWindows(workspaceData.availability);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) return load(data.session); }).catch(() => setError("Unable to restore your secure session.")).finally(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); if (nextSession) void load(nextSession); else setRole(null); });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const jobPartitions = useMemo(() => partitionNurseJobs(jobs, session?.user.id ?? ""), [jobs, session]);
  const assignedJobs = jobPartitions.assigned;
  const openJobs = jobPartitions.opportunities;
  const applicationByJob = useMemo(() => new Map(applications.map((item) => [item.job_id, item])), [applications]);
  const approved = workspace?.profile?.verification_status === "approved";

  const refresh = async () => { if (!session) return; setRefreshing(true); setError(null); try { await load(session); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to refresh."); } finally { setRefreshing(false); } };
  const signIn = async () => { if (!supabase) return; setBusy(true); setError(null); const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (signInError) setError(signInError.message); setBusy(false); };

  const loadVisit = async (job: Job) => { if (!session) return; setSelectedJob(job); setError(null); try { const [data, messages] = await Promise.all([api<Visit>(session, `/jobs/${job.id}/visit`), api<{ messages: JobMessage[] }>(session, `/jobs/${job.id}/messages`)]); setVisit(data); setJobMessages(messages.messages); setSummary(data.report?.visit_summary ?? ""); setInstructions(data.report?.provider_instructions ?? ""); setFollowUp(data.report?.follow_up_tasks ?? ""); setTransportOutcome(data.report?.transportation_outcome ?? ""); setReportDirty(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open the visit workspace."); } };
  const sendMessage = async () => { if (!session || !selectedJob || !messageDraft.trim()) return; setBusy(true); setError(null); try { await api(session, `/jobs/${selectedJob.id}/messages`, { method: "POST", body: JSON.stringify({ body: messageDraft.trim() }) }); setMessageDraft(""); const messages = await api<{ messages: JobMessage[] }>(session, `/jobs/${selectedJob.id}/messages`); setJobMessages(messages.messages); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to send the coordination message."); } finally { setBusy(false); } };
  const apply = async (job: Job) => { if (!session) return; setBusy(true); try { await api(session, `/jobs/${job.id}/apply`, { method: "POST", body: JSON.stringify({ note: "Available and interested through NurseBridges Care." }) }); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to apply."); } finally { setBusy(false); } };
  const recordCheckpoint = async (eventType: string) => { if (!session || !selectedJob) return; setBusy(true); try { await api(session, `/jobs/${selectedJob.id}/visit/events`, { method: "POST", body: JSON.stringify({ event_type: eventType }) }); await loadVisit(selectedJob); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record checkpoint."); } finally { setBusy(false); } };
  const verifyPin = async () => { if (!session || !selectedJob) return; setBusy(true); try { await api(session, `/jobs/${selectedJob.id}/arrival-pin/verify`, { method: "POST", body: JSON.stringify({ pin: arrivalPin }) }); setArrivalPin(""); Alert.alert("Arrival confirmed", "The patient-provided PIN was verified."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to verify arrival."); } finally { setBusy(false); } };
  const saveReport = async (status: "draft" | "submitted") => { if (!session || !selectedJob) return; setBusy(true); try { await api(session, `/jobs/${selectedJob.id}/visit/report`, { method: "PUT", body: JSON.stringify({ status, visit_summary: summary, provider_instructions: instructions, follow_up_tasks: followUp, transportation_outcome: transportOutcome }) }); await loadVisit(selectedJob); setReportDirty(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save report."); } finally { setBusy(false); } };
  const completeVisit = async () => { if (!session || !selectedJob) return; setBusy(true); try { await api(session, `/jobs/${selectedJob.id}/complete`, { method: "PATCH" }); setSelectedJob(null); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to complete care."); } finally { setBusy(false); } };
  const saveProfile = async () => { if (!session) return; setBusy(true); try { await api(session, "/nurse/workspace/profile", { method: "PUT", body: JSON.stringify({ professional_summary: professionalSummary, years_experience: years ? Number(years) : undefined, service_radius_miles: radius ? Number(radius) : undefined, availability_status: workspace?.profile?.availability_status ?? "unavailable", onboarding_step: "availability" }) }); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save profile."); } finally { setBusy(false); } };
  const addAvailabilityWindow = () => {
    const candidate: AvailabilityWindow = {
      starts_at: availabilityStart.toISOString(),
      ends_at: availabilityEnd.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      recurrence: availabilityRecurrence
    };
    const issue = validateAvailabilityWindow(candidate, availabilityWindows);
    if (issue) { setError(issue); return; }
    setError(null);
    setAvailabilityWindows((current) => [...current, candidate].sort((left, right) => left.starts_at.localeCompare(right.starts_at)));
    const next = defaultAvailabilityWindow(new Date(availabilityEnd.getTime() + 15 * 60 * 1000));
    setAvailabilityStart(next.start);
    setAvailabilityEnd(next.end);
    setAvailabilityRecurrence("none");
  };
  const saveAvailability = async () => {
    if (!session) return;
    setBusy(true); setError(null);
    try {
      await api(session, "/nurse/workspace/availability", {
        method: "PUT",
        body: JSON.stringify({ windows: availabilityWindows.map(({ starts_at, ends_at, timezone, recurrence }) => ({ starts_at, ends_at, timezone, recurrence })) })
      });
      await refresh();
      Alert.alert("Availability saved", availabilityWindows.length ? "Your availability is ready for matching." : "You are marked unavailable until you add another window.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update availability."); } finally { setBusy(false); }
  };
  const changeAvailabilityDate = (field: "start" | "end", value?: Date) => {
    if (Platform.OS !== "ios") setAvailabilityPicker(null);
    if (!value) return;
    if (field === "start") {
      setAvailabilityStart(value);
      if (value >= availabilityEnd) setAvailabilityEnd(new Date(value.getTime() + 4 * 60 * 60 * 1000));
    } else setAvailabilityEnd(value);
  };
  const uploadCredential = async () => { if (!session || !supabase) return; const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ["application/pdf", "image/*"] }); if (result.canceled) return; const asset = result.assets[0]; const path = `${session.user.id}/${Date.now()}-${asset.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`; setBusy(true); try { const signed = await api<{ bucket: string; path: string; token: string }>(session, "/nurse/verification-documents/upload-url", { method: "POST", body: JSON.stringify({ storage_path: path }) }); const blob = await (await fetch(asset.uri)).blob(); const { error: uploadError } = await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, blob, { contentType: asset.mimeType ?? "application/octet-stream" }); if (uploadError) throw uploadError; await api(session, "/nurse/verification-documents", { method: "POST", body: JSON.stringify({ storage_path: path, document_type: "rn_license" }) }); Alert.alert("Submitted", "Your credential was uploaded for private review."); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to upload credential."); } finally { setBusy(false); } };
  const createSupportCase = async (caseType: "support" | "incident") => { if (!session || !supportTitle.trim()) return; setBusy(true); try { await api(session, "/support-cases", { method: "POST", body: JSON.stringify({ case_type: caseType, subject_type: selectedJob ? "job" : "account", subject_id: selectedJob?.id, title: supportTitle, description: supportDescription, priority: caseType === "incident" ? "urgent" : "normal" }) }); setSupportTitle(""); setSupportDescription(""); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to contact support."); } finally { setBusy(false); } };

  if (loading) return <SafeAreaProvider><SafeAreaView style={styles.center}><ActivityIndicator color="#20b7aa" /><Text>Preparing NurseBridges Care…</Text></SafeAreaView></SafeAreaProvider>;
  if (!hasSupabaseConfig) return <SafeAreaProvider><SafeAreaView style={styles.center}><Text style={styles.title}>Configuration required</Text><Text style={styles.body}>Secure authentication is not configured for this build.</Text></SafeAreaView></SafeAreaProvider>;
  if (!session) return <SafeAreaProvider><SafeAreaView style={styles.page}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.login}><Image source={brand} style={styles.logo} /><Text style={styles.eyebrow}>NURSEBRIDGES CARE</Text><Text style={styles.hero}>Professional care workspace</Text><Text style={styles.body}>Sign in with your approved nurse account. Patient accounts cannot enter this application.</Text><Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" /><Field label="Password" value={password} onChangeText={setPassword} />{error ? <Text style={styles.error}>{error}</Text> : null}<Button label={busy ? "Signing in…" : "Sign in"} onPress={() => void signIn()} disabled={busy} /></KeyboardAvoidingView></SafeAreaView></SafeAreaProvider>;
  if (role && role !== "nurse") return <SafeAreaProvider><SafeAreaView style={styles.center}><Image source={brand} style={styles.logoSmall} /><Text style={styles.title}>Nurse account required</Text><Text style={styles.body}>This application is exclusively for approved NurseBridges care professionals.</Text><Button label="Sign out" onPress={() => void supabase?.auth.signOut()} /></SafeAreaView></SafeAreaProvider>;

  const nextCheckpoint = nextVisitCheckpoint(visit.events);
  const scheduleGroups = groupAssignedJobs(assignedJobs);
  const normalizedOpportunityQuery = opportunityQuery.trim().toLowerCase();
  const visibleOpportunities = openJobs.filter((job) => !normalizedOpportunityQuery || [job.title, job.service_city, job.service_state].some((value) => value?.toLowerCase().includes(normalizedOpportunityQuery)));
  const reportComplete = [summary, instructions, followUp, transportOutcome].every((value) => value.trim().length > 0);
  return <SafeAreaProvider><SafeAreaView style={styles.page}><View style={styles.header}><View style={styles.brandRow}><Image source={brand} style={styles.logoSmall} /><View><Text style={styles.brandName}>NurseBridges Care</Text><Text style={styles.brandMeta}>{approved ? "Approved professional" : `Review: ${workspace?.profile?.verification_status ?? "pending"}`}</Text></View></View><Text style={styles.apiLabel}>{apiBaseUrl.replace("https://", "")}</Text></View>{error ? <Pressable onPress={() => setError(null)} style={styles.errorBanner}><Text style={styles.error}>{error}</Text></Pressable> : null}<ScrollView style={styles.scroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
    {tab === "home" ? <><Text style={styles.eyebrow}>TODAY</Text><Text style={styles.hero}>{assignedJobs.length ? "Your next visit is ready." : approved ? "You’re ready for care opportunities." : "Complete your professional readiness."}</Text><Card><Text style={styles.cardLabel}>READINESS</Text><Text style={styles.cardTitle}>{workspace?.profile?.verification_status ? titleCase(workspace.profile.verification_status) : "Profile required"}</Text><Text style={styles.body}>{approved ? `${workspace?.availability.length ?? 0} upcoming availability window(s).` : "Submit credentials and availability for operator review."}</Text><Button label={approved ? "Review opportunities" : "Continue onboarding"} onPress={() => setTab(approved ? "opportunities" : "account")} /></Card>{assignedJobs.map((job) => <Card key={job.id}><Text style={styles.cardLabel}>ASSIGNED VISIT</Text><Text style={styles.cardTitle}>{job.title}</Text><Text style={styles.body}>{job.start_time ? new Date(job.start_time).toLocaleString() : "Schedule being confirmed"}</Text><Button label="Open active visit" onPress={() => { setTab("schedule"); void loadVisit(job); }} /></Card>)}</> : null}
    {tab === "opportunities" ? <><Text style={styles.eyebrow}>QUALIFIED OPPORTUNITIES</Text><Text style={styles.title}>Available care</Text>{!approved ? <Card><Text style={styles.cardTitle}>Approval required</Text><Text style={styles.body}>Opportunities remain private until credential review is complete.</Text></Card> : <><Field label="Filter by care type, city, or state" value={opportunityQuery} onChangeText={setOpportunityQuery} />{visibleOpportunities.length ? visibleOpportunities.map((job) => <Card key={job.id}><Text style={styles.cardTitle}>{job.title}</Text><Text style={styles.body}>{[job.service_city, job.service_state].filter(Boolean).join(", ") || "Service area awaiting confirmation"}</Text><Text style={styles.body}>{job.start_time ? new Date(job.start_time).toLocaleString() : "Time to be confirmed"}</Text><View style={styles.matchPanel}><Text style={styles.matchTitle}>Why this is shown</Text><Text style={styles.matchItem}>✓ Your professional account is approved.</Text><Text style={styles.matchItem}>✓ This request is open in the Georgia-first service area.</Text><Text style={styles.matchCaution}>Operations confirms schedule, distance, scope, and final assignment.</Text></View><Button label={applicationByJob.has(job.id) ? titleCase(applicationByJob.get(job.id)!.status) : "Apply"} onPress={() => void apply(job)} disabled={busy || applicationByJob.has(job.id)} /></Card>) : <Card><Text style={styles.cardTitle}>No matching open requests</Text><Text style={styles.body}>Adjust the filter or check again after updating your availability.</Text></Card>}</>}</> : null}
    {tab === "schedule" ? <><Text style={styles.eyebrow}>SCHEDULE & ACTIVE CARE</Text><Text style={styles.title}>Assigned visits</Text>{scheduleGroups.today.length ? <><Text style={styles.sectionTitle}>Today</Text>{scheduleGroups.today.map((job) => <Card key={job.id}><Text style={styles.cardTitle}>{job.title}</Text><Text style={styles.body}>{new Date(job.start_time!).toLocaleString()}</Text><Button label="Open visit workspace" onPress={() => void loadVisit(job)} /></Card>)}</> : null}{scheduleGroups.upcoming.length ? <><Text style={styles.sectionTitle}>Upcoming</Text>{scheduleGroups.upcoming.map((job) => <Card key={job.id}><Text style={styles.cardTitle}>{job.title}</Text><Text style={styles.body}>{new Date(job.start_time!).toLocaleString()}</Text><Button label="Open visit workspace" onPress={() => void loadVisit(job)} /></Card>)}</> : null}{scheduleGroups.needsScheduling.length ? <><Text style={styles.sectionTitle}>Needs scheduling attention</Text>{scheduleGroups.needsScheduling.map((job) => <Card key={job.id}><Text style={styles.cardTitle}>{job.title}</Text><Text style={styles.body}>{job.start_time ? `Scheduled time has passed: ${new Date(job.start_time).toLocaleString()}` : "Operations is confirming the visit time."}</Text><Button label="Open visit workspace" onPress={() => void loadVisit(job)} /></Card>)}</> : null}{!assignedJobs.length ? <Card><Text style={styles.cardTitle}>No assigned visits</Text><Text style={styles.body}>Accepted assignments will appear here in date order.</Text></Card> : null}{selectedJob ? <Card><Text style={styles.cardLabel}>ACTIVE VISIT</Text><Text style={styles.cardTitle}>{selectedJob.title}</Text><AssignedVisitDetails job={selectedJob} /><Text style={styles.sectionTitle}>In-person arrival</Text><Field label="Patient arrival PIN" value={arrivalPin} onChangeText={setArrivalPin} keyboardType="number-pad" /><Button label="Verify arrival PIN" onPress={() => void verifyPin()} disabled={busy || arrivalPin.length !== 6} />{nextCheckpoint ? <Button label={`Record: ${titleCase(nextCheckpoint)}`} onPress={() => void recordCheckpoint(nextCheckpoint)} disabled={busy} secondary /> : <Text style={styles.success}>All visit checkpoints recorded.</Text>}<Text style={styles.sectionTitle}>Visit report</Text><Text style={styles.body}>Document what happened, what the clinician said, what must happen next, and how the patient returned or was handed off. Attribute instructions to the provider; do not diagnose.</Text><View style={styles.reportStatus}><Text style={reportDirty ? styles.reportUnsaved : styles.success}>{reportDirty ? "Unsaved report changes" : visit.report?.status === "submitted" ? "Report submitted" : visit.report?.status === "draft" ? "Draft saved" : "Report not started"}</Text></View><Field label="Visit summary" value={summary} onChangeText={(value) => { setSummary(value); setReportDirty(true); }} multiline /><Field label="Provider instructions (source-attributed)" value={instructions} onChangeText={(value) => { setInstructions(value); setReportDirty(true); }} multiline /><Text style={styles.privacyNote}>If none were provided, enter “None provided.”</Text><Field label="Follow-up tasks and owner" value={followUp} onChangeText={(value) => { setFollowUp(value); setReportDirty(true); }} multiline /><Text style={styles.privacyNote}>If no follow-up was identified, enter “None identified.”</Text><Field label="Transportation and safe handoff outcome" value={transportOutcome} onChangeText={(value) => { setTransportOutcome(value); setReportDirty(true); }} multiline /><View style={styles.matchPanel}><Text style={styles.matchTitle}>Submission checklist</Text><Text style={summary.trim() ? styles.matchItem : styles.matchMissing}>{summary.trim() ? "✓" : "○"} Support summary</Text><Text style={instructions.trim() ? styles.matchItem : styles.matchMissing}>{instructions.trim() ? "✓" : "○"} Provider instructions or explicit none</Text><Text style={followUp.trim() ? styles.matchItem : styles.matchMissing}>{followUp.trim() ? "✓" : "○"} Follow-up ownership or explicit none</Text><Text style={transportOutcome.trim() ? styles.matchItem : styles.matchMissing}>{transportOutcome.trim() ? "✓" : "○"} Transportation and safe handoff</Text></View><Button label="Save draft" onPress={() => void saveReport("draft")} secondary disabled={busy || !reportDirty} /><Button label="Submit report" onPress={() => void saveReport("submitted")} disabled={busy || !reportComplete} /><Button label="Complete care" onPress={() => void completeVisit()} disabled={busy || nextCheckpoint !== undefined || visit.report?.status !== "submitted"} /></Card> : null}</> : null}
    {tab === "messages" ? <><Text style={styles.eyebrow}>COMMUNICATION & SAFETY</Text><Text style={styles.title}>Visit coordination</Text>{assignedJobs.map((job) => <Card key={job.id}><Text style={styles.cardTitle}>{job.title}</Text><Text style={styles.body}>Private thread for timing, arrival, and practical coordination.</Text><Button label="Open request messages" onPress={() => void loadVisit(job)} secondary /></Card>)}{selectedJob ? <Card><Text style={styles.cardLabel}>REQUEST MESSAGES</Text><Text style={styles.cardTitle}>{selectedJob.title}</Text>{jobMessages.length ? jobMessages.map((item) => <View key={item.id} style={styles.message}><View style={styles.messageHeader}><Text style={styles.detailLabel}>{item.sender_label}</Text><Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text></View><Text style={styles.detailValue}>{item.body}</Text></View>) : <Text style={styles.body}>No messages yet.</Text>}<Field label="Coordination message" value={messageDraft} onChangeText={setMessageDraft} multiline /><Button label="Send message" onPress={() => void sendMessage()} disabled={busy || !messageDraft.trim()} /><Text style={styles.privacyNote}>Not monitored for emergencies. Do not include diagnoses, account numbers, access codes, or payment information.</Text></Card> : null}<Text style={styles.sectionTitle}>Updates</Text>{notifications.map((item) => <Card key={item.id}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.body}>{item.body ?? ""}</Text><Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text></Card>)}<Card><Text style={styles.cardTitle}>Contact operations</Text><Field label="What do you need?" value={supportTitle} onChangeText={setSupportTitle} /><Field label="Practical details" value={supportDescription} onChangeText={setSupportDescription} multiline /><Button label="Request support" onPress={() => void createSupportCase("support")} disabled={busy || !supportTitle.trim()} /><Button label="Report urgent incident" onPress={() => void createSupportCase("incident")} disabled={busy || !supportTitle.trim()} secondary /></Card>{supportCases.map((item) => <Card key={item.id}><Text style={styles.cardLabel}>{titleCase(item.case_type)} · {titleCase(item.priority)}</Text><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.body}>{titleCase(item.status)}</Text></Card>)}</> : null}
    {tab === "account" ? <><Text style={styles.eyebrow}>PROFESSIONAL PROFILE</Text><Text style={styles.title}>Readiness and availability</Text><Card><Field label="Professional summary" value={professionalSummary} onChangeText={setProfessionalSummary} multiline /><Field label="Years of RN experience" value={years} onChangeText={setYears} keyboardType="number-pad" /><Field label="Service radius (miles)" value={radius} onChangeText={setRadius} keyboardType="number-pad" /><Button label="Save profile" onPress={() => void saveProfile()} disabled={busy} /><Button label="Upload RN credential" onPress={() => void uploadCredential()} secondary disabled={busy} /></Card><Card><Text style={styles.cardLabel}>AVAILABILITY</Text><Text style={styles.cardTitle}>When can you accept care?</Text><Text style={styles.body}>Add one or more windows. Patients do not see your calendar; operations uses it for qualified matching.</Text><View style={styles.dateRow}><Pressable accessibilityRole="button" onPress={() => setAvailabilityPicker("start")} style={styles.dateButton}><Text style={styles.dateLabel}>START</Text><Text style={styles.dateValue}>{availabilityStart.toLocaleString()}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setAvailabilityPicker("end")} style={styles.dateButton}><Text style={styles.dateLabel}>END</Text><Text style={styles.dateValue}>{availabilityEnd.toLocaleString()}</Text></Pressable></View>{availabilityPicker ? <View style={styles.pickerPanel}><DateTimePicker value={availabilityPicker === "start" ? availabilityStart : availabilityEnd} mode="datetime" display={Platform.OS === "ios" ? "spinner" : "default"} minuteInterval={15} minimumDate={availabilityPicker === "start" ? new Date() : availabilityStart} onChange={(_event, value) => changeAvailabilityDate(availabilityPicker, value)} />{Platform.OS === "ios" ? <Button label="Done" onPress={() => setAvailabilityPicker(null)} secondary /> : null}</View> : null}<View style={styles.choiceRow}><Pressable accessibilityRole="button" onPress={() => setAvailabilityRecurrence("none")} style={[styles.choice, availabilityRecurrence === "none" && styles.choiceActive]}><Text style={[styles.choiceText, availabilityRecurrence === "none" && styles.choiceTextActive]}>One time</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setAvailabilityRecurrence("weekly")} style={[styles.choice, availabilityRecurrence === "weekly" && styles.choiceActive]}><Text style={[styles.choiceText, availabilityRecurrence === "weekly" && styles.choiceTextActive]}>Repeat weekly</Text></Pressable></View><Button label="Add availability window" onPress={addAvailabilityWindow} secondary />{availabilityWindows.length ? availabilityWindows.map((window, index) => <View key={window.id ?? `${window.starts_at}-${index}`} style={styles.availabilityRow}><View style={styles.availabilityCopy}><Text style={styles.detailValue}>{new Date(window.starts_at).toLocaleString()}</Text><Text style={styles.meta}>Until {new Date(window.ends_at).toLocaleString()} · {window.recurrence === "weekly" ? "Repeats weekly" : "One time"}</Text></View><Pressable accessibilityRole="button" onPress={() => setAvailabilityWindows((current) => current.filter((_item, itemIndex) => itemIndex !== index))} style={styles.removeButton}><Text style={styles.removeButtonText}>Remove</Text></Pressable></View>) : <Text style={styles.body}>No availability saved. You will not appear available for matching.</Text>}<Button label="Save availability" onPress={() => void saveAvailability()} disabled={busy} /></Card><Card><Text style={styles.cardLabel}>EARNINGS</Text><Text style={styles.cardTitle}>Payouts not yet enabled</Text><Text style={styles.body}>{workspace?.payments_message ?? "Commercial records remain disabled pending approval."}</Text></Card><Button label="Sign out" onPress={() => void supabase?.auth.signOut()} secondary /></> : null}
  </ScrollView><View style={styles.tabBar}>{tabs.map((item) => <Pressable key={item.key} onPress={() => setTab(item.key)} style={styles.tab}><Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text></Pressable>)}</View>{busy ? <View style={styles.busy}><ActivityIndicator color="#fff" /></View> : null}</SafeAreaView></SafeAreaProvider>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#f3f7f5" }, center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28, gap: 16, backgroundColor: "#f3f7f5" }, login: { flex: 1, justifyContent: "center", padding: 28, gap: 14 }, logo: { width: 96, height: 96, alignSelf: "center", marginBottom: 8 }, logoSmall: { width: 48, height: 48 }, header: { backgroundColor: "#071f27", paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, brandRow: { flexDirection: "row", alignItems: "center", gap: 12 }, brandName: { color: "#fff", fontWeight: "800", fontSize: 18 }, brandMeta: { color: "#9ec1c5", fontSize: 12 }, apiLabel: { color: "#6d9398", fontSize: 9 }, scroll: { flex: 1 }, content: { padding: 20, paddingBottom: 120, gap: 14 }, eyebrow: { color: "#0b8f83", fontWeight: "800", letterSpacing: 1.2, fontSize: 12 }, hero: { color: "#071f27", fontWeight: "900", fontSize: 32, lineHeight: 38 }, title: { color: "#071f27", fontWeight: "900", fontSize: 26 }, sectionTitle: { color: "#071f27", fontWeight: "800", fontSize: 19, marginTop: 12 }, body: { color: "#4e6669", fontSize: 15, lineHeight: 22 }, meta: { color: "#78909a", fontSize: 12 }, card: { backgroundColor: "#fff", borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: "#d8e4e1" }, cardLabel: { color: "#0b8f83", fontWeight: "800", fontSize: 11, letterSpacing: 1 }, cardTitle: { color: "#071f27", fontWeight: "800", fontSize: 20 }, field: { gap: 7 }, fieldLabel: { color: "#18363b", fontWeight: "700", fontSize: 14 }, input: { backgroundColor: "#edf3f1", borderWidth: 1, borderColor: "#d2dfdc", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: "#071f27", fontSize: 16 }, multiline: { minHeight: 96, textAlignVertical: "top" }, button: { backgroundColor: "#0b8f83", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center" }, buttonSecondary: { backgroundColor: "#e2f2ef", borderWidth: 1, borderColor: "#87c7bf" }, buttonText: { color: "#fff", fontWeight: "800", fontSize: 15 }, buttonTextSecondary: { color: "#076a63" }, disabled: { opacity: 0.45 }, matchPanel: { backgroundColor: "#f4f8f7", borderColor: "#d8e4e1", borderRadius: 14, borderWidth: 1, gap: 5, padding: 12 }, matchTitle: { color: "#18363b", fontSize: 13, fontWeight: "800" }, matchItem: { color: "#08775f", fontSize: 12, lineHeight: 18 }, matchCaution: { color: "#6b7f82", fontSize: 12, lineHeight: 18 }, matchMissing: { color: "#9a5b16", fontSize: 12, lineHeight: 18 }, reportStatus: { alignItems: "flex-start", backgroundColor: "#f4f8f7", borderRadius: 12, padding: 10 }, reportUnsaved: { color: "#9a5b16", fontWeight: "800" }, dateRow: { gap: 10 }, dateButton: { backgroundColor: "#edf3f1", borderColor: "#d2dfdc", borderRadius: 14, borderWidth: 1, gap: 4, padding: 14 }, dateLabel: { color: "#0b8f83", fontSize: 11, fontWeight: "800", letterSpacing: 0.8 }, dateValue: { color: "#18363b", fontSize: 15, fontWeight: "700" }, pickerPanel: { backgroundColor: "#f4f8f7", borderRadius: 14, overflow: "hidden", padding: 8 }, choiceRow: { flexDirection: "row", gap: 8 }, choice: { backgroundColor: "#edf3f1", borderColor: "#d2dfdc", borderRadius: 12, borderWidth: 1, flex: 1, padding: 12 }, choiceActive: { backgroundColor: "#d9f1ec", borderColor: "#0b8f83" }, choiceText: { color: "#4e6669", fontWeight: "700", textAlign: "center" }, choiceTextActive: { color: "#076a63" }, availabilityRow: { alignItems: "center", backgroundColor: "#f4f8f7", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "space-between", padding: 12 }, availabilityCopy: { flex: 1, gap: 3 }, removeButton: { paddingHorizontal: 8, paddingVertical: 10 }, removeButtonText: { color: "#a92d24", fontSize: 12, fontWeight: "800" }, errorBanner: { backgroundColor: "#ffe7e4", padding: 12 }, error: { color: "#a92d24", fontWeight: "700" }, success: { color: "#08775f", fontWeight: "800" }, detailGroup: { gap: 9 }, detailRow: { backgroundColor: "#f4f8f7", borderRadius: 12, gap: 4, padding: 12 }, detailLabel: { color: "#0b8f83", fontSize: 11, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" }, detailValue: { color: "#18363b", fontSize: 15, lineHeight: 21 }, privacyNote: { color: "#6b7f82", fontSize: 12, lineHeight: 18 }, message: { borderBottomColor: "#d8e4e1", borderBottomWidth: 1, gap: 6, paddingVertical: 12 }, messageHeader: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" }, tabBar: { flexDirection: "row", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#d8e4e1", paddingVertical: 12, paddingHorizontal: 6 }, tab: { flex: 1, alignItems: "center", paddingVertical: 8 }, tabText: { color: "#718588", fontSize: 11, fontWeight: "700" }, tabTextActive: { color: "#0b8f83" }, busy: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(7,31,39,.25)", alignItems: "center", justifyContent: "center" } });
