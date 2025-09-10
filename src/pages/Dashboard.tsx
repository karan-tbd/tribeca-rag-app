import { Link } from "react-router-dom";
import Header from "@/components/Header";

export default function Dashboard() {
  return (
    <div>
      <Header />
      <main className="p-6 space-y-4 mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome to your RAG app.</p>
        <div className="flex gap-4">
          <Link className="underline" to="/agents">Agents</Link>
          <Link className="underline" to="/documents">Documents</Link>
          <Link className="underline" to="/settings">Settings</Link>
        </div>
      </main>
    </div>
  );
}

