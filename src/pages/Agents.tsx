import AgentConfigForm from "@/components/agents/AgentConfigForm";

export default function Agents() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Agent Configuration</h1>
      <AgentConfigForm />
    </div>
  );
}

