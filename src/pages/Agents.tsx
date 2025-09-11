import Header from "@/components/Header";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

export default function Agents() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Array<{ id: string; name: string; updated_at: string | null }>>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAgents = async () => {
    const { data, error } = await supabase
      .from("agents")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast({ title: "Failed to load agents", description: error.message });
    setAgents(data ?? []);
  };

  useEffect(() => {
    if (!user) return;
    loadAgents();
  }, [user]);

  const createAgent = async () => {
    if (!user || !name.trim()) return;
    try {
      setSaving(true);
      const { error } = await supabase.from("agents").insert({ user_id: user.id, name: name.trim() });
      if (error) throw error;
      setName("");
      await loadAgents();
      toast({ title: "Agent created" });
    } catch (e: any) {
      toast({ title: "Create failed", description: e?.message ?? "RLS denied or invalid input." });
    } finally {
      setSaving(false);
    }
  };

  const updateAgent = async (id: string, newName: string) => {
    try {
      const { error } = await supabase.from("agents").update({ name: newName }).eq("id", id);
      if (error) throw error;
      await loadAgents();
      toast({ title: "Agent updated" });
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message ?? "Not accessible" });
    }
  };

  const deleteAgent = async (id: string) => {
    try {
      const { error } = await supabase.from("agents").delete().eq("id", id);
      if (error) throw error;
      await loadAgents();
      toast({ title: "Agent deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message ?? "Not accessible" });
    }
  };

  return (
    <div>
      <Header />
      <main className="mx-auto max-w-3xl p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Agents</h1>
        <div className="flex gap-2 items-center">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Agent name"
            className="max-w-xs"
          />
          <Button onClick={createAgent} disabled={!name.trim() || saving}>{saving ? "Saving…" : "Create"}</Button>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Your agents</h2>
          {agents.length === 0 ? (
            <div className="text-sm text-muted-foreground">No agents yet.</div>
          ) : (
            <ul className="divide-y border rounded">
              {agents.map((a) => (
                <AgentRow key={a.id} id={a.id} name={a.name} updated_at={a.updated_at} onSave={updateAgent} onDelete={deleteAgent} />
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function AgentRow({ id, name, updated_at, onSave, onDelete }: { id: string; name: string; updated_at: string | null; onSave: (id: string, name: string) => void; onDelete: (id: string) => void; }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  return (
    <li className="p-3 text-sm flex items-center justify-between gap-2">
      <div className="flex items-center gap-3 min-w-0">
        {editing ? (
          <Input value={value} onChange={(e) => setValue(e.target.value)} className="max-w-sm" />
        ) : (
          <span className="truncate">{name}</span>
        )}
        <span className="text-muted-foreground">{updated_at ? new Date(updated_at).toLocaleString() : ""}</span>
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Button size="sm" onClick={() => { onSave(id, value.trim()); setEditing(false); }}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => { setValue(name); setEditing(false); }}>Cancel</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete(id)}>Delete</Button>
          </>
        )}
      </div>
    </li>
  );
}

