"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../lib/adminAuthClient";

type QualitySignal = { id: string; job_id: string | null; signal_type: string; severity: string; value_numeric: number | null; created_at: string };
type RecoveryCase = { id: string; subject_id: string | null; status: string; priority: string; title: string; due_at: string | null };
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function QualityPage() {
  const [signals, setSignals] = useState<QualitySignal[]>([]);
  const [recoveryCases, setRecoveryCases] = useState<RecoveryCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ratings = useMemo(() => signals.filter((item) => item.signal_type === "patient_rating" && item.value_numeric != null), [signals]);
  const average = ratings.length ? ratings.reduce((sum, item) => sum + Number(item.value_numeric), 0) / ratings.length : null;
  const attention = signals.filter((item) => item.severity !== "info").length;

  useEffect(() => {
    void adminFetch("/api/admin/quality").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load quality operations");
      setSignals(data.signals);
      setRecoveryCases(data.recovery_cases);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load quality operations"));
  }, []);

  return <>
    <section className="page-intro"><div><p className="eyebrow">Marketplace quality</p><h2>Experience and service recovery</h2><p>Use operational signals to identify follow-up work. Ratings support service improvement; they do not automatically punish or rank care professionals.</p></div><div className="compact-stats"><span><strong>{average == null ? "–" : average.toFixed(1)}</strong><small>Average rating</small></span><span><strong>{attention}</strong><small>Needs attention</small></span><span><strong>{recoveryCases.length}</strong><small>Open recovery</small></span></div></section>
    {error ? <p className="notice">{error}</p> : null}
    <section className="data-section"><div className="section-heading"><div><p className="eyebrow">Follow-up queue</p><h2>Open service recovery</h2></div><Link className="button secondary compact" href="/operations">Open operations</Link></div><div className="table-shell"><table><thead><tr><th>Priority</th><th>Case</th><th>Request</th><th>Status</th><th>Due</th></tr></thead><tbody>{recoveryCases.map((item) => <tr key={item.id}><td><span className="badge pending">{label(item.priority)}</span></td><td><strong>{item.title}</strong></td><td>{item.subject_id ? <Link href={`/jobs/${item.subject_id}`}>{item.subject_id}</Link> : "–"}</td><td>{label(item.status)}</td><td>{item.due_at ? new Date(item.due_at).toLocaleString() : "Not set"}</td></tr>)}{recoveryCases.length === 0 ? <tr><td colSpan={5}>No open service-recovery cases.</td></tr> : null}</tbody></table></div></section>
    <section className="data-section"><div className="section-heading"><div><p className="eyebrow">Privacy-safe telemetry</p><h2>Recent quality signals</h2></div></div><p className="section-note">This view intentionally omits private comments and signal metadata. Open the authorized request record only when operational follow-up requires it.</p><div className="table-shell"><table><thead><tr><th>Time</th><th>Signal</th><th>Severity</th><th>Value</th><th>Request</th></tr></thead><tbody>{signals.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td><strong>{label(item.signal_type)}</strong></td><td><span className={`badge ${item.severity !== "info" ? "pending" : ""}`}>{label(item.severity)}</span></td><td>{item.value_numeric ?? "–"}</td><td>{item.job_id ? <Link href={`/jobs/${item.job_id}`}>{item.job_id}</Link> : "–"}</td></tr>)}{signals.length === 0 ? <tr><td colSpan={5}>No quality signals recorded yet.</td></tr> : null}</tbody></table></div></section>
  </>;
}
