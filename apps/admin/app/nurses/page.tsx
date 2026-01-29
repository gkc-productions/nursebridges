"use client";

import { useEffect, useState } from "react";
import { adminFetch, getAdminAccessToken } from "../../lib/adminAuthClient";

type NurseRow = {
  id: string;
  license_number: string | null;
  verified: boolean;
  profile_name: string | null;
  profile_phone: string | null;
  created_at: string;
};

export default function NursesPage() {
  const [nurses, setNurses] = useState<NurseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const token = getAdminAccessToken();
    if (!token) {
      setError("Please sign in.");
      return;
    }

    const res = await adminFetch("/api/admin/nurses");

    if (!res.ok) {
      setError("Unable to load nurses.");
      return;
    }

    const data = (await res.json()) as NurseRow[];
    setNurses(data);
  };

  useEffect(() => {
    void load();
  }, []);

  const updateVerification = async (id: string, verified: boolean) => {
    const token = getAdminAccessToken();
    if (!token) {
      setError("Please sign in.");
      return;
    }

    setLoading(true);
    const res = await adminFetch("/api/admin/nurses/verify", {
      method: "POST",
      body: JSON.stringify({ nurse_id: id, verified })
    });
    setLoading(false);

    if (!res.ok) {
      setError("Unable to update verification.");
      return;
    }

    await load();
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
            <th>Status</th>
            <th>Joined</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {nurses.map((nurse) => (
            <tr key={nurse.id}>
              <td>{nurse.profile_name ?? "-"}</td>
              <td>{nurse.license_number ?? "-"}</td>
              <td>
                <span className="badge">{nurse.verified ? "Verified" : "Pending"}</span>
              </td>
              <td>{new Date(nurse.created_at).toLocaleDateString()}</td>
              <td>
                <button
                  className={`button ${nurse.verified ? "secondary" : ""}`}
                  onClick={() => updateVerification(nurse.id, !nurse.verified)}
                  disabled={loading}
                >
                  {nurse.verified ? "Unverify" : "Verify"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
