"use client";

import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../lib/adminAuthClient";

type OperationsCase = {
  id: string;
  case_type: string;
  subject_type: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  owner_user_id: string | null;
  due_at: string | null;
  handoff_note: string | null;
  resolution_summary: string | null;
  version: number;
  last_activity_at: string;
  created_at: string;
};

type CaseNote = { id: string; body: string; visibility: string; created_at: string };

const caseTypes = ["all", "intake", "credential", "matching", "support", "incident", "service_recovery", "finance"];
const statuses = ["open", "triaged", "in_progress", "waiting", "resolved", "closed"];
const priorities = ["low", "normal", "high", "urgent"];

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
export default function OperationsPage() {
  const [cases, setCases] = useState<OperationsCase[]>([]);
  const [selected, setSelected] = useState<OperationsCase | null>(null);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [filter, setFilter] = useState("all");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await adminFetch("/api/admin/operations");
    if (!response.ok) throw new Error("Unable to load operations queue");
    const data = await response.json() as { cases: OperationsCase[]; current_admin_id: string };
    setCases(data.cases);
    setCurrentAdminId(data.current_admin_id);
  };

  const openCase = async (item: OperationsCase) => {
    setMessage(null);
    const response = await adminFetch(`/api/admin/operations/${item.id}`);
    if (!response.ok) { setMessage("Unable to load the selected case."); return; }
    const data = await response.json() as { case: OperationsCase; notes: CaseNote[] };
    setSelected(data.case);
    setNotes(data.notes);
    await adminFetch(`/api/admin/operations/${item.id}/presence`, { method: "POST", body: JSON.stringify({ mode: "viewing" }) });
  };

  useEffect(() => { void load().catch(() => setMessage("Sign in to view the operations queue.")); }, []);

  const visibleCases = useMemo(() => filter === "all" ? cases : cases.filter((item) => item.case_type === filter), [cases, filter]);

  const updateCase = async (updates: Partial<OperationsCase> & { claim?: boolean }) => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    const response = await adminFetch(`/api/admin/operations/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        expected_version: selected.version,
        owner_user_id: updates.claim ? "me" : updates.owner_user_id ?? selected.owner_user_id,
        status: updates.status ?? selected.status,
        priority: updates.priority ?? selected.priority,
        due_at: updates.due_at ?? selected.due_at,
        handoff_note: updates.handoff_note ?? selected.handoff_note,
        resolution_summary: updates.resolution_summary ?? selected.resolution_summary
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(response.status === 409 ? "This case changed in another session. Refresh before saving." : data.error ?? "Unable to update case.");
    } else {
      setSelected(data.case);
      setCases((current) => current.map((item) => item.id === data.case.id ? data.case : item));
      setMessage("Case updated.");
    }
    setSaving(false);
  };

  const addNote = async () => {
    if (!selected || !note.trim()) return;
    setSaving(true);
    const response = await adminFetch(`/api/admin/operations/${selected.id}/notes`, { method: "POST", body: JSON.stringify({ body: note, visibility: "internal" }) });
    const data = await response.json();
    if (response.ok) { setNotes((current) => [...current, data.note]); setNote(""); setMessage("Internal note added."); }
    else setMessage(data.error ?? "Unable to add note.");
    setSaving(false);
  };

  return <>
    <section className="page-intro">
      <div><p className="eyebrow">Exception-first operations</p><h2>Owned queues and handoffs</h2><p>Coordinate intake, matching, support, incidents, recovery, and finance work with explicit ownership and collision-safe updates.</p></div>
      <div className="compact-stats"><span><strong>{cases.filter((item) => item.status !== "closed" && item.status !== "resolved").length}</strong><small>Active</small></span><span><strong>{cases.filter((item) => item.priority === "urgent").length}</strong><small>Urgent</small></span><span><strong>{cases.filter((item) => item.owner_user_id === currentAdminId).length}</strong><small>Mine</small></span></div>
    </section>
    {message ? <p className="notice" role="status">{message}</p> : null}
    <section className="data-section">
      <div className="section-heading"><div><p className="eyebrow">Queues</p><h2>Operational work</h2></div><div className="inline-actions">{caseTypes.map((type) => <button className={`button compact${filter === type ? "" : " secondary"}`} key={type} onClick={() => setFilter(type)}>{label(type)}</button>)}</div></div>
      <div className="table-shell"><table><thead><tr><th>Priority</th><th>Case</th><th>Queue</th><th>Status</th><th>Owner</th><th>Updated</th></tr></thead><tbody>
        {visibleCases.map((item) => <tr key={item.id} onClick={() => void openCase(item)} style={{ cursor: "pointer" }}><td><span className={`badge ${item.priority === "urgent" ? "pending" : ""}`}>{label(item.priority)}</span></td><td><strong>{item.title}</strong><div className="table-meta">{item.subject_type}</div></td><td>{label(item.case_type)}</td><td>{label(item.status)}</td><td>{item.owner_user_id ? item.owner_user_id === currentAdminId ? "You" : "Owned" : "Unclaimed"}</td><td>{new Date(item.last_activity_at).toLocaleString()}</td></tr>)}
        {visibleCases.length === 0 ? <tr><td colSpan={6}>No cases in this queue.</td></tr> : null}
      </tbody></table></div>
    </section>
    {selected ? <section className="data-section">
      <div className="section-heading"><div><p className="eyebrow">Case workspace · v{selected.version}</p><h2>{selected.title}</h2><p>{selected.description ?? "No additional description."}</p></div><div className="inline-actions">{!selected.owner_user_id ? <button className="button compact" disabled={saving} onClick={() => void updateCase({ claim: true })}>Claim case</button> : null}<button className="button secondary compact" onClick={() => void openCase(selected)}>Refresh</button></div></div>
      <div className="dashboard-grid"><article className="queue-panel"><h3>Disposition</h3><label>Status<select value={selected.status} onChange={(event) => setSelected({ ...selected, status: event.target.value })}>{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label><label>Priority<select value={selected.priority} onChange={(event) => setSelected({ ...selected, priority: event.target.value })}>{priorities.map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}</select></label><label>Shift handoff<textarea value={selected.handoff_note ?? ""} onChange={(event) => setSelected({ ...selected, handoff_note: event.target.value })} /></label><label>Resolution summary<textarea value={selected.resolution_summary ?? ""} onChange={(event) => setSelected({ ...selected, resolution_summary: event.target.value })} /></label><button className="button" disabled={saving} onClick={() => void updateCase(selected)}>Save guarded update</button></article>
      <article className="queue-panel"><h3>Internal timeline</h3>{notes.map((item) => <div className="work-row" key={item.id}><span className="work-copy"><strong>{item.body}</strong><small>{new Date(item.created_at).toLocaleString()} · {label(item.visibility)}</small></span></div>)}<label>Add internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="button secondary" disabled={saving || !note.trim()} onClick={() => void addNote()}>Add note</button></article></div>
    </section> : null}
  </>;
}
