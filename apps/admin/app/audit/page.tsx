"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminAuthClient";

type AuditEvent = { id: string; action: string; entity_type: string; entity_id: string | null; actor_id: string; created_at: string };

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void adminFetch("/api/admin/audit").then(async (response) => { if (!response.ok) throw new Error(); setEvents((await response.json()).events); }).catch(() => setError("Unable to load the audit trail.")); }, []);
  return <><section className="page-intro"><div><p className="eyebrow">Accountability</p><h2>Administrative audit trail</h2><p>Review sensitive administrative actions without exposing credentials or private document contents.</p></div></section>{error ? <p className="notice">{error}</p> : null}<section className="data-section"><div className="table-shell"><table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Reference</th><th>Actor</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{new Date(event.created_at).toLocaleString()}</td><td><strong>{event.action.replaceAll("_", " ")}</strong></td><td>{event.entity_type}</td><td>{event.entity_id ?? "-"}</td><td>{event.actor_id}</td></tr>)}</tbody></table></div></section></>;
}
