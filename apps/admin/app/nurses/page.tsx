"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminAuthClient";

type NurseRow = {
  id: string;
  license_number: string | null;
  verified: boolean;
  verification_status: string;
  verified_at: string | null;
  profile_name: string | null;
  profile_phone: string | null;
  created_at: string;
};

type VerificationDocument = {
  id: string;
  storage_path: string;
  document_type: string;
  status: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export default function NursesPage() {
  const [nurses, setNurses] = useState<NurseRow[]>([]);
  const [documentsByNurse, setDocumentsByNurse] = useState<Record<string, VerificationDocument[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await adminFetch("/api/admin/nurses");

      if (!res.ok) {
        setError("Unable to load nurses.");
        return;
      }

      const data = (await res.json()) as NurseRow[];
      setNurses(data);

      const documentEntries = await Promise.all(
        data.map(async (nurse) => {
          const docsRes = await adminFetch(`/api/admin/nurses/${nurse.id}/verification-documents`);
          if (!docsRes.ok) return [nurse.id, []] as const;
          const docsData = (await docsRes.json()) as { documents?: VerificationDocument[] };
          return [nurse.id, docsData.documents ?? []] as const;
        })
      );
      setDocumentsByNurse(Object.fromEntries(documentEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load nurses.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateVerification = async (id: string, status: "approved" | "rejected") => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/nurses/verify", {
        method: "POST",
        body: JSON.stringify({ nurse_id: id, status })
      });

      if (!res.ok) {
        setError("Unable to update verification.");
        return;
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update verification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Nurse Verification</h2>
      {error ? <p className="notice">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>License #</th>
            <th>Documents</th>
            <th>Status</th>
            <th>Verified At</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {nurses.map((nurse) => (
            <tr key={nurse.id}>
              <td>{nurse.profile_name ?? "-"}</td>
              <td>{nurse.license_number ?? "-"}</td>
              <td>
                {(documentsByNurse[nurse.id] ?? []).length === 0
                  ? "-"
                  : documentsByNurse[nurse.id].map((document) => (
                      <div key={document.id}>
                        {document.document_type}: {document.storage_path} ({document.status})
                      </div>
                    ))}
              </td>
              <td>
                <span className="badge">{nurse.verification_status}</span>
              </td>
              <td>{nurse.verified_at ? new Date(nurse.verified_at).toLocaleDateString() : "-"}</td>
              <td>
                <button
                  className="button"
                  onClick={() => updateVerification(nurse.id, "approved")}
                  disabled={loading}
                >
                  Approve
                </button>
                <button
                  className="button secondary"
                  onClick={() => updateVerification(nurse.id, "rejected")}
                  disabled={loading}
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
