export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>NurseBridge Admin</h1>
      <p style={{ marginTop: 12 }}>
        If you can see this at <code>admin.nursebridges.com</code>, the tunnel route is correct.
      </p>
      <p style={{ marginTop: 12 }}>
        Next step: wire Supabase auth + role management (Phase C).
      </p>
    </main>
  );
}
