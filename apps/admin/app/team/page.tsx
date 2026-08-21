"use client";

import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../lib/adminAuthClient";

type TeamMember = {
  admin_user_id: string;
  display_name: string;
  operations_role: string;
  active: boolean;
  configured: boolean;
  created_at: string | null;
  updated_at: string | null;
};

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const roles = ["operator", "supervisor", "credential_reviewer", "support", "finance"];

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const activeMembers = useMemo(() => members.filter((member) => member.active), [members]);
  const roleCount = useMemo(() => new Set(activeMembers.map((member) => member.operations_role)).size, [activeMembers]);

  const load = async () => {
    await adminFetch("/api/admin/team").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load team");
      setMembers(data.members);
      setCurrentAdminId(data.current_admin_id);
      setCanManage(data.can_manage);
      setBootstrapRequired(data.bootstrap_required);
    });
  };

  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load team")); }, []);

  const saveMember = async (member: TeamMember) => {
    setSavingId(member.admin_user_id); setError(null); setMessage(null);
    try {
      const response = await adminFetch(`/api/admin/team/${member.admin_user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ operations_role: member.operations_role, active: member.active })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update team member");
      await load();
      setMessage("Team responsibility updated and recorded in the audit trail.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update team member"); } finally { setSavingId(null); }
  };

  const bootstrapSupervisor = async () => {
    const current = members.find((member) => member.admin_user_id === currentAdminId);
    if (!current) return;
    await saveMember({ ...current, operations_role: "supervisor", active: true });
  };

  return <>
    <section className="page-intro"><div><p className="eyebrow">Operations ownership</p><h2>Team and responsibilities</h2><p>See who may own queues, review credentials, coordinate support, supervise work, or review gated finance records.</p></div><div className="compact-stats"><span><strong>{activeMembers.length}</strong><small>Active</small></span><span><strong>{roleCount}</strong><small>Roles covered</small></span></div></section>
    {error ? <p className="notice">{error}</p> : null}{message ? <p className="success-notice">{message}</p> : null}
    {bootstrapRequired ? <section className="data-section"><div className="section-heading"><div><p className="eyebrow">One-time setup</p><h2>Establish the first supervisor</h2><p>The current administrator must become the first active supervisor before any other team responsibility can change.</p></div><button className="button" disabled={savingId !== null} onClick={() => void bootstrapSupervisor()}>Activate me as supervisor</button></div></section> : null}
    <section className="data-section"><div className="section-heading"><div><p className="eyebrow">Authorized operators</p><h2>Role roster</h2></div><span className="privacy-pill">{canManage ? "Supervisor controls" : "View only"}</span></div><p className="section-note">Every change is audited. The database prevents removal or demotion of the final active supervisor.</p><div className="table-shell"><table><thead><tr><th>Operator</th><th>Operations role</th><th>Status</th><th>Last updated</th><th>Action</th></tr></thead><tbody>{members.map((member) => <tr key={member.admin_user_id}><td><strong>{member.display_name}</strong><div className="table-meta">{member.admin_user_id === currentAdminId ? "Current operator" : "Authorized administrator"}</div></td><td>{canManage ? <select aria-label={`Role for ${member.display_name}`} value={member.operations_role} onChange={(event) => setMembers((current) => current.map((item) => item.admin_user_id === member.admin_user_id ? { ...item, operations_role: event.target.value } : item))}>{roles.map((role) => <option value={role} key={role}>{label(role)}</option>)}</select> : label(member.operations_role)}</td><td>{canManage ? <label className="inline-checkbox"><input type="checkbox" checked={member.active} onChange={(event) => setMembers((current) => current.map((item) => item.admin_user_id === member.admin_user_id ? { ...item, active: event.target.checked } : item))} />Active</label> : <span className={`badge ${member.active ? "" : "pending"}`}>{member.active ? "Active" : "Inactive"}</span>}</td><td>{member.updated_at ? new Date(member.updated_at).toLocaleString() : "Not configured"}</td><td>{canManage ? <button className="button compact" disabled={savingId !== null || bootstrapRequired} onClick={() => void saveMember(member)}>{savingId === member.admin_user_id ? "Saving…" : member.configured ? "Save" : "Configure"}</button> : "—"}</td></tr>)}{members.length === 0 && !error ? <tr><td colSpan={5}>No administrator profiles are available.</td></tr> : null}</tbody></table></div></section>
  </>;
}
