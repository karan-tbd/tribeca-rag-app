import Header from "@/components/Header";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import AgentConfigForm from "@/components/agents/AgentConfigForm";

export default function Agents() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Array<{ id: string; name: string; updated_at: string | null }>>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const loadAgents = async () => {
    const { data, error } = await supabase
      .from("agents")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast({ title: "Failed to load agents", description: error.message });
    setAgents(data ?? []);
    
    // Auto-select first agent if none selected
    if (data && data.length > 0 && !selectedAgentId) {
      setSelectedAgentId(data[0].id);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadAgents();
  }, [user]);

  const deleteAgent = async (id: string) => {
    try {
      const { error } = await supabase.from("agents").delete().eq("id", id);
      if (error) throw error;
      
      if (selectedAgentId === id) {
        setSelectedAgentId(null);
      }
      await loadAgents();
      toast({ title: "Agent deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message ?? "Not accessible" });
    }
  };

  const createNewAgent = () => {
    setSelectedAgentId(null);
  };

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-6xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Agent Configuration</h1>
          <Button onClick={createNewAgent}>New Agent</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Agent List Sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Your Agents</CardTitle>
              <CardDescription>Select an agent to configure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.length === 0 ? (
                <div className="text-sm text-muted-foreground">No agents yet.</div>
              ) : (
                agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`p-3 rounded border cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedAgentId === agent.id ? "bg-muted border-primary" : ""
                    }`}
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {agent.updated_at ? new Date(agent.updated_at).toLocaleDateString() : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAgent(agent.id);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Agent Configuration Form */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>{selectedAgentId ? "Configure Agent" : "Create New Agent"}</CardTitle>
              <CardDescription>
                Set up your agent's behavior, prompts, and model preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AgentConfigForm 
                key={selectedAgentId || "new"} 
                agentId={selectedAgentId}
                onSave={() => loadAgents()}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}