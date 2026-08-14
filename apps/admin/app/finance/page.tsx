"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminAuthClient";

type Quote = { id: string; job_id: string; version: number; patient_total_cents: number; included_minutes: number; status: string; created_at: string };
type Earning = { id: string; job_id: string; nurse_user_id: string; guaranteed_cents: number; adjustment_cents: number; status: string; created_at: string };

export default function FinancePage() {
  const [data, setData] = useState<{ ledger_enabled: boolean; payment_processing_enabled: boolean; quotes: Quote[]; earnings: Earning[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void adminFetch("/api/admin/finance").then(async (response) => { if (!response.ok) throw new Error(); setData(await response.json()); }).catch(() => setError("Unable to load the commercial ledger.")); }, []);
  const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  return <><section className="page-intro"><div><p className="eyebrow">Controlled commercial readiness</p><h2>Quotes and nurse earnings</h2><p>Versioned package-price and guaranteed-payout records. No patient bidding, cash collection, card data, or automated money movement.</p></div></section><div className="session-notice"><span aria-hidden="true">!</span><div><strong>{data?.ledger_enabled ? "Manual draft ledger enabled" : "Commercial writes are locked"}</strong><p>Payment processing remains disabled until licensing, insurance, workforce, privacy, pricing, accounting, and operating approvals are documented.</p></div></div>{error ? <p className="notice">{error}</p> : null}<section className="data-section"><div className="section-heading"><div><p className="eyebrow">Patient authorization</p><h2>Versioned quotes</h2></div></div><div className="table-shell"><table><thead><tr><th>Request</th><th>Version</th><th>Package</th><th>Included time</th><th>Status</th><th>Created</th></tr></thead><tbody>{(data?.quotes ?? []).map((quote) => <tr key={quote.id}><td>{quote.job_id}</td><td>v{quote.version}</td><td>{money(quote.patient_total_cents)}</td><td>{quote.included_minutes} min</td><td>{quote.status}</td><td>{new Date(quote.created_at).toLocaleString()}</td></tr>)}</tbody></table></div></section><section className="data-section"><div className="section-heading"><div><p className="eyebrow">Professional payout</p><h2>Guaranteed earnings records</h2></div></div><div className="table-shell"><table><thead><tr><th>Request</th><th>Nurse</th><th>Guaranteed</th><th>Adjustment</th><th>Status</th></tr></thead><tbody>{(data?.earnings ?? []).map((earning) => <tr key={earning.id}><td>{earning.job_id}</td><td>{earning.nurse_user_id}</td><td>{money(earning.guaranteed_cents)}</td><td>{money(earning.adjustment_cents)}</td><td>{earning.status}</td></tr>)}</tbody></table></div></section></>;
}
