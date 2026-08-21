"use client";

import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../lib/adminAuthClient";

type Plan = { id: string; patient_name: string; preferred_nurse_name: string | null; source_job_id: string | null; cadence: string; starts_on: string; ends_on: string | null; local_time: string; timezone: string; status: string; occurrences_limit: number | null; created_at: string };
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const actions: Record<string, Array<{ status: string; label: string }>> = {
  draft: [{ status: "pending_review", label: "Send to review" }, { status: "cancelled", label: "Cancel" }],
  pending_review: [{ status: "active", label: "Approve pattern" }, { status: "cancelled", label: "Decline" }],
  active: [{ status: "paused", label: "Pause" }, { status: "completed", label: "Complete" }, { status: "cancelled", label: "Cancel" }],
  paused: [{ status: "active", label: "Resume" }, { status: "completed", label: "Complete" }, { status: "cancelled", label: "Cancel" }]
};

export default function ContinuityPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filter, setFilter] = useState("pending_review");
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const load = async () => { const response = await adminFetch("/api/admin/continuity"); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to load continuity plans"); setPlans(data.plans); };
  useEffect(() => { void load().catch((cause) => setMessage(cause instanceof Error ? cause.message : "Unable to load continuity plans")); }, []);
  const visible = useMemo(() => filter === "all" ? plans : plans.filter((plan) => plan.status === filter), [filter, plans]);
  const update = async (plan: Plan, status: string) => { setSavingId(plan.id); setMessage(null); try { const response = await adminFetch(`/api/admin/continuity/${plan.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to update plan"); await load(); setMessage(`Plan moved to ${label(status)}.`); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to update plan"); } finally { setSavingId(null); } };
  return <><section className="page-intro"><div><p className="eyebrow">Marketplace continuity</p><h2>Recurring-care review</h2><p>Approve the care pattern without automatically scheduling, assigning, charging, or promising a specific nurse. Every occurrence remains independently reviewed.</p></div><div className="compact-stats"><span><strong>{plans.filter((plan) => plan.status === "pending_review").length}</strong><small>Review</small></span><span><strong>{plans.filter((plan) => plan.status === "active").length}</strong><small>Active</small></span><span><strong>{plans.filter((plan) => plan.status === "paused").length}</strong><small>Paused</small></span></div></section>{message ? <p className="notice" role="status">{message}</p> : null}<section className="data-section"><div className="section-heading"><div><p className="eyebrow">Continuity queue</p><h2>Care patterns</h2></div><select aria-label="Plan status" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="pending_review">Pending review</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="all">All</option></select></div><div className="table-shell"><table><thead><tr><th>Patient</th><th>Pattern</th><th>Preferred nurse</th><th>Status</th><th>Safety gate</th><th>Actions</th></tr></thead><tbody>{visible.map((plan) => <tr key={plan.id}><td><strong>{plan.patient_name}</strong><div className="table-meta">Starts {new Date(`${plan.starts_on}T12:00:00`).toLocaleDateString()}</div></td><td>{label(plan.cadence)} at {plan.local_time.slice(0, 5)}<div className="table-meta">{plan.timezone}{plan.occurrences_limit ? ` · Up to ${plan.occurrences_limit}` : ""}</div></td><td>{plan.preferred_nurse_name ?? "No preference"}</td><td><span className="badge">{label(plan.status)}</span></td><td><span className="privacy-pill">Occurrence review required</span></td><td><div className="inline-actions">{(actions[plan.status] ?? []).map((action) => <button className={`button compact${action.status === "active" ? "" : " secondary"}`} disabled={savingId !== null} key={action.status} onClick={() => void update(plan, action.status)}>{savingId === plan.id ? "Saving…" : action.label}</button>)}</div></td></tr>)}{visible.length === 0 ? <tr><td colSpan={6}>No recurring-care plans match this view.</td></tr> : null}</tbody></table></div></section></>;
}
