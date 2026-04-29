import React, { useEffect, useMemo, useState } from "react";
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
import { supabase } from "./src/supabase";

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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [patientJobs, setPatientJobs] = useState<JobRow[]>([]);
  const [nurseJobs, setNurseJobs] = useState<JobRow[]>([]);
  const [assignedMap, setAssignedMap] = useState<Record<string, string>>({});

  const [selectedJob, setSelectedJob] = useState<JobRow | null>(null);
  const [selectedJobApp, setSelectedJobApp] = useState<ApplicationRow | null>(null);

  const [nurseProfile, setNurseProfile] = useState<NurseProfile | null>(null);

  const [jobForm, setJobForm] = useState({
    title: "",
    description: "",
    address: "",
    start_time: "",
    hourly_rate: ""
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (!session) {
        setRole(null);
        setNurseProfile(null);
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id,role")
        .eq("id", session.user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
        return;
      }

      const nextRole = (data.role as UserRole) ?? "patient";
      setRole(nextRole);

      if (nextRole === "nurse") {
        const { data: nurseRow } = await supabase
          .from("nurse_profiles")
          .select("verification_status,verified_at")
          .eq("nurse_id", session.user.id)
          .maybeSingle();

        setNurseProfile((nurseRow as NurseProfile) ?? { verification_status: "pending", verified_at: null });
      }
    };

    void loadProfile();
  }, [session]);

  useEffect(() => {
    if (!session || !role) return;
    if (role === "patient") {
      void loadPatientJobs();
    }
    if (role === "nurse") {
      void loadNurseJobs();
    }
  }, [session, role]);

  const loadPatientJobs = async () => {
    setError(null);
    const { data, error: jobsError } = await supabase
      .from("jobs")
      .select("id,title,description,address,start_time,hourly_rate,status,created_at")
      .eq("patient_user_id", session?.user.id)
      .order("created_at", { ascending: false });

    if (jobsError) {
      setError(jobsError.message);
      return;
    }

    const jobs = (data ?? []) as JobRow[];
    setPatientJobs(jobs);

    const jobIds = jobs.map((job) => job.id);
    if (jobIds.length === 0) {
      setAssignedMap({});
      return;
    }

    const { data: apps } = await supabase
      .from("applications")
      .select("job_id,nurse_user_id,status")
      .in("job_id", jobIds)
      .eq("status", "accepted");

    const map: Record<string, string> = {};
    (apps ?? []).forEach((row) => {
      map[(row as any).job_id] = (row as any).nurse_user_id;
    });
    setAssignedMap(map);
  };

  const loadNurseJobs = async () => {
    setError(null);

    const { data: openJobs, error: openErr } = await supabase
      .from("jobs")
      .select("id,title,description,address,start_time,hourly_rate,status,created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (openErr) {
      setError(openErr.message);
      return;
    }

    const { data: apps } = await supabase
      .from("applications")
      .select("job_id,status")
      .eq("nurse_user_id", session?.user.id)
      .eq("status", "accepted");

    const assignedJobIds = Array.from(new Set((apps ?? []).map((row) => (row as any).job_id)));
    let assignedJobs: JobRow[] = [];

    if (assignedJobIds.length > 0) {
      const { data: assigned, error: assignedErr } = await supabase
        .from("jobs")
        .select("id,title,description,address,start_time,hourly_rate,status,created_at")
        .in("id", assignedJobIds)
        .order("created_at", { ascending: false });

      if (assignedErr) {
        setError(assignedErr.message);
        return;
      }

      assignedJobs = (assigned ?? []) as JobRow[];
    }

    const merged = [...(openJobs ?? []), ...assignedJobs];
    const byId = new Map(merged.map((job) => [job.id, job as JobRow]));
    setNurseJobs(Array.from(byId.values()));
  };

  const loadSelectedJobApplication = async (jobId: string) => {
    if (!session) return;
    const { data } = await supabase
      .from("applications")
      .select("id,job_id,nurse_user_id,status,created_at")
      .eq("job_id", jobId)
      .eq("nurse_user_id", session.user.id)
      .maybeSingle();

    setSelectedJobApp((data as ApplicationRow) ?? null);
  };

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError(signInError.message);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) setError(signUpError.message);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleCreateJob = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);

    const { error: createError } = await supabase.from("jobs").insert({
      created_by: session.user.id,
      patient_user_id: session.user.id,
      title: jobForm.title,
      description: jobForm.description || null,
      address: jobForm.address || null,
      start_time: jobForm.start_time || null,
      hourly_rate: jobForm.hourly_rate ? Number(jobForm.hourly_rate) : null,
      status: "open"
    });

    setLoading(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    setJobForm({ title: "", description: "", address: "", start_time: "", hourly_rate: "" });
    await loadPatientJobs();
  };

  const handleApply = async () => {
    if (!session || !selectedJob) return;
    if (nurseProfile?.verification_status !== "approved") {
      setError("Verification required to apply.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: applyError } = await supabase.from("applications").insert({
      job_id: selectedJob.id,
      nurse_user_id: session.user.id,
      status: "applied"
    });

    setLoading(false);

    if (applyError) {
      setError(applyError.message);
      return;
    }

    await loadSelectedJobApplication(selectedJob.id);
  };

  const handleWithdraw = async () => {
    if (!session || !selectedJob) return;
    setLoading(true);
    setError(null);

    const { error: withdrawError } = await supabase
      .from("applications")
      .update({ status: "withdrawn" })
      .eq("job_id", selectedJob.id)
      .eq("nurse_user_id", session.user.id);

    setLoading(false);

    if (withdrawError) {
      setError(withdrawError.message);
      return;
    }

    await loadSelectedJobApplication(selectedJob.id);
  };

  const roleLabel = useMemo(() => role ?? "guest", [role]);

  if (loading && !session) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1E6A5A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>NurseBridge</Text>
        <Text style={styles.subTitle}>Role: {roleLabel}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

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
            <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? "Working..." : "Sign In"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSignUp} disabled={loading}>
              <Text style={styles.secondaryButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Account</Text>
              <Text style={styles.meta}>{session.user.email}</Text>
              {role === "nurse" && nurseProfile ? (
                <Text style={styles.meta}>
                  Verification: {nurseProfile.verification_status}
                </Text>
              ) : null}
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut}>
                <Text style={styles.secondaryButtonText}>Sign Out</Text>
              </TouchableOpacity>
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
                    style={styles.input}
                    placeholder="Description"
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
                    placeholder="Start time (ISO)"
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
                  <TouchableOpacity style={styles.button} onPress={handleCreateJob} disabled={loading}>
                    <Text style={styles.buttonText}>Create Job</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>My Jobs</Text>
                  {patientJobs.length === 0 ? (
                    <Text style={styles.meta}>No jobs yet.</Text>
                  ) : (
                    patientJobs.map((job) => (
                      <View key={job.id} style={styles.jobCard}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <Text style={styles.meta}>Status: {job.status}</Text>
                        <Text style={styles.meta}>Assigned Nurse: {assignedMap[job.id] ?? "-"}</Text>
                      </View>
                    ))
                  )}
                </View>
              </>
            ) : null}

            {role === "nurse" ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Open / Assigned Jobs</Text>
                  {nurseJobs.length === 0 ? (
                    <Text style={styles.meta}>No jobs available.</Text>
                  ) : (
                    nurseJobs.map((job) => (
                      <TouchableOpacity
                        key={job.id}
                        style={styles.jobCard}
                        onPress={() => {
                          setSelectedJob(job);
                          void loadSelectedJobApplication(job.id);
                        }}
                      >
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <Text style={styles.meta}>Status: {job.status}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>

                {selectedJob ? (
                  <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Job Detail</Text>
                    <Text style={styles.jobTitle}>{selectedJob.title}</Text>
                    <Text style={styles.meta}>{selectedJob.description ?? "-"}</Text>
                    <Text style={styles.meta}>Address: {selectedJob.address ?? "-"}</Text>
                    <Text style={styles.meta}>Start: {selectedJob.start_time ?? "-"}</Text>
                    <Text style={styles.meta}>Rate: {selectedJob.hourly_rate ?? "-"}</Text>

                    {selectedJobApp?.status === "applied" ? (
                      <TouchableOpacity style={styles.secondaryButton} onPress={handleWithdraw}>
                        <Text style={styles.secondaryButtonText}>Withdraw</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.button}
                        onPress={handleApply}
                        disabled={nurseProfile?.verification_status !== "approved"}
                      >
                        <Text style={styles.buttonText}>
                          {nurseProfile?.verification_status === "approved" ? "Apply" : "Verification Required"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
              </>
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
  content: {
    padding: 24
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#221E1A",
    marginBottom: 4
  },
  subTitle: {
    fontSize: 12,
    color: "#6C6259",
    marginBottom: 12
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2DCD3",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "#FFF"
  },
  button: {
    backgroundColor: "#1E6A5A",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center"
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600"
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#1E6A5A",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10
  },
  secondaryButtonText: {
    color: "#1E6A5A",
    fontWeight: "600"
  },
  jobCard: {
    backgroundColor: "#F8F6F2",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4
  },
  meta: {
    fontSize: 12,
    color: "#5E564F"
  },
  error: {
    color: "#B00020",
    marginBottom: 12
  }
});
