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
type CasePresence = { admin_user_id: string; mode: "viewing" | "editing"; expires_at: string };

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
  const [presence, setPresence] = useState<CasePresence[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [query, setQuery] = useState("");
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
    const data = await response.json() as { case: OperationsCase; notes: CaseNote[]; presence: CasePresence[]; current_admin_id: string };
    setSelected(data.case);
    setNotes(data.notes);
    setPresence(data.presence);
    setCurrentAdminId(data.current_admin_id);
    await adminFetch(`/api/admin/operations/${item.id}/presence`, { method: "POST", body: JSON.stringify({ mode: "viewing" }) });
  };

  useEffect(() => { void load().catch(() => setMessage("Sign in to view the operations queue.")); }, []);

  const visibleCases = useMemo(() => cases.filter((item) => {
    const active = !["resolved", "closed"].includes(item.status);
    const overdue = active && Boolean(item.due_at && new Date(item.due_at).getTime() < Date.now());
    if (filter !== "all" && item.case_type !== filter) return false;
    if (statusFilter === "active" && !active) return false;
    if (statusFilter === "overdue" && !overdue) return false;
    if (statusFilter === "handoff" && (!active || !item.handoff_note)) return false;
    if (!["all", "active", "overdue", "handoff"].includes(statusFilter) && item.status !== statusFilter) return false;
    if (ownerFilter === "mine" && item.owner_user_id !== currentAdminId) return false;
    if (ownerFilter === "unclaimed" && item.owner_user_id) return false;
    const normalized = query.trim().toLowerCase();
    return !normalized || [item.title, item.description, item.subject_type].some((value) => value?.toLowerCase().includes(normalized));
  }), [cases, currentAdminId, filter, ownerFilter, query, statusFilter]);
  const otherOperators = useMemo(() => presence.filter((item) => item.admin_user_id !== currentAdminId), [presence, currentAdminId]);
  const activeCases = cases.filter((item) => !["closed", "resolved"].includes(item.status));
  const overdueCases = activeCases.filter((item) => item.due_at && new Date(item.due_at).getTime() < Date.now());

  const updateCase = async (updates: Partial<OperationsCase> & { claim?: boolean }) => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    await adminFetch(`/api/admin/operations/${selected.id}/presence`, { method: "POST", body: JSON.stringify({ mode: "editing" }) });
    const response = await adminFetch(`/api/admin/operations/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        expected_version: selected.version,
        owner_user_id: updates.claim ? "me" : updates.owner_user_id ?? selected.owner_user_id,
        status: updates.status ?? selected.status,
        priority: updates.priority ?? selected.priority,
        due_at: "due_at" in updates ? updates.due_at : selected.due_at,
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
      <div className="compact-stats"><span><strong>{activeCases.length}</strong><small>Active</small></span><span><strong>{overdueCases.length}</strong><small>Overdue</small></span><span><strong>{activeCases.filter((item) => item.owner_user_id === currentAdminId).length}</strong><small>Mine</small></span></div>
    </section>
    {message ? <p className="notice" role="status">{message}</p> : null}
    <section className="data-section">
      <div className="section-heading"><div><p className="eyebrow">Queues</p><h2>Operational work</h2></div></div>
      <div className="queue-toolbar"><input className="search-field" aria-label="Search operations cases" placeholder="Search cases" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Case status view" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Active work</option><option value="overdue">Overdue</option><option value="handoff">Shift handoffs</option>{statuses.map((status) => <option value={status} key={status}>{label(status)}</option>)}<option value="all">All statuses</option></select><select aria-label="Case owner view" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option value="all">All owners</option><option value="mine">Assigned to me</option><option value="unclaimed">Unclaimed</option></select></div><div className="segmented">{caseTypes.map((type) => <button className={`button compact${filter === type ? "" : " secondary"}`} key={type} onClick={() => setFilter(type)}>{label(type)}</button>)}</div>
      <div className="table-shell"><table><thead><tr><th>Priority</th><th>Case</th><th>Queue</th><th>Status</th><th>Owner</th><th>Due</th><th>Updated</th><th>Action</th></tr></thead><tbody>
        {visibleCases.map((item) => { const overdue = !["resolved", "closed"].includes(item.status) && Boolean(item.due_at && new Date(item.due_at).getTime() < Date.now()); return <tr key={item.id}><td><span className={`badge ${item.priority === "urgent" ? "pending" : ""}`}>{label(item.priority)}</span></td><td><strong>{item.title}</strong><div className="table-meta">{item.subject_type}{item.handoff_note ? " · Handoff ready" : ""}</div></td><td>{label(item.case_type)}</td><td>{label(item.status)}</td><td>{item.owner_user_id ? item.owner_user_id === currentAdminId ? "You" : "Owned" : "Unclaimed"}</td><td><span className={overdue ? "overdue-text" : ""}>{item.due_at ? new Date(item.due_at).toLocaleString() : "No deadline"}</span></td><td>{new Date(item.last_activity_at).toLocaleString()}</td><td><button className="button secondary compact" onClick={() => void openCase(item)}>Open</button></td></tr>; })}
        {visibleCases.length === 0 ? <tr><td colSpan={8}>No cases match this operational view.</td></tr> : null}
      </tbody></table></div>
    </section>
    {selected ? <section className="data-section">
      <div className="section-heading"><div><p className="eyebrow">Case workspace · v{selected.version}</p><h2>{selected.title}</h2><p>{selected.description ?? "No additional description."}</p></div><div className="inline-actions">{!selected.owner_user_id ? <button className="button compact" disabled={saving} onClick={() => void updateCase({ claim: true })}>Claim case</button> : null}<button className="button secondary compact" onClick={() => void openCase(selected)}>Refresh</button></div></div>
      {otherOperators.length ? <div className="collision-notice" role="status"><strong>Another operator has this case open.</strong><span>{otherOperators.map((item) => `${item.mode} until ${new Date(item.expires_at).toLocaleTimeString()}`).join(" · ")}. Refresh before saving to avoid a version conflict.</span></div> : null}
      <div className="dashboard-grid"><article className="queue-panel"><h3>Disposition</h3>{selected.case_type === "incident" && !selected.due_at ? <div className="session-notice"><span aria-hidden="true">!</span><div><strong>Incident response deadline missing</strong><p>Set explicit ownership and response timing before handoff.</p></div><button className="button compact" onClick={() => void updateCase({ ...selected, priority: "urgent", status: "triaged", due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() })}>Set 1-hour response</button></div> : null}<label>Status<select value={selected.status} onChange={(event) => setSelected({ ...selected, status: event.target.value })}>{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label><label>Priority<select value={selected.priority} onChange={(event) => setSelected({ ...selected, priority: event.target.value })}>{priorities.map((priority) => <option key={priority} value={priority}>{label(priority)}</option>)}</select></label><label>Response deadline<input type="datetime-local" value={selected.due_at ? new Date(new Date(selected.due_at).getTime() - new Date(selected.due_at).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ""} onChange={(event) => setSelected({ ...selected, due_at: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label><label>Shift handoff<textarea placeholder="Current state, next action, owner, and deadline" value={selected.handoff_note ?? ""} onChange={(event) => setSelected({ ...selected, handoff_note: event.target.value })} /></label><label>Resolution summary<textarea value={selected.resolution_summary ?? ""} onChange={(event) => setSelected({ ...selected, resolution_summary: event.target.value })} /></label><button className="button" disabled={saving} onClick={() => void updateCase(selected)}>Save guarded update</button></article>
      <article className="queue-panel"><h3>Internal timeline</h3>{notes.map((item) => <div className="work-row" key={item.id}><span className="work-copy"><strong>{item.body}</strong><small>{new Date(item.created_at).toLocaleString()} · {label(item.visibility)}</small></span></div>)}<label>Add internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="button secondary" disabled={saving || !note.trim()} onClick={() => void addNote()}>Add note</button></article></div>
    </section> : null}
  </>;
}
