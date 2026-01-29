"use client";

import { useEffect, useState } from "react";
import { adminFetch, getAdminAccessToken } from "../../lib/adminAuthClient";

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
      const token = getAdminAccessToken();
      if (!token) {
        setError("Please sign in.");
        return;
      }

      const res = await adminFetch("/api/admin/users");

      if (!res.ok) {
        setError("Unable to load users.");
        return;
      }

      const data = (await res.json()) as UserRow[];
      setUsers(data);
    };

    void load();
  }, []);

  return (
    <section>
      <h2>Users</h2>
      {error ? <p className="notice">{error}</p> : null}
      <table>
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
              <td>{user.full_name ?? "-"}</td>
              <td>{user.phone ?? "-"}</td>
              <td>
                <span className="badge">{user.role}</span>
              </td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
