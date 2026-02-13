import Dashboard from "../components/Dashboard";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top,rgba(30,58,138,0.16),transparent_45%),linear-gradient(180deg,#020617_0%,#020617_50%,#0b1120_100%)] text-slate-100">
      <Dashboard />
    </main>
  );
}
