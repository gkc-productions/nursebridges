"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/adminAuthClient";

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminFetch("/api/admin/users");

        if (!res.ok) {
          setError("Unable to load users.");
          return;
        }

        const data = (await res.json()) as UserRow[];
        setUsers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load users.");
      }
    };

    void load();
  }, []);

  return (
    <>
    <section className="page-intro">
      <div><p className="eyebrow">Directory</p><h2>People</h2><p>A clear view of every patient, care professional, and operator in the closed beta.</p></div>
      <div className="compact-stats"><span><strong>{users.filter((user) => user.role === "patient").length}</strong><small>Patients</small></span><span><strong>{users.filter((user) => user.role === "nurse").length}</strong><small>Professionals</small></span><span><strong>{users.filter((user) => user.role === "admin").length}</strong><small>Operators</small></span></div>
    </section>
    <section className="data-section">
      <div className="section-heading"><div><p className="eyebrow">Closed beta</p><h2>People directory</h2></div><span className="privacy-pill">{users.length} profiles</span></div>
      {error ? <p className="notice">{error}</p> : null}
      <div className="table-shell"><table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td><strong>{user.full_name ?? "Unnamed profile"}</strong><div className="table-meta">ID {user.id.slice(0, 8)}</div></td>
              <td>{user.phone ?? "-"}</td>
              <td>
                <span className="badge">{user.role}</span>
              </td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </section>
    </>
  );
}
