import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">Welcome to your RAG app.</p>
      <div className="flex gap-4">
        <Link className="underline" to="/agents">Agent Configuration</Link>
        <Link className="underline" to="/settings">Settings</Link>
      </div>
    </div>
  );
}

